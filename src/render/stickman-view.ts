// Relie le store au rendu : redessine la frame active quand elle, le squelette, la sélection,
// la taille du canvas ou le thème changent. Rendu à la demande, pas de boucle continue.

import type { AppEventBus } from '../core/events';
import type { Store } from '../core/store';
import type { Vec2 } from '../core/types';
import { solvePose } from '../model/kinematics';
import { parseHexColor, type Rgba } from './color';
import { createStageRenderer, type DrawLayer } from './renderer';
import { buildCapsules, buildHandles, DEFAULT_HANDLE_STYLE, DEFAULT_STICKMAN_STYLE } from './scene';

const ORIGIN: Vec2 = { x: 0, y: 0 };
/** Tokens CSS lus par le rendu (voir tokens.css ; ils doivent rester en hexadécimal). */
const COLOR_TOKENS = { stickman: '--color-stickman', handle: '--color-accent' } as const;
const FALLBACK_COLOR: Rgba = [0, 0, 0, 1];
const HALO_OPACITY = 0.25;
const JOINT_OPACITY = 0.85;

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
    const { skeleton, frames, activeFrameIndex, selectedNodeId, isPlaying, editorMode } = store.state;
    const frame = frames[activeFrameIndex];
    const posed = solvePose(skeleton, frame?.pose ?? {}, frame?.rootPosition ?? ORIGIN);
    const stickman: DrawLayer = {
      capsules: buildCapsules(skeleton, posed, DEFAULT_STICKMAN_STYLE),
      color: readColor(canvas, COLOR_TOKENS.stickman),
    };

    // Les poignées ne s'affichent qu'en édition du personnage, jamais pendant la lecture.
    if (isPlaying || editorMode !== 'character') {
      renderer.draw([stickman]);
      return;
    }

    const handles = buildHandles(skeleton, posed, selectedNodeId, DEFAULT_HANDLE_STYLE);
    const accent = readColor(canvas, COLOR_TOKENS.handle);
    renderer.draw([
      { capsules: handles.halo, color: withOpacity(accent, HALO_OPACITY) },
      stickman,
      { capsules: handles.joints, color: withOpacity(accent, JOINT_OPACITY) },
      { capsules: handles.root, color: accent },
      { capsules: handles.selected, color: accent },
    ]);
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
    store.watch((s) => s.selectedNodeId, scheduleDraw),
    store.watch((s) => s.isPlaying, scheduleDraw),
    store.watch((s) => s.editorMode, scheduleDraw),
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

function readColor(canvas: HTMLCanvasElement, token: string): Rgba {
  const value = getComputedStyle(canvas).getPropertyValue(token);
  try {
    return parseHexColor(value);
  } catch (error) {
    console.warn(`[render] ${token} :`, error);
    return FALLBACK_COLOR;
  }
}

function withOpacity([r, g, b, a]: Rgba, opacity: number): Rgba {
  return [r, g, b, a * opacity];
}
