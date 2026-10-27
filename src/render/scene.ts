// Géométrie du stickman : des nœuds posés aux capsules envoyées au GPU.

import type { SkeletonNode, Vec2 } from '../core/types';
import type { PosedNode } from '../model/kinematics';

/** Segment épais à bouts ronds ; `a === b` donne un disque. */
export interface Capsule {
  a: Vec2;
  b: Vec2;
  radius: number;
}

export interface StickmanStyle {
  /** Épaisseur des membres, en unités du monde. */
  strokeWidth: number;
}

export const DEFAULT_STICKMAN_STYLE: StickmanStyle = { strokeWidth: 9 };

/** Une capsule = départ (x, y), arrivée (x, y), rayon. Doit correspondre aux attributs du shader. */
export const FLOATS_PER_CAPSULE = 5;

/**
 * Une capsule par nœud de longueur non nulle, dans l'ordre du squelette
 * (les nœuds suivants sont dessinés par-dessus).
 */
export function buildCapsules(
  skeleton: readonly SkeletonNode[],
  posed: readonly PosedNode[],
  style: StickmanStyle,
): Capsule[] {
  const byId = new Map(posed.map((p) => [p.id, p]));
  const capsules: Capsule[] = [];

  for (const node of skeleton) {
    const placed = byId.get(node.id);
    if (!placed) throw new Error(`Nœud non posé : ${node.id}`);
    if (node.length === 0) continue;

    if (node.shape === 'circle') {
      const center = { x: (placed.start.x + placed.end.x) / 2, y: (placed.start.y + placed.end.y) / 2 };
      capsules.push({ a: center, b: center, radius: node.length / 2 });
    } else {
      capsules.push({ a: placed.start, b: placed.end, radius: style.strokeWidth / 2 });
    }
  }
  return capsules;
}

export function packCapsules(capsules: readonly Capsule[]): Float32Array {
  const data = new Float32Array(capsules.length * FLOATS_PER_CAPSULE);
  capsules.forEach((c, i) => {
    data.set([c.a.x, c.a.y, c.b.x, c.b.y, c.radius], i * FLOATS_PER_CAPSULE);
  });
  return data;
}
