import type { Vec2 } from '../core/types';
import type { PosedNode } from '../model/kinematics';

/**
 * Nœud dont la poignée (le bout du segment, ou la position pour la racine) est la plus
 * proche de `point`, à `tolerance` près (unités du monde). À égalité, le nœud dessiné en
 * dernier l'emporte, comme à l'écran. `null` si aucune poignée n'est assez proche.
 */
export function pickNode(posed: readonly PosedNode[], point: Vec2, tolerance: number): string | null {
  let best: string | null = null;
  let bestDistance = tolerance;
  for (const node of posed) {
    const distance = Math.hypot(node.end.x - point.x, node.end.y - point.y);
    if (distance <= bestDistance) {
      best = node.id;
      bestDistance = distance;
    }
  }
  return best;
}
