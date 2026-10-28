// Calque de dessin du décor : une image matricielle fixe dans le monde, découpée en tuiles.
// Chaque trait n'enregistre que les tuiles qu'il a touchées (instantané de la zone modifiée). Pur.

import type { Vec2 } from '../core/types';

/**
 * Taille du calque en pixels, taille d'une tuile, et densité. Le calque est aussi haut que la
 * scène (400 unités) et assez large pour les écrans très larges.
 */
export const DRAWING_LAYER = { width: 2048, height: 768, tileSize: 256, pixelsPerUnit: 1.92 } as const;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectangle du calque dans le monde (coin bas-gauche, taille). */
export const DRAWING_LAYER_WORLD = {
  x: -DRAWING_LAYER.width / 2 / DRAWING_LAYER.pixelsPerUnit,
  y: -DRAWING_LAYER.height / 2 / DRAWING_LAYER.pixelsPerUnit,
  width: DRAWING_LAYER.width / DRAWING_LAYER.pixelsPerUnit,
  height: DRAWING_LAYER.height / DRAWING_LAYER.pixelsPerUnit,
} as const;

/** Point du monde → pixel du calque (origine en haut à gauche, y vers le bas). */
export function worldToLayer(point: Vec2): Vec2 {
  return {
    x: DRAWING_LAYER.width / 2 + point.x * DRAWING_LAYER.pixelsPerUnit,
    y: DRAWING_LAYER.height / 2 - point.y * DRAWING_LAYER.pixelsPerUnit,
  };
}

export function layerToWorld(pixel: Vec2): Vec2 {
  return {
    x: (pixel.x - DRAWING_LAYER.width / 2) / DRAWING_LAYER.pixelsPerUnit,
    y: (DRAWING_LAYER.height / 2 - pixel.y) / DRAWING_LAYER.pixelsPerUnit,
  };
}

export const tileKey = (column: number, row: number): string => `${column},${row}`;

export function tileRect(key: string): PixelRect {
  const [column = 0, row = 0] = key.split(',').map(Number);
  const size = DRAWING_LAYER.tileSize;
  return { x: column * size, y: row * size, width: size, height: size };
}

/** Tuiles touchées par un rectangle de pixels, limitées au calque, ligne par ligne. */
export function tilesInRect(rect: PixelRect): string[] {
  const size = DRAWING_LAYER.tileSize;
  const left = Math.max(0, Math.floor(rect.x / size));
  const top = Math.max(0, Math.floor(rect.y / size));
  const right = Math.min(DRAWING_LAYER.width / size - 1, Math.floor((rect.x + rect.width) / size));
  const bottom = Math.min(DRAWING_LAYER.height / size - 1, Math.floor((rect.y + rect.height) / size));
  if (rect.x + rect.width <= 0 || rect.y + rect.height <= 0) return [];
  const keys: string[] = [];
  for (let row = top; row <= bottom; row += 1) for (let column = left; column <= right; column += 1) keys.push(tileKey(column, row));
  return keys;
}
