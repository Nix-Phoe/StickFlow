// Préférences de l'appareil (tri, vue, thème, format et IPS par défaut) : stockage local du
// navigateur, ou mémoire (tests, stockage bloqué). La validation est faite par home-state.ts.

export interface PreferencesStore {
  /** Valeur enregistrée, non vérifiée ; `undefined` s'il n'y en a pas. */
  load(): unknown;
  save(value: unknown): void;
}

const KEY = 'stickflow:preferences';

/** `localStorage` peut manquer ou lever une exception (navigation privée, site bloqué) : on l'ignore alors. */
export function createLocalPreferences(): PreferencesStore {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        return raw === null ? undefined : JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    save(value) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(value));
      } catch {
        // Préférences non mémorisées : l'app fonctionne quand même.
      }
    },
  };
}

export function createMemoryPreferences(initial?: unknown): PreferencesStore {
  let value = initial;
  return {
    load: () => value,
    save: (next) => {
      value = structuredClone(next);
    },
  };
}
