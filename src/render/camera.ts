// Caméra 2D : du monde (origine au centre, y vers le haut) à l'espace de découpage WebGL.

import { mat3 } from 'gl-matrix';

import { aspectRatio, type VideoFormat } from '../core/formats';
import type { Vec2 } from '../core/types';
import { FRAME_WORLD_HEIGHT } from '../model/format-fit';

/**
 * Hauteur du monde de référence, en unités : celle du cadre de la vidéo (le stickman par défaut
 * en mesure ~210). Aperçus et vignettes de personnages s'en servent aussi.
 */
export const STAGE_WORLD_HEIGHT = FRAME_WORLD_HEIGHT;
/** Marge laissée autour du cadre dans l'éditeur, en fraction de la zone de scène (de chaque côté). */
export const STAGE_FRAME_MARGIN = 0.05;

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

/**
 * Hauteur du monde à montrer pour que le cadre de rapport `aspect` tienne dans `viewport`, avec
 * `margin` (fraction de chaque côté) autour. Sans marge et au bon rapport : exactement le cadre (export).
 */
export function fitWorldHeight(viewport: Viewport, aspect: number, margin = 0): number {
  const frameWidth = FRAME_WORLD_HEIGHT * aspect;
  const needed = Math.max(FRAME_WORLD_HEIGHT, (frameWidth * viewport.height) / (viewport.width || 1));
  return needed / (1 - 2 * margin);
}

/** Hauteur du monde de la scène de l'éditeur : le cadre du format, centré, avec sa marge. */
export function stageWorldHeight(viewport: Viewport, format: VideoFormat): number {
  return fitWorldHeight(viewport, aspectRatio(format), STAGE_FRAME_MARGIN);
}

/** Rectangle du cadre à l'écran (même unité que `viewport`), pour une caméra de hauteur `worldHeight`. */
export function frameScreenRect(
  viewport: Viewport,
  aspect: number,
  worldHeight: number,
): { x: number; y: number; width: number; height: number } {
  const pixelsPerUnit = viewport.height / worldHeight;
  const height = FRAME_WORLD_HEIGHT * pixelsPerUnit;
  const width = height * aspect;
  return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2, width, height };
}

/** Point du monde → point de l'écran (inverse de `screenToWorld`). */
export function worldToScreen(point: Vec2, viewport: Viewport, worldHeight: number): Vec2 {
  const pixelsPerUnit = viewport.height / worldHeight;
  return {
    x: viewport.width / 2 + point.x * pixelsPerUnit,
    y: viewport.height / 2 - point.y * pixelsPerUnit,
  };
}
