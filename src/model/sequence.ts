// Séquence affichée et jouée : les images clés, et entre elles les frames générées par la
// Fluidité. Dérivée, jamais enregistrée (ADR 0002) : les images clés restent intactes.
// Pur et mémoïsé : tant que ses entrées ne changent pas, chaque frame garde le même objet.

import type { Keyframe, Project, SkeletonNode, Vec2 } from '../core/types';
import { normalizeAngle } from './angle';

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

/** Calcule la séquence d'un Projet. Même tableau tant que images clés, squelette et Fluidité sont inchangés. */
export function deriveSequence(project: Project): readonly SequenceFrame[] {
  const { keyframes, skeleton } = project;
  const { smoothing } = project.ai;
  if (last && last.keyframes === keyframes && last.skeleton === skeleton && last.smoothing === smoothing) {
    return last.sequence;
  }

  const between = smoothing.enabled ? smoothing.intensity : 0;
  const sequence: SequenceFrame[] = [];
  keyframes.forEach((keyframe, i) => {
    sequence.push(keyframeFrame(keyframe));
    const next = keyframes[i + 1];
    if (next && between > 0) sequence.push(...segment(keyframe, next, between, skeleton));
  });

  last = { keyframes, skeleton, smoothing, sequence };
  return sequence;
}

// ---------- Mémoïsation ----------

let last: {
  keyframes: readonly Keyframe[];
  skeleton: readonly SkeletonNode[];
  smoothing: Project['ai']['smoothing'];
  sequence: readonly SequenceFrame[];
} | null = null;

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
  to: Keyframe;
  between: number;
  skeleton: readonly SkeletonNode[];
  frames: SequenceFrame[];
}

/** Frames générées entre `from` et `to`, réutilisées si le segment n'a pas changé. */
const segments = new WeakMap<Keyframe, Segment>();

function segment(from: Keyframe, to: Keyframe, between: number, skeleton: readonly SkeletonNode[]): SequenceFrame[] {
  const cached = segments.get(from);
  if (cached && cached.to === to && cached.between === between && cached.skeleton === skeleton) return cached.frames;

  const frames: SequenceFrame[] = [];
  for (let step = 1; step <= between; step += 1) {
    const t = step / (between + 1);
    frames.push({
      kind: 'generated',
      id: `${from.id}→${to.id}#${step}`,
      from: from.id,
      to: to.id,
      step,
      pose: interpolatePose(from, to, t, skeleton),
      rootPosition: {
        x: from.rootPosition.x + (to.rootPosition.x - from.rootPosition.x) * t,
        y: from.rootPosition.y + (to.rootPosition.y - from.rootPosition.y) * t,
      },
    });
  }
  segments.set(from, { to, between, skeleton, frames });
  return frames;
}

// ---------- Interpolation (V1 : linéaire ; courbes et splines en phase 5) ----------

/** Angles interpolés par le plus court chemin ; un nœud posé d'un seul côté part de son angle de repos. */
function interpolatePose(
  from: Keyframe,
  to: Keyframe,
  t: number,
  skeleton: readonly SkeletonNode[],
): Record<string, number> {
  const pose: Record<string, number> = {};
  for (const id of new Set([...Object.keys(from.pose), ...Object.keys(to.pose)])) {
    const rest = skeleton.find((n) => n.id === id)?.angle ?? 0;
    const a = from.pose[id] ?? rest;
    const b = to.pose[id] ?? rest;
    pose[id] = a + normalizeAngle(b - a) * t;
  }
  return pose;
}
