import type { AppEventBus } from './events';
import { createPlaceholderFrame, type Store } from './store';
import { clamp, LIMITS } from './types';

/**
 * Traduit les intentions émises par l'UI en changements d'état.
 * Les événements sans effet sur l'état (annuler, sauvegarder, exporter…)
 * seront pris en charge par leurs modules dans les phases suivantes.
 */
export function connectIntents(bus: AppEventBus, store: Store): () => void {
  const unsubscribers = [
    bus.on('playback:play', () => store.update({ isPlaying: true })),
    bus.on('playback:pause', () => store.update({ isPlaying: false })),
    bus.on('playback:speed:change', ({ speed }) => store.update({ playbackSpeed: speed })),

    bus.on('frame:select', ({ index }) =>
      store.update((s) => ({ activeFrameIndex: clamp(index, 0, s.frames.length - 1) })),
    ),
    // Phase 1 : ajoute une frame factice. La vraie logique (et l'historique) arrive en phase 4.
    bus.on('frame:add', () =>
      store.update((s) => ({
        frames: [...s.frames, createPlaceholderFrame()],
        activeFrameIndex: s.frames.length,
      })),
    ),

    bus.on('editor:mode:change', ({ mode }) => store.update({ editorMode: mode })),

    bus.on('ai:smoothing:change', (changes) =>
      store.update((s) => ({ ai: { ...s.ai, smoothing: { ...s.ai.smoothing, ...changes } } })),
    ),
    bus.on('ai:loop:change', (changes) =>
      store.update((s) => ({ ai: { ...s.ai, loop: { ...s.ai.loop, ...changes } } })),
    ),

    bus.on('animation:fps:change', ({ fps }) =>
      store.update({ fps: clamp(Math.round(fps), LIMITS.fps.min, LIMITS.fps.max) }),
    ),

    bus.on('export:format:change', ({ format }) => store.update({ exportFormat: format })),

    bus.on('ui:drawer:toggle', ({ open }) => store.update({ drawerOpen: open })),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
