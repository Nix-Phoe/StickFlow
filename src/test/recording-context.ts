// Faux contexte Canvas 2D pour les tests (Vitest tourne sans navigateur) : il note chaque appel de
// méthode et chaque propriété modifiée, dans l'ordre.

export type Recorded = { kind: 'call'; name: string; args: unknown[] } | { kind: 'set'; name: string; value: unknown };

export interface RecordingContext {
  context: CanvasRenderingContext2D;
  log: Recorded[];
  /** Noms des méthodes appelées, dans l'ordre. */
  calls(): string[];
  /** Valeurs données successivement à une propriété. */
  values(name: string): unknown[];
}

/** Méthodes des dégradés et des motifs. */
const RECORDED_METHODS = new Set(['addColorStop', 'setTransform']);

export function recordingContext(width: number, height: number): RecordingContext {
  const log: Recorded[] = [];
  const state: Record<string | symbol, unknown> = {
    canvas: { width, height },
    globalAlpha: 1,
    filter: 'none',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
  };
  // Dégradés et motifs : des objets qui notent aussi leurs appels.
  const recorder = (name: string): unknown =>
    new Proxy(
      { kind: name },
      {
        get: (target, key) => {
          if (key in target) return target[key as 'kind'];
          // Seules les vraies méthodes répondent : les autres clés restent absentes, pour comparer les objets.
          if (!RECORDED_METHODS.has(String(key))) return undefined;
          return (...args: unknown[]) => void log.push({ kind: 'call', name: `${name}.${String(key)}`, args });
        },
      },
    );
  const factories: Record<string, string> = {
    createLinearGradient: 'linearGradient',
    createRadialGradient: 'radialGradient',
    createPattern: 'pattern',
  };
  const context = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      const name = String(key);
      return (...args: unknown[]) => {
        log.push({ kind: 'call', name, args });
        const factory = factories[name];
        return factory ? recorder(factory) : undefined;
      };
    },
    set(target, key, value) {
      log.push({ kind: 'set', name: String(key), value });
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return {
    context,
    log,
    calls: () => log.flatMap((entry) => (entry.kind === 'call' ? [entry.name] : [])),
    values: (name) => log.flatMap((entry) => (entry.kind === 'set' && entry.name === name ? [entry.value] : [])),
  };
}
