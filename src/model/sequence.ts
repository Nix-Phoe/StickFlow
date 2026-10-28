// Séquence affichée et jouée : les images clés, entre elles les frames générées par la
// Fluidité, et après la dernière la transition de Répétition vers la première.
// Dérivée, jamais enregistrée (ADR 0002) : les images clés restent intactes.
// Pur et mémoïsé : tant que ses entrées ne changent pas, chaque frame garde le même objet.

import type { Keyframe, LoopSettings, Project, SkeletonNode, SmoothingCurve, SmoothingSettings, Vec2 } from '../core/types';
import { interpolateKeyframes, type SegmentNeighbours } from './interpolation';

interface SequenceFrameBase {
  /** Stable : id de l'image clé, ou « de → vers #rang » pour une frame générée. */
  id: string;
  pose: Readonly<Record<string, number>>;
  rootPosition: Vec2;
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

let last: {
  keyframes: readonly Keyframe[];
  skeleton: readonly SkeletonNode[];
  smoothing: SmoothingSettings;
  loop: LoopSettings;
  sequence: readonly SequenceFrame[];
} | null = null;

/**
 * Calcule la séquence d'un Projet. Même tableau tant que images clés, squelette, Fluidité
 * et Répétition sont inchangés.
 */
export function deriveSequence(project: Project): readonly SequenceFrame[] {
  const { keyframes, skeleton } = project;
  const { smoothing, loop } = project.ai;
  if (
    last &&
    last.keyframes === keyframes &&
    last.skeleton === skeleton &&
    last.smoothing === smoothing &&
    last.loop === loop
  ) {
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
      sequence.push(...segment(neighboursOf(i), between, smoothing.curve, skeleton));
    }
  });
  if (cyclic) {
    // La transition suit la courbe de la Fluidité, ou une courbe douce si la Fluidité est coupée.
    const curve = smoothing.enabled ? smoothing.curve : 'smooth';
    sequence.push(...segment(neighboursOf(keyframes.length - 1), loop.transitionFrames, curve, skeleton));
  }

  last = { keyframes, skeleton, smoothing, loop, sequence };
  return sequence;
}

// ---------- Mémoïsation par image clé et par segment ----------

const keyframeFrames = new WeakMap<Keyframe, SequenceFrame>();

function keyframeFrame(keyframe: Keyframe): SequenceFrame {
  let frame = keyframeFrames.get(keyframe);
  if (!frame) {
    frame = { kind: 'keyframe', id: keyframe.id, pose: keyframe.pose, rootPosition: keyframe.rootPosition };
    keyframeFrames.set(keyframe, frame);
  }
  return frame;
}

interface Segment {
  neighbours: SegmentNeighbours;
  count: number;
  curve: SmoothingCurve;
  skeleton: readonly SkeletonNode[];
  frames: SequenceFrame[];
}

/** Frames générées par segment, indexées par leur image clé de départ. */
const segments = new WeakMap<Keyframe, Segment>();

function isReusable(
  cached: Segment | undefined,
  n: SegmentNeighbours,
  count: number,
  curve: SmoothingCurve,
  skeleton: readonly SkeletonNode[],
): cached is Segment {
  if (!cached || cached.count !== count || cached.curve !== curve || cached.skeleton !== skeleton) return false;
  if (cached.neighbours.to !== n.to) return false;
  // En linéaire, seules les deux images clés du segment comptent ; la spline regarde aussi leurs voisines.
  return curve === 'linear' || (cached.neighbours.before === n.before && cached.neighbours.after === n.after);
}

function segment(
  neighbours: SegmentNeighbours,
  count: number,
  curve: SmoothingCurve,
  skeleton: readonly SkeletonNode[],
): SequenceFrame[] {
  const { from, to } = neighbours;
  const cached = segments.get(from);
  if (isReusable(cached, neighbours, count, curve, skeleton)) return cached.frames;

  const frames: SequenceFrame[] = [];
  for (let step = 1; step <= count; step += 1) {
    const { pose, rootPosition } = interpolateKeyframes(neighbours, step / (count + 1), curve, skeleton);
    frames.push({ kind: 'generated', id: `${from.id}→${to.id}#${step}`, from: from.id, to: to.id, step, pose, rootPosition });
  }
  segments.set(from, { neighbours, count, curve, skeleton, frames });
  return frames;
}
