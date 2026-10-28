// Séquence affichée et jouée : les images clés, entre elles les frames générées par la
// Fluidité, et après la dernière la transition de Répétition vers la première.
// Dérivée, jamais enregistrée (ADR 0002) : les images clés restent intactes.
// Chaque personnage est interpolé indépendamment.
// Pur et mémoïsé : tant que ses entrées ne changent pas, chaque frame garde le même objet.

import type {
  Character,
  FramePose,
  Keyframe,
  LoopSettings,
  Project,
  SkeletonNode,
  SmoothingCurve,
  SmoothingSettings,
} from '../core/types';
import { interpolatePose } from './interpolation';

interface SequenceFrameBase {
  /** Stable : id de l'image clé, ou « de → vers #rang » pour une frame générée. */
  id: string;
  /** Pose de chaque personnage, indexée par id de personnage. */
  poses: Readonly<Record<string, FramePose>>;
}

export type SequenceFrame =
  | (SequenceFrameBase & { kind: 'keyframe' })
  | (SequenceFrameBase & {
      kind: 'generated';
      /** Images clés qui encadrent la frame, et son rang entre elles (à partir de 1). */
      from: string;
      to: string;
      step: number;
    });

/**
 * Ce dont dépend l'interpolation : les personnages et leurs squelettes (pas leur apparence,
 * pour qu'un changement de couleur ou de nom ne recalcule rien).
 */
type Rig = ReadonlyArray<readonly [id: string, skeleton: readonly SkeletonNode[]]>;

const rigOf = (characters: readonly Character[]): Rig => characters.map((c) => [c.id, c.skeleton] as const);

function sameRig(a: Rig, b: Rig): boolean {
  return a.length === b.length && a.every(([id, skeleton], i) => b[i]?.[0] === id && b[i]?.[1] === skeleton);
}

/** Images clés autour d'un segment interpolé `from` → `to`. */
interface SegmentNeighbours {
  before: Keyframe;
  from: Keyframe;
  to: Keyframe;
  after: Keyframe;
}

let last: {
  keyframes: readonly Keyframe[];
  rig: Rig;
  smoothing: SmoothingSettings;
  loop: LoopSettings;
  sequence: readonly SequenceFrame[];
} | null = null;

/**
 * Calcule la séquence d'un Projet. Même tableau tant que images clés, personnages (et leurs
 * squelettes), Fluidité et Répétition sont inchangés.
 */
export function deriveSequence(project: Project): readonly SequenceFrame[] {
  const { keyframes } = project;
  const { smoothing, loop } = project.ai;
  const rig = rigOf(project.characters);
  if (last && last.keyframes === keyframes && sameRig(last.rig, rig) && last.smoothing === smoothing && last.loop === loop) {
    return last.sequence;
  }

  // Avec la Répétition, l'animation est une boucle : la première image clé suit la dernière.
  const cyclic = loop.enabled && keyframes.length > 1;
  const neighbour = (index: number): Keyframe => {
    const wrapped = cyclic
      ? (index + keyframes.length) % keyframes.length
      : Math.min(Math.max(index, 0), keyframes.length - 1);
    const keyframe = keyframes[wrapped];
    if (!keyframe) throw new Error('Séquence sans image clé');
    return keyframe;
  };
  const neighboursOf = (i: number): SegmentNeighbours => ({
    before: neighbour(i - 1),
    from: neighbour(i),
    to: neighbour(i + 1),
    after: neighbour(i + 2),
  });

  const between = smoothing.enabled ? smoothing.intensity : 0;
  const sequence: SequenceFrame[] = [];
  keyframes.forEach((keyframe, i) => {
    sequence.push(keyframeFrame(keyframe));
    if (i < keyframes.length - 1 && between > 0) {
      sequence.push(...segment(neighboursOf(i), between, smoothing.curve, rig));
    }
  });
  if (cyclic) {
    // La transition suit la courbe de la Fluidité, ou une courbe douce si la Fluidité est coupée.
    const curve = smoothing.enabled ? smoothing.curve : 'smooth';
    sequence.push(...segment(neighboursOf(keyframes.length - 1), loop.transitionFrames, curve, rig));
  }

  last = { keyframes, rig, smoothing, loop, sequence };
  return sequence;
}

// ---------- Mémoïsation par image clé et par segment ----------

const keyframeFrames = new WeakMap<Keyframe, SequenceFrame>();

function keyframeFrame(keyframe: Keyframe): SequenceFrame {
  let frame = keyframeFrames.get(keyframe);
  if (!frame) {
    frame = { kind: 'keyframe', id: keyframe.id, poses: keyframe.poses };
    keyframeFrames.set(keyframe, frame);
  }
  return frame;
}

interface Segment {
  neighbours: SegmentNeighbours;
  count: number;
  curve: SmoothingCurve;
  rig: Rig;
  frames: SequenceFrame[];
}

/** Frames générées par segment, indexées par leur image clé de départ. */
const segments = new WeakMap<Keyframe, Segment>();

function isReusable(
  cached: Segment | undefined,
  n: SegmentNeighbours,
  count: number,
  curve: SmoothingCurve,
  rig: Rig,
): cached is Segment {
  if (!cached || cached.count !== count || cached.curve !== curve || !sameRig(cached.rig, rig)) return false;
  if (cached.neighbours.to !== n.to) return false;
  // En linéaire, seules les deux images clés du segment comptent ; la spline regarde aussi leurs voisines.
  return curve === 'linear' || (cached.neighbours.before === n.before && cached.neighbours.after === n.after);
}

const REST: FramePose = { pose: {}, rootPosition: { x: 0, y: 0 } };

function segment(neighbours: SegmentNeighbours, count: number, curve: SmoothingCurve, rig: Rig): SequenceFrame[] {
  const { before, from, to, after } = neighbours;
  const cached = segments.get(from);
  if (isReusable(cached, neighbours, count, curve, rig)) return cached.frames;

  const frames: SequenceFrame[] = [];
  for (let step = 1; step <= count; step += 1) {
    const t = step / (count + 1);
    const poses: Record<string, FramePose> = {};
    for (const [id, skeleton] of rig) {
      // Un personnage sans pose dans une image clé (projet en cours de réparation) part du repos.
      const at = (keyframe: Keyframe): FramePose => keyframe.poses[id] ?? REST;
      poses[id] = interpolatePose({ before: at(before), from: at(from), to: at(to), after: at(after) }, t, curve, skeleton);
    }
    frames.push({ kind: 'generated', id: `${from.id}→${to.id}#${step}`, from: from.id, to: to.id, step, poses });
  }
  segments.set(from, { neighbours, count, curve, rig, frames });
  return frames;
}
