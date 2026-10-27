// Vignette d'une frame (Canvas 2D) : même cadrage vertical que la scène, traits plus épais
// pour rester lisibles en petit. Réutilise la cinématique et la géométrie du rendu principal.

import type { FramePose, SkeletonNode } from '../core/types';
import { solvePose } from '../model/kinematics';
import { STAGE_WORLD_HEIGHT, worldToScreen } from './camera';
import { buildCapsules, type StickmanStyle } from './scene';

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

  const viewport = { width, height };
  const scale = height / STAGE_WORLD_HEIGHT;
  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineCap = 'round';

  const posed = solvePose(skeleton, frame.pose, frame.rootPosition);
  for (const capsule of buildCapsules(skeleton, posed, THUMBNAIL_STYLE)) {
    const a = worldToScreen(capsule.a, viewport, STAGE_WORLD_HEIGHT);
    const b = worldToScreen(capsule.b, viewport, STAGE_WORLD_HEIGHT);
    const radius = capsule.radius * scale;
    context.beginPath();
    if (a.x === b.x && a.y === b.y) {
      context.arc(a.x, a.y, radius, 0, 2 * Math.PI);
      context.fill();
    } else {
      context.lineWidth = 2 * radius;
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }
}
