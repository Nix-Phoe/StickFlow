// Vignette d'une frame : traits plus épais que sur la scène pour rester lisibles en petit.

import type { FramePose, SkeletonNode } from '../core/types';
import { paintPose } from './canvas2d';
import type { StickmanStyle } from './scene';

const THUMBNAIL_STYLE: StickmanStyle = { strokeWidth: 16 };

/** Dessine la pose dans `canvas`, à sa taille affichée (pixels physiques). `color` : couleur CSS. */
export function paintThumbnail(
  canvas: HTMLCanvasElement,
  skeleton: readonly SkeletonNode[],
  frame: FramePose,
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
  paintPose(context, { width, height }, skeleton, frame, THUMBNAIL_STYLE, color);
}
