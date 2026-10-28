// Cinématique directe : de la pose (angles relatifs) aux positions dans le monde.

import type { SkeletonNode, Vec2 } from '../core/types';

/** Un nœud placé dans le monde : son segment va de `start` (fin du parent) à `end`. */
export interface PosedNode {
  id: string;
  start: Vec2;
  end: Vec2;
  /** Angle absolu, en radians. */
  angle: number;
}

/**
 * Calcule la position de chaque nœud. `skeleton` doit être trié parents avant enfants
 * (voir `sortSkeleton`). Les nœuds absents de `pose` gardent leur angle de repos.
 * `scale` multiplie toutes les longueurs (taille du personnage).
 */
export function solvePose(
  skeleton: readonly SkeletonNode[],
  pose: Readonly<Record<string, number>>,
  rootPosition: Vec2,
  scale = 1,
): PosedNode[] {
  const placed = new Map<string, PosedNode>();

  return skeleton.map((node) => {
    let start = rootPosition;
    let parentAngle = 0;
    if (node.parentId !== null) {
      const parent = placed.get(node.parentId);
      if (!parent) throw new Error(`Le parent ${node.parentId} doit précéder ${node.id}`);
      start = parent.end;
      parentAngle = parent.angle;
    }

    const angle = parentAngle + (pose[node.id] ?? node.angle);
    const end = {
      x: start.x + node.length * scale * Math.cos(angle),
      y: start.y + node.length * scale * Math.sin(angle),
    };
    const posed: PosedNode = { id: node.id, start, end, angle };
    placed.set(node.id, posed);
    return posed;
  });
}
