// Vignette d'une frame : tous les personnages visibles, d'une seule couleur, avec des traits
// plus épais que sur la scène pour rester lisibles en petit.

import type { Character, FramePose } from '../core/types';
import { paintCharacters } from './canvas2d';
import { parseHexColor } from './color';
import type { StickmanStyle } from './scene';

const THUMBNAIL_STYLE: StickmanStyle = { strokeWidth: 16 };

/** Dessine les poses dans `canvas`, à sa taille affichée (pixels physiques). `color` : couleur HEX. */
export function paintThumbnail(
  canvas: HTMLCanvasElement,
  characters: readonly Character[],
  poses: Readonly<Record<string, FramePose>>,
  color: string,
): void {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  const context = canvas.getContext('2d');
  if (!context || width === 0 || height === 0) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  context.clearRect(0, 0, width, height);
  paintCharacters(context, { width, height }, characters, poses, THUMBNAIL_STYLE, parseHexColor(color));
}
