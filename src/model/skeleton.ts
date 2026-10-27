// Squelette du stickman : définition par défaut et validation. Sans DOM ni WebGL.

import type { NodeShape, SkeletonNode } from '../core/types';

export class SkeletonError extends Error {
  override name = 'SkeletonError';
}

const QUARTER_TURN = Math.PI / 2;
const ARM_SPREAD = 0.45;
const LEG_SPREAD = 0.25;

function node(id: string, parentId: string | null, length: number, angle: number, shape: NodeShape = 'segment'): SkeletonNode {
  return { id, parentId, length, angle, shape };
}

/**
 * Stickman par défaut, en unités du monde (y vers le haut).
 * Les angles sont relatifs au parent : le bassin regarde vers +x, le torse monte (+90°),
 * les bras et les jambes pendent de part et d'autre de la verticale.
 */
export function createDefaultSkeleton(): SkeletonNode[] {
  return [
    node('hip', null, 0, 0),
    node('torso', 'hip', 70, QUARTER_TURN),
    node('head', 'torso', 40, 0, 'circle'),
    // Bras accrochés aux épaules (fin du torse, orienté à +90°) : vers le bas = -180° en relatif.
    node('upperArmL', 'torso', 45, -Math.PI - ARM_SPREAD),
    node('forearmL', 'upperArmL', 45, 0.3),
    node('upperArmR', 'torso', 45, -Math.PI + ARM_SPREAD),
    node('forearmR', 'upperArmR', 45, -0.3),
    // Jambes accrochées au bassin (orienté à 0°) : vers le bas = -90° en relatif.
    node('thighL', 'hip', 50, -QUARTER_TURN - LEG_SPREAD),
    node('shinL', 'thighL', 50, 0.1),
    node('thighR', 'hip', 50, -QUARTER_TURN + LEG_SPREAD),
    node('shinR', 'thighR', 50, -0.1),
  ];
}

/**
 * Vérifie le squelette et le renvoie trié parents avant enfants (ordre stable entre frères).
 * Lève `SkeletonError` si : aucune ou plusieurs racines, parent inconnu, cycle, id en double,
 * longueur négative.
 */
export function sortSkeleton(nodes: readonly SkeletonNode[]): SkeletonNode[] {
  const byId = new Map<string, SkeletonNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) throw new SkeletonError(`Nœud en double : ${n.id}`);
    if (n.length < 0) throw new SkeletonError(`Longueur négative : ${n.id}`);
    byId.set(n.id, n);
  }

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1) throw new SkeletonError(`Le squelette doit avoir une racine, il en a ${roots.length}`);

  const children = new Map<string, SkeletonNode[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    if (!byId.has(n.parentId)) throw new SkeletonError(`Parent inconnu pour ${n.id} : ${n.parentId}`);
    const siblings = children.get(n.parentId) ?? [];
    siblings.push(n);
    children.set(n.parentId, siblings);
  }

  // Parcours en largeur depuis la racine : un nœud jamais atteint appartient à un cycle.
  const sorted: SkeletonNode[] = [];
  const queue = [...roots];
  for (let next = queue.shift(); next; next = queue.shift()) {
    sorted.push(next);
    queue.push(...(children.get(next.id) ?? []));
  }
  if (sorted.length !== nodes.length) throw new SkeletonError('Le squelette contient un cycle');

  return sorted;
}
