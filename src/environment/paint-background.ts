// Composition de l'arrière-plan (v2.1) en Canvas 2D, sur toute la zone du cadre : couleur, dégradé,
// arrière-plan intégré ou image (ajustement, point focal, zoom, flou, luminosité, opacité, voile).
// Calculée une fois quand l'arrière-plan change, puis réutilisée (texture WebGL, vignettes, export).

import type { Background, ImageBackground } from '../core/types';
import { EXPORT_COLORS } from '../render/color';
import { gradientLine, imageLayout, tileLayout } from './background-layout';
import { BUILTIN_BACKGROUNDS } from './backgrounds';

export type BackgroundImageSource = CanvasImageSource & { width: number; height: number };

export interface PaintBackgroundOptions {
  /** Image décodée d'un arrière-plan de type image ; `null` tant qu'elle n'est pas chargée. */
  image: BackgroundImageSource | null;
  /** Pixels de la zone par pixel du format (flou et mosaïque sont donnés en pixels du format). */
  scale: number;
}

/** Peint `background` sur la zone `size` (origine en haut à gauche). */
export function paintBackground(
  context: CanvasRenderingContext2D,
  background: Background,
  size: { width: number; height: number },
  { image, scale }: PaintBackgroundOptions,
): void {
  const { width, height } = size;
  context.save();
  switch (background.type) {
    case 'color':
      context.fillStyle = background.color;
      context.fillRect(0, 0, width, height);
      break;
    case 'gradient': {
      const { x0, y0, x1, y1 } = gradientLine(background.angle, width, height);
      const gradient = context.createLinearGradient(round(x0), round(y0), round(x1), round(y1));
      gradient.addColorStop(0, background.from);
      gradient.addColorStop(1, background.to);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      break;
    }
    case 'builtin':
      BUILTIN_BACKGROUNDS[background.id](context, width, height);
      break;
    case 'image':
      paintImage(context, background, size, image, scale);
      break;
  }
  context.restore();
}

function paintImage(
  context: CanvasRenderingContext2D,
  background: ImageBackground,
  size: { width: number; height: number },
  image: BackgroundImageSource | null,
  scale: number,
): void {
  const { width, height } = size;
  // L'opacité laisse voir le blanc de l'export (le même dans l'éditeur, quel que soit le thème).
  context.fillStyle = EXPORT_COLORS.background;
  context.fillRect(0, 0, width, height);
  if (!image || image.width === 0 || image.height === 0) return;

  const blur = background.blur * scale;
  const filters = [blur > 0 ? `blur(${round(blur)}px)` : '', background.brightness !== 1 ? `brightness(${background.brightness})` : ''];
  const filter = filters.filter(Boolean).join(' ');
  if (filter) context.filter = filter;
  context.globalAlpha = background.opacity;

  if (background.fit === 'tile') {
    const tile = tileLayout(image, size, background.focus, scale, background.zoom);
    const pattern = context.createPattern(image, 'repeat');
    if (pattern) {
      const factor = tile.width / image.width;
      pattern.setTransform({ a: factor, b: 0, c: 0, d: tile.height / image.height, e: tile.offsetX, f: tile.offsetY });
      context.fillStyle = pattern;
      context.fillRect(0, 0, width, height);
    }
  } else {
    const rect = imageLayout(background.fit, image, size, background.focus, background.zoom);
    // Flouté, un bord d'image s'estompe vers le transparent : on l'agrandit d'un peu plus que le flou.
    const bleed = blur > 0 ? 2 * blur : 0;
    // Seuls les bords qui touchent le cadre sont agrandis (une image plus petite garde sa taille).
    const coversX = rect.x <= 0 && rect.x + rect.width >= width;
    const coversY = rect.y <= 0 && rect.y + rect.height >= height;
    const x = coversX ? rect.x - bleed : rect.x;
    const y = coversY ? rect.y - bleed : rect.y;
    const w = coversX ? rect.width + 2 * bleed : rect.width;
    const h = coversY ? rect.height + 2 * bleed : rect.height;
    context.drawImage(image, round(x), round(y), round(w), round(h));
  }

  context.filter = 'none';
  if (background.tint && background.tint.amount > 0) {
    context.globalAlpha = background.tint.amount;
    context.fillStyle = background.tint.color;
    context.fillRect(0, 0, width, height);
  }
  context.globalAlpha = 1;
}

function round(value: number): number {
  // « || 0 » : pas de -0 (arrondi d'un sinus presque nul).
  return Math.round(value * 1000) / 1000 || 0;
}
