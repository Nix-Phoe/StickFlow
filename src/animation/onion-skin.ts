/** Frame à afficher en pelure d'oignon : la précédente dans la séquence, hors lecture et si l'option est active. */
export function onionSkinFrame<Frame>(
  frames: readonly Frame[],
  activeIndex: number,
  { enabled, isPlaying }: { enabled: boolean; isPlaying: boolean },
): Frame | null {
  if (!enabled || isPlaying) return null;
  return frames[activeIndex - 1] ?? null;
}
