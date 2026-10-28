// Lecteur : tant que la Session est en lecture, avance la tête de lecture au rythme
// IPS × vitesse, autant de passages que la Répétition l'indique. Sans DOM : l'horloge et le
// planificateur sont injectables.

import type { AppEventBus } from '../core/events';
import { activeFrame, sequenceOf } from '../core/selectors';
import type { Store } from '../core/store';
import { advancePlayback, frameDuration, type PlaybackState } from './playback';

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
  let playback: PlaybackState = { index: 0, carryMs: 0, pass: 0 };
  /** Frame active au lancement de la lecture, pour y revenir sur Stop. */
  let origin = 0;

  /** Répétition coupée : un passage ; infinie : sans fin ; sinon le nombre de répétitions. */
  function maxPasses(): number {
    const { loop } = store.state.project.present.ai;
    if (!loop.enabled) return 1;
    return loop.infinite ? Infinity : loop.repeatCount;
  }

  function tick(): void {
    const time = now();
    const elapsed = Math.min(time - lastTime, MAX_STEP_MS);
    lastTime = time;

    const { project, session } = store.state;
    const current = activeFrame(store.state)?.index ?? 0;
    const { finished, ...next } = advancePlayback(
      { ...playback, index: current },
      elapsed,
      frameDuration(project.present.fps, session.playbackSpeed),
      sequenceOf(store.state).length,
      maxPasses(),
    );
    playback = next;
    if (next.index !== current) bus.emit('playback:frame', { index: next.index });
    if (finished) {
      bus.emit('playback:pause');
      return;
    }
    request = scheduler.request(tick);
  }

  function start(): void {
    const frameCount = sequenceOf(store.state).length;
    origin = activeFrame(store.state)?.index ?? 0;
    // Lancée depuis la dernière frame, la lecture repart du début (comme un lecteur vidéo).
    if (origin === frameCount - 1 && frameCount > 1) {
      origin = 0;
      bus.emit('playback:frame', { index: 0 });
    }
    playback = { index: origin, carryMs: 0, pass: 0 };
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
