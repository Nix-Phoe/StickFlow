// Arrière-plan composé (v2.1) : un canvas à la taille du cadre du format, repeint seulement quand
// l'arrière-plan ou le format changent (jamais à chaque image), puis utilisé comme texture WebGL
// (scène), et dessiné tel quel dans les vignettes et l'export. Navigateur uniquement.

import type { VideoFormat } from '../core/formats';
import type { Background } from '../core/types';
import { frameWorldSize } from '../model/format-fit';
import type { DrawingImage } from '../render/canvas2d';
import type { AssetImages } from './asset-images';
import { backgroundCanvasSize } from './background-layout';
import { paintBackground } from './paint-background';

/** Long côté du canvas de l'éditeur : assez net pour l'écran, raisonnable pour le GPU. */
export const EDITOR_BACKGROUND_SIZE = 2048;

export interface BackgroundSurface {
  canvas: HTMLCanvasElement;
  /** Rectangle du cadre dans le monde (coin bas-gauche, taille). */
  bounds: DrawingImage['bounds'];
  /** Incrémenté à chaque nouvelle composition (la texture WebGL n'est renvoyée qu'alors). */
  readonly version: number;
  /** L'arrière-plan composé, ou `null` sans arrière-plan (celui du thème). */
  image(): DrawingImage | null;
  /** Compose `background` pour `format` ; une image est d'abord décodée (l'ancien reste affiché en attendant). */
  sync(background: Background | null, format: VideoFormat): Promise<void>;
  onChange(listener: () => void): () => void;
  destroy(): void;
}

export function createBackgroundSurface(images: AssetImages, maxSide = EDITOR_BACKGROUND_SIZE): BackgroundSurface {
  const canvas = document.createElement('canvas');
  const listeners = new Set<() => void>();
  let active = false;
  let version = 0;
  let shown = '';
  let request = 0;
  const surface: BackgroundSurface = {
    canvas,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    get version() {
      return version;
    },
    image: () => (active ? { image: canvas, bounds: surface.bounds } : null),
    async sync(background, format) {
      const key = JSON.stringify([background, format, maxSide]);
      if (key === shown) return;
      const ticket = ++request;
      const image = await imageOf(background, images);
      // Une composition plus récente a été demandée pendant le décodage : celle-ci est abandonnée.
      if (ticket !== request) return;
      shown = key;
      active = paintComposition(background, format, image, maxSide, canvas);
      const world = frameWorldSize(format);
      surface.bounds = { x: -world.width / 2, y: -world.height / 2, width: world.width, height: world.height };
      version += 1;
      listeners.forEach((listener) => listener());
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      request += 1;
      listeners.clear();
      canvas.width = canvas.height = 0;
    },
  };
  return surface;
}

/**
 * Compose `background` dans `target` (un nouveau canvas par défaut), au rapport du format, son
 * long côté à `maxSide` au plus ; `null` sans arrière-plan. Sert aussi à l'export (pleine résolution).
 */
export async function composeBackground(
  background: Background | null,
  format: VideoFormat,
  images: AssetImages,
  maxSide = Infinity,
  target: HTMLCanvasElement = document.createElement('canvas'),
): Promise<HTMLCanvasElement | null> {
  const image = await imageOf(background, images);
  return paintComposition(background, format, image, maxSide, target) ? target : null;
}

function imageOf(background: Background | null, images: AssetImages): Promise<ImageBitmap | null> {
  return background?.type === 'image' ? images.load(background.assetId) : Promise.resolve(null);
}

/** Peint la composition ; `false` sans arrière-plan (ou sans Canvas 2D). */
function paintComposition(
  background: Background | null,
  format: VideoFormat,
  image: ImageBitmap | null,
  maxSide: number,
  target: HTMLCanvasElement,
): boolean {
  if (!background) return false;
  const size = backgroundCanvasSize(format, maxSide);
  target.width = size.width;
  target.height = size.height;
  const context = target.getContext('2d');
  if (!context) return false;
  paintBackground(context, background, size, { image, scale: size.width / format.width });
  return true;
}
