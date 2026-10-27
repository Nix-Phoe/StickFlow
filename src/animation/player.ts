// Lecteur : tant que la Session est en lecture, avance la tête de lecture au rythme
// IPS × vitesse, en boucle. Sans DOM : l'horloge et le planificateur sont injectables.

import type { AppEventBus } from '../core/events';
import type { Store } from '../core/store';
import { advancePlayhead, frameDuration, type Playhead } from './playback';

/** Plus grand saut de temps pris en compte entre deux images (onglet masqué, ralentissement). */
export const MAX_STEP_MS = 250;

export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(id: number): void;
}

export interface PlayerOptions {
  bus: AppEventBus;
  store: Store;
  scheduler?: FrameScheduler;
  /** Horloge en millisecondes. */
  now?: () => number;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

export function connectPlayer({
  bus,
  store,
  scheduler = browserScheduler,
  now = () => performance.now(),
}: PlayerOptions): () => void {
  let request = 0;
  let lastTime = 0;
  let playhead: Playhead = { index: 0, carryMs: 0 };
  /** Frame active au lancement de la lecture, pour y revenir sur Stop. */
  let origin = 0;

  function tick(): void {
    const time = now();
    const elapsed = Math.min(time - lastTime, MAX_STEP_MS);
    lastTime = time;

    const { project, session } = store.state;
    playhead = advancePlayhead(
      { index: session.activeFrameIndex, carryMs: playhead.carryMs },
      elapsed,
      frameDuration(project.present.fps, session.playbackSpeed),
      project.present.frames.length,
    );
    if (playhead.index !== session.activeFrameIndex) bus.emit('playback:frame', { index: playhead.index });
    request = scheduler.request(tick);
  }

  function start(): void {
    origin = store.state.session.activeFrameIndex;
    playhead = { index: origin, carryMs: 0 };
    lastTime = now();
    request = scheduler.request(tick);
  }

  function halt(): void {
    scheduler.cancel(request);
    request = 0;
  }

  const unsubscribers = [
    store.watch(
      (s) => s.session.isPlaying,
      (isPlaying) => (isPlaying ? start() : halt()),
    ),
    bus.on('playback:stop', () => {
      const wasPlaying = store.state.session.isPlaying;
      bus.emit('playback:pause');
      if (wasPlaying) bus.emit('frame:select', { index: origin });
    }),
  ];

  return () => {
    halt();
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
