// Outils de dessin sur le calque matriciel (mode Environnement) : peint les tampons du trait en
// direct sur le calque, puis, au relâchement, enregistre les tuiles touchées en une seule étape
// d'annulation. Gère aussi le remplissage par diffusion. Navigateur uniquement (Canvas 2D).

import type { AppEventBus, StagePointer } from '../core/events';
import type { Store } from '../core/store';
import { DRAWING_TOOLS, type DrawingTool, type Vec2 } from '../core/types';
import { hexToRgb } from '../model/color';
import { DRAWING_LAYER, tilesInRect, worldToLayer, type PixelRect } from '../model/drawing-layer';
import { screenToWorld, STAGE_WORLD_HEIGHT } from '../render/camera';
import { createStroke, dabsBounds, type Dab, type Stroke } from './brush';
import { floodFill } from './flood-fill';
import type { DrawingSurface } from './surface';

/** Écart de couleur toléré par le pot de peinture (bords anticrénelés des traits). */
const FILL_TOLERANCE = 48;
/** Marge autour des tampons, pour l'anticrénelage du Canvas 2D. */
const DAB_MARGIN = 2;

export interface DrawingToolOptions {
  bus: AppEventBus;
  store: Store;
  surface: DrawingSurface;
  now?: () => number;
}

export function connectDrawingTool({ bus, store, surface, now = () => performance.now() }: DrawingToolOptions): () => void {
  const { context } = surface;
  // Le trait en cours, à pleine opacité : il est composé avec le calque d'origine à chaque tampon,
  // pour que l'opacité s'applique au trait entier (sans surépaisseur là où les tampons se chevauchent).
  const strokeCanvas = document.createElement('canvas');
  strokeCanvas.width = DRAWING_LAYER.width;
  strokeCanvas.height = DRAWING_LAYER.height;
  const strokeContext = strokeCanvas.getContext('2d');

  let active: {
    pointerId: number;
    stroke: Stroke;
    color: string;
    opacity: number;
    base: ImageData;
    bounds: PixelRect | null;
  } | null = null;

  const toLayer = (pointer: StagePointer): Vec2 => worldToLayer(screenToWorld(pointer, pointer, STAGE_WORLD_HEIGHT));

  function paint(dabs: Dab[]): void {
    if (!active || !strokeContext || dabs.length === 0) return;
    const rect = dabsBounds(dabs);
    if (!rect) return;
    const region = clip({ x: rect.x - DAB_MARGIN, y: rect.y - DAB_MARGIN, width: rect.width + 2 * DAB_MARGIN, height: rect.height + 2 * DAB_MARGIN });
    if (!region) return;
    active.bounds = active.bounds ? union(active.bounds, region) : region;

    if (active.stroke.accumulates) {
      // Aérographe : chaque goutte se dépose directement, avec sa propre opacité.
      context.fillStyle = active.color;
      for (const dab of dabs) {
        context.globalAlpha = dab.alpha;
        disc(context, dab);
      }
      context.globalAlpha = 1;
    } else {
      strokeContext.fillStyle = active.color;
      dabs.forEach((dab) => disc(strokeContext, dab));
      // Recompose la zone : calque d'origine, puis trait entier à son opacité (ou gommé).
      context.putImageData(active.base, 0, 0, region.x, region.y, region.width, region.height);
      context.save();
      context.globalAlpha = active.opacity;
      context.globalCompositeOperation = active.stroke.erases ? 'destination-out' : 'source-over';
      context.drawImage(strokeCanvas, region.x, region.y, region.width, region.height, region.x, region.y, region.width, region.height);
      context.restore();
    }
    surface.markDirty(region);
  }

  function onDown(pointer: StagePointer): void {
    const { session } = store.state;
    if (active || session.isPlaying || session.eyedropper || session.editorMode !== 'environment') return;
    if (!DRAWING_TOOLS.includes(session.tool as DrawingTool) || !strokeContext) return;
    strokeContext.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    const { color, opacity, strokeWidth } = session.toolSettings;
    active = {
      pointerId: pointer.pointerId,
      stroke: createStroke(session.tool as DrawingTool, { strokeWidth, opacity }),
      color,
      opacity,
      base: context.getImageData(0, 0, DRAWING_LAYER.width, DRAWING_LAYER.height),
      bounds: null,
    };
    paint(active.stroke.add({ ...toLayer(pointer), time: now(), pressure: pointer.pressure ?? 0.5 }));
  }

  function onMove(pointer: StagePointer): void {
    if (!active || pointer.pointerId !== active.pointerId) return;
    paint(active.stroke.add({ ...toLayer(pointer), time: now(), pressure: pointer.pressure ?? 0.5 }));
  }

  function onUp(pointer: StagePointer): void {
    if (!active || pointer.pointerId !== active.pointerId) return;
    const { bounds } = active;
    active = null;
    if (bounds) commit(bounds);
  }

  /** Enregistre les tuiles d'une zone repeinte : une étape d'annulation. */
  function commit(rect: PixelRect): void {
    const tiles = surface.encodeTiles(tilesInRect(rect));
    if (Object.keys(tiles).length > 0) bus.emit('drawing:stroke', { tiles });
  }

  function fill(point: Vec2): void {
    const { color, opacity } = store.state.session.toolSettings;
    const pixel = worldToLayer(point);
    const image = context.getImageData(0, 0, DRAWING_LAYER.width, DRAWING_LAYER.height);
    const rect = floodFill(image.data, image.width, image.height, pixel.x, pixel.y, [...hexToRgb(color), Math.round(opacity * 255)], FILL_TOLERANCE);
    if (!rect) return;
    context.putImageData(image, 0, 0, rect.x, rect.y, rect.width, rect.height);
    surface.markDirty(rect);
    commit(rect);
  }

  const unsubscribers = [
    bus.on('stage:pointer:down', onDown),
    bus.on('stage:pointer:move', onMove),
    bus.on('stage:pointer:up', onUp),
    bus.on('drawing:fill', ({ point }) => fill(point)),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

function disc(context: CanvasRenderingContext2D, { x, y, radius }: Dab): void {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fill();
}

function clip(rect: PixelRect): PixelRect | null {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const right = Math.min(DRAWING_LAYER.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(DRAWING_LAYER.height, Math.ceil(rect.y + rect.height));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

function union(a: PixelRect, b: PixelRect): PixelRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}
