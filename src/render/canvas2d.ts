// Dessin de la scène en Canvas 2D (vignettes de la timeline, export). Mêmes couches et même
// géométrie que le rendu WebGL (scene-layers.ts) ; le cadrage vertical est donné par `worldHeight`.

import { triangleVertices } from '../model/shape';
import { STAGE_WORLD_HEIGHT, worldToScreen, type Viewport } from './camera';
import type { Rgba } from './color';
import type { CapsuleClip, ColoredCapsule, ShapeInstance } from './scene';
import type { SceneLayer } from './scene-layers';

/** Zone de dessin en pixels, et hauteur du monde qu'elle montre (STAGE_WORLD_HEIGHT par défaut). */
export interface PaintViewport extends Viewport {
  worldHeight?: number;
}

const worldHeightOf = (viewport: PaintViewport): number => viewport.worldHeight ?? STAGE_WORLD_HEIGHT;

/** Image du calque de dessin et son rectangle dans le monde (coin bas-gauche, taille). */
export interface DrawingImage {
  image: CanvasImageSource;
  bounds: { x: number; y: number; width: number; height: number };
}

/** Dessine une image posée sur un rectangle du monde (calque de dessin, arrière-plan composé). */
export function paintWorldImage(context: CanvasRenderingContext2D, viewport: PaintViewport, world: DrawingImage, opacity = 1): void {
  const scale = viewport.height / worldHeightOf(viewport);
  const { x, y, width, height } = world.bounds;
  const topLeft = worldToScreen({ x, y: y + height }, viewport, worldHeightOf(viewport));
  context.globalAlpha = opacity;
  context.drawImage(world.image, topLeft.x, topLeft.y, width * scale, height * scale);
  context.globalAlpha = 1;
}

/** Dessine les couches de la scène dans `context`, sur une zone de `viewport` pixels. */
export function paintScene(
  context: CanvasRenderingContext2D,
  viewport: PaintViewport,
  layers: readonly SceneLayer[],
  drawing: DrawingImage | null,
): void {
  for (const layer of layers) {
    if (layer.kind === 'drawing') {
      if (drawing && layer.opacity > 0) paintWorldImage(context, viewport, drawing, layer.opacity);
    } else if (layer.kind === 'shapes') {
      layer.shapes.forEach((shape) => paintShape(context, viewport, shape));
    } else {
      paintCapsules(context, viewport, layer.capsules);
    }
  }
}

export function paintCapsules(context: CanvasRenderingContext2D, viewport: PaintViewport, capsules: readonly ColoredCapsule[]): void {
  const scale = viewport.height / worldHeightOf(viewport);
  context.lineCap = 'round';
  for (const capsule of capsules) {
    const a = worldToScreen(capsule.a, viewport, worldHeightOf(viewport));
    const b = worldToScreen(capsule.b, viewport, worldHeightOf(viewport));
    const radius = capsule.radius * scale;
    const color = cssColor(capsule.color);
    context.save();
    if (capsule.clip) clipBand(context, viewport, capsule.clip, capsule.radius + 1 / scale);
    context.beginPath();
    if (a.x === b.x && a.y === b.y) {
      context.fillStyle = color;
      context.arc(a.x, a.y, radius, 0, 2 * Math.PI);
      context.fill();
    } else {
      context.strokeStyle = color;
      context.lineWidth = 2 * radius;
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    context.restore();
  }
}

/**
 * Découpe d'une zone de couleur : la bande perpendiculaire à l'axe entre `from` et `to`, assez large
 * pour la capsule (`reach`, unités du monde) ; un bout à 0 ou 1 s'étend au-delà, pour garder l'arrondi.
 */
function clipBand(context: CanvasRenderingContext2D, viewport: PaintViewport, clip: CapsuleClip, reach: number): void {
  const dx = clip.end.x - clip.start.x;
  const dy = clip.end.y - clip.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const along = { x: dx / length, y: dy / length };
  const across = { x: -along.y, y: along.x };
  const at = (t: number, side: number): { x: number; y: number } => {
    const distance = t <= 0 ? -reach : t >= 1 ? length + reach : t * length;
    return worldToScreen(
      { x: clip.start.x + along.x * distance + across.x * side * reach, y: clip.start.y + along.y * distance + across.y * side * reach },
      viewport,
      worldHeightOf(viewport),
    );
  };
  const corners = [at(clip.from, -1), at(clip.to, -1), at(clip.to, 1), at(clip.from, 1)];
  context.beginPath();
  corners.forEach((p, i) => (i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y)));
  context.closePath();
  context.clip();
}

function paintShape(context: CanvasRenderingContext2D, viewport: PaintViewport, shape: ShapeInstance): void {
  const scale = viewport.height / worldHeightOf(viewport);
  const center = worldToScreen(shape, viewport, worldHeightOf(viewport));
  const hw = (shape.width / 2) * scale;
  const hh = (shape.height / 2) * scale;
  context.save();
  context.translate(center.x, center.y);
  // L'écran a y vers le bas : la rotation du monde s'inverse.
  context.rotate(-shape.rotation);
  context.beginPath();
  switch (shape.kind) {
    case 'square':
    case 'rectangle':
      context.rect(-hw, -hh, 2 * hw, 2 * hh);
      break;
    case 'circle':
      context.ellipse(0, 0, hw, hh, 0, 0, 2 * Math.PI);
      break;
    case 'triangle': {
      const [a, b, c] = triangleVertices(shape).map((p) => ({ x: p.x * scale, y: -p.y * scale }));
      if (a && b && c) {
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.lineTo(c.x, c.y);
        context.closePath();
      }
      break;
    }
    case 'line':
      context.moveTo(-hw, 0);
      context.lineTo(hw, 0);
      break;
  }
  if (shape.fill) {
    context.fillStyle = cssColor(shape.fill);
    context.fill();
  }
  if (shape.strokeWidth > 0) {
    context.strokeStyle = cssColor(shape.stroke);
    context.lineWidth = shape.strokeWidth * scale;
    context.lineCap = 'round';
    context.lineJoin = 'miter';
    context.stroke();
  }
  context.restore();
}

export function cssColor([r, g, b, a]: Rgba): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}
