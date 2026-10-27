// Manipulation des nœuds au clavier.

import type { SkeletonNode } from '../core/types';
import { normalizeAngle } from '../model/angle';

const DEGREE = Math.PI / 180;
/** Pas de rotation au clavier : normal, et fin (avec Maj). */
export const NUDGE_STEP = 5 * DEGREE;
export const NUDGE_FINE_STEP = 1 * DEGREE;

/**
 * Nœud suivant (`1`) ou précédent (`-1`) dans l'ordre du squelette, en bouclant.
 * Sans sélection valide, part du premier ou du dernier nœud.
 */
export function cycleNode(skeleton: readonly SkeletonNode[], currentId: string | null, direction: 1 | -1): string | null {
  if (skeleton.length === 0) return null;
  const index = skeleton.findIndex((n) => n.id === currentId);
  const next =
    index === -1
      ? direction === 1
        ? 0
        : skeleton.length - 1
      : (index + direction + skeleton.length) % skeleton.length;
  return skeleton[next]?.id ?? null;
}

/** Tourne un nœud de `delta` radians (relatif à son angle posé, ou de repos s'il n'est pas posé). */
export function nudgeNode(
  pose: Readonly<Record<string, number>>,
  skeleton: readonly SkeletonNode[],
  nodeId: string,
  delta: number,
): Record<string, number> {
  const node = skeleton.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Nœud inconnu : ${nodeId}`);
  return { ...pose, [nodeId]: normalizeAngle((pose[nodeId] ?? node.angle) + delta) };
}
