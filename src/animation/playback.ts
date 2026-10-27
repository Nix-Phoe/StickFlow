// Horloge de lecture : combien de frames avancer pour un temps écoulé donné. Pur.

export interface Playhead {
  index: number;
  /** Temps accumulé depuis le dernier changement de frame, en millisecondes. */
  carryMs: number;
}

/** Durée d'affichage d'une frame, en millisecondes. */
export function frameDuration(fps: number, speed: number): number {
  return 1000 / (fps * speed);
}

/** Avance la tête de lecture de `elapsedMs`, en bouclant sur `frameCount` frames. */
export function advancePlayhead(playhead: Playhead, elapsedMs: number, durationMs: number, frameCount: number): Playhead {
  const total = playhead.carryMs + elapsedMs;
  const steps = Math.floor(total / durationMs);
  return {
    index: (((playhead.index + steps) % frameCount) + frameCount) % frameCount,
    carryMs: total - steps * durationMs,
  };
}
