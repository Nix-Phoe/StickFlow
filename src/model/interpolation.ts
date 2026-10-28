// Interpolation entre deux images clés (Fluidité V1) : linéaire, ou spline Catmull-Rom
// à travers les images clés voisines, avec un rythme éventuellement adouci (easing). Pur.

import type { FramePose, Keyframe, SkeletonNode, SmoothingCurve } from '../core/types';
import { normalizeAngle } from './angle';

/** Images clés autour du segment interpolé `from` → `to`. */
export interface SegmentNeighbours {
  before: Keyframe;
  from: Keyframe;
  to: Keyframe;
  after: Keyframe;
}

/** Ease-in-out cubique : lent au départ et à l'arrivée. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Spline de Catmull-Rom uniforme entre `p1` (t = 0) et `p2` (t = 1). */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}

/**
 * Pose à la fraction `t` (0 → 1) du segment `from` → `to`.
 * - `linear` : droite entre les deux images clés ;
 * - `smooth` : spline passant par les images clés, continue de l'une à l'autre ;
 * - `ease-in-out` : même spline, ralentie près des images clés.
 * Les angles tournent toujours par le plus court chemin ; un nœud non posé part de son angle de repos.
 */
export function interpolateKeyframes(
  { before, from, to, after }: SegmentNeighbours,
  t: number,
  curve: SmoothingCurve,
  skeleton: readonly SkeletonNode[],
): FramePose {
  const time = curve === 'ease-in-out' ? easeInOutCubic(t) : t;
  const mix: (p0: number, p1: number, p2: number, p3: number) => number =
    curve === 'linear'
      ? (_p0, p1, p2) => p1 + (p2 - p1) * time
      : (p0, p1, p2, p3) => catmullRom(p0, p1, p2, p3, time);

  const pose: Record<string, number> = {};
  for (const id of new Set([...Object.keys(from.pose), ...Object.keys(to.pose)])) {
    const rest = skeleton.find((n) => n.id === id)?.angle ?? 0;
    const angle = (keyframe: Keyframe): number => keyframe.pose[id] ?? rest;
    // Déroule les angles autour de `from` pour que la spline ne fasse pas de tour complet.
    const p1 = angle(from);
    const p0 = p1 + normalizeAngle(angle(before) - p1);
    const p2 = p1 + normalizeAngle(angle(to) - p1);
    const p3 = p2 + normalizeAngle(angle(after) - angle(to));
    pose[id] = mix(p0, p1, p2, p3);
  }

  const axis = (read: (k: Keyframe) => number): number => mix(read(before), read(from), read(to), read(after));
  return {
    pose,
    rootPosition: { x: axis((k) => k.rootPosition.x), y: axis((k) => k.rootPosition.y) },
  };
}
