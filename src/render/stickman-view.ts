// Relie le store au rendu : redessine la frame active quand elle, le squelette,
// la taille du canvas ou le thème changent. Rendu à la demande, pas de boucle continue.

import type { AppEventBus } from '../core/events';
import type { Store } from '../core/store';
import type { Vec2 } from '../core/types';
import { solvePose } from '../model/kinematics';
import { parseHexColor, type Rgba } from './color';
import { createStageRenderer } from './renderer';
import { buildCapsules, DEFAULT_STICKMAN_STYLE } from './scene';

const ORIGIN: Vec2 = { x: 0, y: 0 };
/** Token CSS de la couleur du stickman (voir tokens.css). */
const STICKMAN_COLOR_TOKEN = '--color-stickman';
const FALLBACK_COLOR: Rgba = [0, 0, 0, 1];

export interface StickmanViewOptions {
  bus: AppEventBus;
  store: Store;
  canvas: HTMLCanvasElement;
}

export function connectStickmanView({ bus, store, canvas }: StickmanViewOptions): () => void {
  let pendingFrame = 0;
  const renderer = createStageRenderer(canvas, { onContextRestored: scheduleDraw });

  function draw(): void {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    const { skeleton, frames, activeFrameIndex } = store.state;
    const frame = frames[activeFrameIndex];
    const posed = solvePose(skeleton, frame?.pose ?? {}, frame?.rootPosition ?? ORIGIN);
    renderer.draw({
      capsules: buildCapsules(skeleton, posed, DEFAULT_STICKMAN_STYLE),
      color: readStickmanColor(canvas),
    });
  }

  function scheduleDraw(): void {
    if (pendingFrame === 0) pendingFrame = requestAnimationFrame(draw);
  }

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colorScheme.addEventListener('change', scheduleDraw);

  const unsubscribers = [
    store.watch((s) => s.skeleton, scheduleDraw),
    store.watch((s) => s.frames, scheduleDraw),
    store.watch((s) => s.activeFrameIndex, scheduleDraw),
    // Redimensionner un canvas l'efface : on redessine tout de suite pour éviter un clignotement.
    bus.on('canvas:resize', draw),
  ];

  return () => {
    cancelAnimationFrame(pendingFrame);
    colorScheme.removeEventListener('change', scheduleDraw);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    renderer.destroy();
  };
}

function readStickmanColor(canvas: HTMLCanvasElement): Rgba {
  const value = getComputedStyle(canvas).getPropertyValue(STICKMAN_COLOR_TOKEN);
  try {
    return parseHexColor(value);
  } catch (error) {
    console.warn(`[render] ${STICKMAN_COLOR_TOKEN} :`, error);
    return FALLBACK_COLOR;
  }
}
