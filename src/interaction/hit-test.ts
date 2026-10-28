// Test de toucher des personnages : poignée de nœud > partie (segment ou tête) > personnage entier.
// Seuls les personnages visibles et déverrouillés réagissent. Pur.

import type { Project, Vec2 } from '../core/types';
import { characterBounds, posedCharacter } from '../model/character';
import type { SequenceFrame } from '../model/sequence';
import { buildCapsules, DEFAULT_STICKMAN_STYLE, type Capsule } from '../render/scene';
import { pickNode } from './picking';

/** Tolérances, en unités du monde : autour d'une poignée, et autour du trait d'une partie. */
export interface HitTolerance {
  handle: number;
  segment: number;
}

export interface CharacterHit {
  characterId: string;
  /** Nœud saisi (poignée) ou partie touchée ; `null` pour le personnage entier. */
  nodeId: string | null;
  target: 'node' | 'segment' | 'character';
}

/** Distance du point au bord d'une capsule (négative à l'intérieur). */
function distanceToCapsule(point: Vec2, { a, b, radius }: Capsule): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * abx + (point.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t)) - radius;
}

/**
 * Ce qui est sous `point` :
 * 1. une poignée du personnage sélectionné ;
 * 2. une partie d'un personnage, le plus au-dessus d'abord ;
 * 3. un personnage dont le cadre contient le point (le plus proche de son tracé) ;
 * `null` dans le vide.
 */
export function pickCharacterTarget(
  project: Project,
  frame: SequenceFrame,
  point: Vec2,
  tolerance: HitTolerance,
  selectedCharacterId: string | null,
): CharacterHit | null {
  const interactive = project.characters.flatMap((character) => {
    const pose = frame.poses[character.id];
    return character.visible && !character.locked && pose ? [{ character, pose, posed: posedCharacter(character, pose) }] : [];
  });

  const selected = interactive.find(({ character }) => character.id === selectedCharacterId);
  if (selected) {
    const nodeId = pickNode(selected.posed, point, tolerance.handle);
    if (nodeId) return { characterId: selected.character.id, nodeId, target: 'node' };
  }

  // Les derniers personnages sont dessinés au-dessus : on les teste en premier.
  const topFirst = interactive.toReversed().map((entry) => ({
    ...entry,
    capsules: buildCapsules(entry.character.skeleton, entry.posed, DEFAULT_STICKMAN_STYLE, entry.character.appearance.scale),
  }));
  for (const { character, capsules } of topFirst) {
    // La dernière partie dessinée est au-dessus des autres.
    const part = capsules.toReversed().find((capsule) => distanceToCapsule(point, capsule) <= tolerance.segment);
    if (part) return { characterId: character.id, nodeId: part.nodeId, target: 'segment' };
  }

  let best: { id: string; distance: number } | null = null;
  for (const { character, pose, capsules } of topFirst) {
    const box = characterBounds(character, pose, DEFAULT_STICKMAN_STYLE.strokeWidth);
    if (point.x < box.minX || point.x > box.maxX || point.y < box.minY || point.y > box.maxY) continue;
    const distance = Math.min(...capsules.map((capsule) => distanceToCapsule(point, capsule)));
    if (!best || distance < best.distance) best = { id: character.id, distance };
  }
  return best ? { characterId: best.id, nodeId: null, target: 'character' } : null;
}
