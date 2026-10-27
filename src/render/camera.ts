// Caméra 2D : du monde (origine au centre, y vers le haut) à l'espace de découpage WebGL.

import { mat3 } from 'gl-matrix';

import type { Vec2 } from '../core/types';

/** Hauteur du monde visible sur la scène, en unités. Le stickman par défaut en mesure ~210. */
export const STAGE_WORLD_HEIGHT = 400;

export interface Viewport {
  /** Largeur en pixels physiques. */
  width: number;
  /** Hauteur en pixels physiques. */
  height: number;
}

export interface Camera {
  /** Matrice 3×3 colonne-major, prête pour `uniformMatrix3fv`. */
  viewProjection: Float32Array;
  /** Pixels physiques couverts par une unité du monde (sert à l'anticrénelage). */
  pixelsPerUnit: number;
}

/** La hauteur visible est fixe ; la largeur suit le rapport d'aspect pour garder des unités carrées. */
export function createCamera(viewport: Viewport, worldHeight: number): Camera {
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    throw new RangeError(`Viewport vide : ${viewport.width} × ${viewport.height}`);
  }
  if (!(worldHeight > 0)) throw new RangeError(`Hauteur du monde invalide : ${worldHeight}`);

  const pixelsPerUnit = viewport.height / worldHeight;
  const worldWidth = viewport.width / pixelsPerUnit;
  const viewProjection = new Float32Array(9);
  mat3.fromScaling(viewProjection, [2 / worldWidth, 2 / worldHeight]);
  return { viewProjection, pixelsPerUnit };
}

/**
 * Point de l'écran → point du monde. `point` et `viewport` doivent être dans la même unité
 * (pixels CSS ou physiques), avec l'origine en haut à gauche du canvas.
 */
export function screenToWorld(point: Vec2, viewport: Viewport, worldHeight: number): Vec2 {
  const unitsPerPixel = worldHeight / viewport.height;
  return {
    x: (point.x - viewport.width / 2) * unitsPerPixel,
    y: (viewport.height / 2 - point.y) * unitsPerPixel,
  };
}

/** Distance à l'écran → distance dans le monde (ex. rayon de la zone tactile d'une poignée). */
export function pixelsToWorld(pixels: number, viewportHeight: number, worldHeight: number): number {
  return (pixels * worldHeight) / viewportHeight;
}
