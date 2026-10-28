// Lectures dérivées de l'état, partagées par l'interface, le rendu et les contrôleurs.

import { deriveSequence, type SequenceFrame } from '../model/sequence';
import type { AppState } from './store';

/** Séquence affichée et jouée (images clés + frames générées). Même tableau tant qu'elle ne change pas. */
export function sequenceOf(state: Readonly<AppState>): readonly SequenceFrame[] {
  return deriveSequence(state.project.present);
}

/** Frame active et sa position dans la séquence (la première si l'id n'y est pas). */
export function activeFrame(state: Readonly<AppState>): { frame: SequenceFrame; index: number } | null {
  const sequence = sequenceOf(state);
  const found = sequence.findIndex((frame) => frame.id === state.session.activeFrameId);
  const index = found === -1 ? 0 : found;
  const frame = sequence[index];
  return frame ? { frame, index } : null;
}
