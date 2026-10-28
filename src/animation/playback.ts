// Horloge de lecture : combien de frames avancer pour un temps écoulé donné. Pur.

export interface PlaybackState {
  index: number;
  /** Temps accumulé depuis le dernier changement de frame, en millisecondes. */
  carryMs: number;
  /** Passages complets déjà joués. */
  pass: number;
}

/** Durée d'affichage d'une frame, en millisecondes. */
export function frameDuration(fps: number, speed: number): number {
  return 1000 / (fps * speed);
}

/**
 * Avance la tête de lecture de `elapsedMs` en bouclant sur `frameCount` frames et en comptant
 * les passages : au-delà de la dernière frame du dernier passage (`maxPasses`, `Infinity` pour
 * une boucle sans fin), la lecture s'arrête sur la dernière frame.
 */
export function advancePlayback(
  state: PlaybackState,
  elapsedMs: number,
  durationMs: number,
  frameCount: number,
  maxPasses: number,
): PlaybackState & { finished: boolean } {
  const total = state.carryMs + elapsedMs;
  const steps = Math.floor(total / durationMs);
  const position = state.pass * frameCount + state.index + steps;
  if (position > maxPasses * frameCount - 1) {
    return { index: frameCount - 1, carryMs: 0, pass: maxPasses, finished: true };
  }
  return {
    index: position % frameCount,
    carryMs: total - steps * durationMs,
    pass: Math.floor(position / frameCount),
    finished: false,
  };
}
