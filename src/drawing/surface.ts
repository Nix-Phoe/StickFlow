// Calque de dessin en mémoire : un canvas à la taille du calque, tenu à jour à partir des tuiles
// du Projet (PNG en data URL), et qui sait réencoder les tuiles touchées par un trait.
// Navigateur uniquement (Canvas 2D, décodage d'images).

import { DRAWING_LAYER, DRAWING_LAYER_WORLD, tileRect, type PixelRect } from '../model/drawing-layer';
import type { DrawingSource } from '../render/renderer';

export interface DrawingSurface extends DrawingSource {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  /** Affiche les tuiles du Projet ; seules celles qui ont changé sont décodées. */
  sync(tiles: Readonly<Record<string, string>>): Promise<void>;
  /** Signale une zone repeinte directement sur le canvas (trait en cours). */
  markDirty(rect: PixelRect): void;
  /**
   * Encode les tuiles données en PNG (`null` pour une tuile entièrement transparente) et
   * retient qu'elles sont désormais à jour, pour ne pas les redécoder au retour du Projet.
   */
  encodeTiles(keys: readonly string[]): Record<string, string | null>;
  /** Appelé après chaque changement visible du calque. */
  onChange(listener: () => void): () => void;
}

export function createDrawingSurface(): DrawingSurface {
  const canvas = document.createElement('canvas');
  canvas.width = DRAWING_LAYER.width;
  canvas.height = DRAWING_LAYER.height;
  const context2d = canvas.getContext('2d', { willReadFrequently: true });
  if (!context2d) throw new Error('Canvas 2D indisponible');
  const context: CanvasRenderingContext2D = context2d;

  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileCanvas.height = DRAWING_LAYER.tileSize;
  const tileContext = tileCanvas.getContext('2d', { willReadFrequently: true });
  if (!tileContext) throw new Error('Canvas 2D indisponible');

  /** Contenu actuellement affiché de chaque tuile peinte. */
  const shown = new Map<string, string>();
  /** Contenu voulu de chaque tuile, pour ignorer un décodage arrivé trop tard. */
  const wanted = new Map<string, string | undefined>();
  const listeners = new Set<() => void>();
  let dirty: PixelRect | null = null;

  const notify = (): void => listeners.forEach((listener) => listener());

  function markDirty(rect: PixelRect): void {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(canvas.width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(canvas.height, Math.ceil(rect.y + rect.height));
    if (right <= x || bottom <= y) return;
    dirty = dirty
      ? {
          x: Math.min(dirty.x, x),
          y: Math.min(dirty.y, y),
          width: Math.max(dirty.x + dirty.width, right) - Math.min(dirty.x, x),
          height: Math.max(dirty.y + dirty.height, bottom) - Math.min(dirty.y, y),
        }
      : { x, y, width: right - x, height: bottom - y };
  }

  async function showTile(key: string, data: string | undefined): Promise<void> {
    wanted.set(key, data);
    const rect = tileRect(key);
    const image = data === undefined ? null : await decode(data);
    if (wanted.get(key) !== data) return;
    context.clearRect(rect.x, rect.y, rect.width, rect.height);
    if (image) context.drawImage(image, rect.x, rect.y);
    if (data === undefined) shown.delete(key);
    else shown.set(key, data);
    markDirty(rect);
    notify();
  }

  return {
    canvas,
    context,
    bounds: DRAWING_LAYER_WORLD,
    takeDirty() {
      const rect = dirty;
      dirty = null;
      return rect;
    },
    markAllDirty() {
      dirty = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    },
    markDirty(rect) {
      markDirty(rect);
      notify();
    },
    async sync(tiles) {
      const keys = new Set([...shown.keys(), ...wanted.keys(), ...Object.keys(tiles)]);
      // Une tuile est à refaire si elle diffère de ce qui est affiché, ou de ce qui est en cours de décodage.
      const stale = [...keys].filter((key) => tiles[key] !== shown.get(key) || tiles[key] !== wanted.get(key));
      await Promise.all(stale.map((key) => showTile(key, tiles[key])));
    },
    encodeTiles(keys) {
      const encoded: Record<string, string | null> = {};
      for (const key of keys) {
        const rect = tileRect(key);
        tileContext.clearRect(0, 0, rect.width, rect.height);
        tileContext.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        const pixels = tileContext.getImageData(0, 0, rect.width, rect.height).data;
        let empty = true;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] !== 0) {
            empty = false;
            break;
          }
        }
        const data = empty ? null : tileCanvas.toDataURL('image/png');
        encoded[key] = data;
        wanted.set(key, data ?? undefined);
        if (data === null) shown.delete(key);
        else shown.set(key, data);
      }
      return encoded;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function decode(data: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // Une tuile illisible est laissée transparente plutôt que de bloquer tout le calque.
    image.onerror = () => resolve(null);
    image.src = data;
  });
}
