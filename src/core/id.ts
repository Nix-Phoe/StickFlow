let fallbackCounter = 0;

/** Identifiant unique pour les frames, nœuds, etc. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackCounter}`;
}
