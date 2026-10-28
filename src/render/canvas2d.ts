// Dessin d'une pose en Canvas 2D (vignettes de la timeline, export). Même géométrie que le
// rendu WebGL de la scène (capsules), même cadrage vertical (STAGE_WORLD_HEIGHT).

import type { FramePose, SkeletonNode } from '../core/types';
import { solvePose } from '../model/kinematics';
import { STAGE_WORLD_HEIGHT, worldToScreen, type Viewport } from './camera';
import { buildCapsules, type StickmanStyle } from './scene';

/** Dessine la pose dans `context`, sur une zone de `viewport` pixels, avec la couleur CSS `color`. */
export function paintPose(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  skeleton: readonly SkeletonNode[],
  frame: FramePose,
  style: StickmanStyle,
  color: string,
): void {
  const scale = viewport.height / STAGE_WORLD_HEIGHT;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineCap = 'round';

  const posed = solvePose(skeleton, frame.pose, frame.rootPosition);
  for (const capsule of buildCapsules(skeleton, posed, style)) {
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
