// Relie le store au rendu : redessine la frame active quand elle, le squelette, la sélection,
// la taille du canvas ou le thème changent. Rendu à la demande, pas de boucle continue.

import { onionSkinFrame } from '../animation/onion-skin';
import type { AppEventBus } from '../core/events';
import { activeFrame, sequenceOf } from '../core/selectors';
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
const ONION_SKIN_OPACITY = 0.22;
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
    const { skeleton } = store.state.project.present;
    const { selectedNodeId, isPlaying, editorMode, onionSkin } = store.state.session;
    const sequence = sequenceOf(store.state);
    const active = activeFrame(store.state);
    const frame = active?.frame;
    const posed = solvePose(skeleton, frame?.pose ?? {}, frame?.rootPosition ?? ORIGIN);
    const stickmanColor = readColor(canvas, COLOR_TOKENS.stickman);
    const stickman: DrawLayer = { capsules: buildCapsules(skeleton, posed, DEFAULT_STICKMAN_STYLE), color: stickmanColor };

    // Pelure d'oignon : la frame précédente, en transparence, sous tout le reste.
    const previous = onionSkinFrame(sequence, active?.index ?? 0, { enabled: onionSkin, isPlaying });
    const onion: DrawLayer = {
      capsules: previous
        ? buildCapsules(skeleton, solvePose(skeleton, previous.pose, previous.rootPosition), DEFAULT_STICKMAN_STYLE)
        : [],
      color: withOpacity(stickmanColor, ONION_SKIN_OPACITY),
    };

    // Les poignées ne s'affichent qu'en édition du personnage, jamais pendant la lecture.
    if (isPlaying || editorMode !== 'character') {
      renderer.draw([onion, stickman]);
      return;
    }

    const handles = buildHandles(skeleton, posed, selectedNodeId, DEFAULT_HANDLE_STYLE);
    const accent = readColor(canvas, COLOR_TOKENS.handle);
    renderer.draw([
      onion,
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
    store.watch((s) => s.project.present.skeleton, scheduleDraw),
    store.watch(sequenceOf, scheduleDraw),
    store.watch((s) => s.session.activeFrameId, scheduleDraw),
    store.watch((s) => s.session.selectedNodeId, scheduleDraw),
    store.watch((s) => s.session.isPlaying, scheduleDraw),
    store.watch((s) => s.session.editorMode, scheduleDraw),
    store.watch((s) => s.session.onionSkin, scheduleDraw),
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
