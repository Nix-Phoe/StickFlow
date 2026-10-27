import type { Frame } from '../core/types';

/** Frame à afficher en pelure d'oignon : la précédente, hors lecture et si l'option est active. */
export function onionSkinFrame(
  frames: readonly Frame[],
  activeIndex: number,
  { enabled, isPlaying }: { enabled: boolean; isPlaying: boolean },
): Frame | null {
  if (!enabled || isPlaying) return null;
  return frames[activeIndex - 1] ?? null;
}
