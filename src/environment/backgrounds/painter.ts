// Outils communs des arrière-plans intégrés : signature d'une fonction de dessin, hasard reproductible.

/**
 * Dessine un arrière-plan intégré sur toute la zone `width` × `height` (le cadre du format). Les
 * dimensions sont relatives : le même dessin à toutes les tailles, sans image externe.
 */
export type BackgroundPainter = (context: CanvasRenderingContext2D, width: number, height: number) => void;

/** Nombres pseudo-aléatoires reproductibles (mulberry32) : un arrière-plan est le même à chaque rendu. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Remplit toute la zone d'un dégradé vertical (haut → bas), aux arrêts donnés. */
export function verticalGradient(context: CanvasRenderingContext2D, width: number, height: number, stops: ReadonlyArray<[number, string]>): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}
