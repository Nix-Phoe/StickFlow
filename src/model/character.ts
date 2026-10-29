// Personnages : création, placement, pose dans le monde (avec la taille), encombrement, couleurs. Pur.

import type { Character, CharacterAppearance, FramePose, Vec2 } from '../core/types';
import { solvePose, type PosedNode } from './kinematics';
import { createDefaultSkeleton, sortSkeleton } from './skeleton';

export const DEFAULT_APPEARANCE: CharacterAppearance = { scale: 1, defaultColor: null, segmentColors: {}, segmentBands: {} };

/** Écart horizontal entre deux personnages ajoutés, en unités du monde. */
export const PLACEMENT_STEP = 90;
/** Décalage d'une copie de personnage par rapport à l'original. */
export const DUPLICATE_OFFSET: Vec2 = { x: 45, y: 0 };

/** Nouveau stickman de base, visible et déverrouillé. */
export function createCharacter(id: string, name: string): Character {
  return {
    id,
    name,
    visible: true,
    locked: false,
    skeleton: sortSkeleton(createDefaultSkeleton()),
    appearance: { ...DEFAULT_APPEARANCE, segmentColors: {}, segmentBands: {} },
  };
}

/**
 * Position de départ d'un nouveau personnage : l'origine si elle est libre, sinon alternativement
 * à droite puis à gauche, de `PLACEMENT_STEP` en `PLACEMENT_STEP`, jusqu'à une place libre.
 */
export function placeNewCharacter(occupied: readonly Vec2[]): Vec2 {
  const isFree = (x: number): boolean => occupied.every((p) => Math.hypot(p.x - x, p.y) >= PLACEMENT_STEP / 2);
  for (let i = 0; ; i += 1) {
    const rank = Math.ceil(i / 2);
    const x = rank === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * rank * PLACEMENT_STEP;
    if (isFree(x)) return { x, y: 0 };
  }
}

/** Nœuds du personnage placés dans le monde, à sa taille. */
export function posedCharacter(character: Character, frame: FramePose): PosedNode[] {
  return solvePose(character.skeleton, frame.pose, frame.rootPosition, character.appearance.scale);
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Rectangle qui contient le personnage posé, traits (d'épaisseur `strokeWidth` à la taille 1) compris. */
export function characterBounds(character: Character, frame: FramePose, strokeWidth: number): Bounds {
  const { scale } = character.appearance;
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const include = (p: Vec2, radius: number): void => {
    bounds.minX = Math.min(bounds.minX, p.x - radius);
    bounds.minY = Math.min(bounds.minY, p.y - radius);
    bounds.maxX = Math.max(bounds.maxX, p.x + radius);
    bounds.maxY = Math.max(bounds.maxY, p.y + radius);
  };
  const posed = posedCharacter(character, frame);
  character.skeleton.forEach((node, i) => {
    const placed = posed[i];
    if (!placed) return;
    if (node.shape === 'circle') {
      include({ x: (placed.start.x + placed.end.x) / 2, y: (placed.start.y + placed.end.y) / 2 }, (node.length * scale) / 2);
    } else {
      include(placed.start, (strokeWidth * scale) / 2);
      include(placed.end, (strokeWidth * scale) / 2);
    }
  });
  return bounds;
}

/** Couleur d'une partie : la sienne, sinon celle du personnage, sinon `fallback` (couleur automatique). */
export function partColor(character: Character, nodeId: string, fallback: string): string {
  return character.appearance.segmentColors[nodeId] ?? character.appearance.defaultColor ?? fallback;
}

/** Parties coloriables : les nœuds qui dessinent quelque chose (la racine, de longueur nulle, n'en est pas une). */
export function characterParts(character: Character): string[] {
  return character.skeleton.filter((node) => node.length > 0).map((node) => node.id);
}

/** Encombrement du personnage dans sa pose de repos, à la taille 100 % (unités du monde). */
export function restSize(character: Character, strokeWidth = 9): { width: number; height: number } {
  const normal: Character = { ...character, appearance: { ...character.appearance, scale: 1 } };
  const box = characterBounds(normal, { pose: {}, rootPosition: { x: 0, y: 0 } }, strokeWidth);
  return { width: box.maxX - box.minX, height: box.maxY - box.minY };
}
