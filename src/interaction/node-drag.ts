import type { FramePose, SkeletonNode, Vec2 } from '../core/types';
import { normalizeAngle } from '../model/angle';
import type { PosedNode } from '../model/kinematics';

export interface NodeDrag {
  /** Nouvelle pose de la frame pour la position actuelle du pointeur (unités du monde). */
  update(point: Vec2): FramePose;
}

/**
 * Commence à faire glisser un nœud saisi en `grab`.
 * - La racine déplace toute la figure.
 * - Tout autre nœud tourne autour de son point de départ (le bout de son parent) ;
 *   l'écart entre le point saisi et la poignée est conservé, pour que rien ne saute.
 */
export function startNodeDrag(
  skeleton: readonly SkeletonNode[],
  posed: readonly PosedNode[],
  frame: FramePose,
  nodeId: string,
  grab: Vec2,
): NodeDrag {
  const node = skeleton.find((n) => n.id === nodeId);
  const placed = posed.find((p) => p.id === nodeId);
  if (!node || !placed) throw new Error(`Nœud inconnu : ${nodeId}`);

  if (node.parentId === null) {
    return {
      update: (point) => ({
        pose: frame.pose,
        rootPosition: {
          x: frame.rootPosition.x + point.x - grab.x,
          y: frame.rootPosition.y + point.y - grab.y,
        },
      }),
    };
  }

  const pivot = placed.start;
  const parentAngle = placed.angle - (frame.pose[nodeId] ?? node.angle);
  const grabOffset = directionOf(grab, pivot, placed.angle) - placed.angle;
  let lastAbsolute = placed.angle;

  return {
    update(point) {
      lastAbsolute = directionOf(point, pivot, lastAbsolute + grabOffset) - grabOffset;
      return {
        pose: { ...frame.pose, [nodeId]: normalizeAngle(lastAbsolute - parentAngle) },
        rootPosition: frame.rootPosition,
      };
    },
  };
}

/** Angle de `point` vu depuis `pivot` ; `fallback` si les deux points se confondent. */
function directionOf(point: Vec2, pivot: Vec2, fallback: number): number {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return dx === 0 && dy === 0 ? fallback : Math.atan2(dy, dx);
}
