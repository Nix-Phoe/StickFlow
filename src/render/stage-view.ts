// Relie le store au rendu : redessine la scène (décor, personnages, aides d'édition) quand la
// frame active, le Projet, la sélection, le mode, la taille du canvas ou le thème changent.
// Rendu à la demande, pas de boucle continue. Fournit aussi la pipette de secours (lecture d'un pixel).

import { onionSkinFrame } from '../animation/onion-skin';
import type { AppEventBus } from '../core/events';
import { activeFrame, sequenceOf } from '../core/selectors';
import type { Store } from '../core/store';
import { rgbToHex } from '../model/color';
import type { DrawingSurface } from '../drawing/surface';
import { stageWorldHeight } from './camera';
import { parseHexColor, type Rgba } from './color';
import { createStageRenderer } from './renderer';
import { buildSceneLayers } from './scene-layers';

/** Tokens CSS lus par le rendu (voir tokens.css ; ils doivent rester en hexadécimal). */
const COLOR_TOKENS = { stickman: '--color-stickman', accent: '--color-accent', canvas: '--color-canvas' } as const;
const FALLBACK_COLOR: Rgba = [0, 0, 0, 1];

export interface StageViewOptions {
  bus: AppEventBus;
  store: Store;
  canvas: HTMLCanvasElement;
  drawing: DrawingSurface;
}

export function connectStageView({ bus, store, canvas, drawing }: StageViewOptions): () => void {
  let pendingFrame = 0;
  const renderer = createStageRenderer(canvas, { onContextRestored: scheduleDraw });

  function draw(): void {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    const { project, session } = store.state;
    const active = activeFrame(store.state);
    const { background } = project.present.environment;
    const layers = buildSceneLayers({
      project: project.present,
      frame: active?.frame ?? null,
      onion: onionSkinFrame(sequenceOf(store.state), active?.index ?? 0, { enabled: session.onionSkin, isPlaying: session.isPlaying }),
      // Pendant la lecture, la scène est montrée telle qu'elle sera exportée.
      mode: session.isPlaying ? null : session.editorMode,
      selection: session,
      palette: { stickman: readColor(COLOR_TOKENS.stickman), accent: readColor(COLOR_TOKENS.accent) },
    });
    renderer.draw(layers, {
      background: background ? parseHexColor(background) : null,
      drawing,
      worldHeight: stageWorldHeight(canvas, project.present.format),
    });
  }

  function scheduleDraw(): void {
    if (pendingFrame === 0) pendingFrame = requestAnimationFrame(draw);
  }

  function readColor(token: string): Rgba {
    const value = getComputedStyle(canvas).getPropertyValue(token);
    try {
      return parseHexColor(value);
    } catch (error) {
      console.warn(`[render] ${token} :`, error);
      return FALLBACK_COLOR;
    }
  }

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colorScheme.addEventListener('change', scheduleDraw);
  const stopWatchingDrawing = drawing.onChange(scheduleDraw);

  const unsubscribers = [
    store.watch((s) => s.project.present, scheduleDraw),
    store.watch((s) => s.project.present.environment.drawing.tiles, (tiles) => void drawing.sync(tiles)),
    store.watch((s) => s.session.activeFrameId, scheduleDraw),
    store.watch((s) => s.session.selectedCharacterId, scheduleDraw),
    store.watch((s) => s.session.selectedNodeId, scheduleDraw),
    store.watch((s) => s.session.selectedParts, scheduleDraw),
    store.watch((s) => s.session.selectedShapeId, scheduleDraw),
    store.watch((s) => s.session.isPlaying, scheduleDraw),
    store.watch((s) => s.session.editorMode, scheduleDraw),
    store.watch((s) => s.session.onionSkin, scheduleDraw),
    // Redimensionner un canvas l'efface : on redessine tout de suite pour éviter un clignotement.
    bus.on('canvas:resize', draw),
    // Pipette de secours : la couleur du pixel touché, ou celle du fond s'il est transparent.
    bus.on('stage:pointer:down', (pointer) => {
      if (!store.state.session.eyedropper) return;
      const pixel = renderer.readPixel((pointer.x * canvas.width) / pointer.width, (pointer.y * canvas.height) / pointer.height);
      const background = store.state.project.present.environment.background;
      const [r, g, b] = pixel && pixel[3] > 0 ? pixel : background ? parseHexColor(background) : readColor(COLOR_TOKENS.canvas);
      bus.emit('eyedropper:pick', { color: rgbToHex(r * 255, g * 255, b * 255) });
    }),
  ];

  return () => {
    cancelAnimationFrame(pendingFrame);
    colorScheme.removeEventListener('change', scheduleDraw);
    stopWatchingDrawing();
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    renderer.destroy();
  };
}
