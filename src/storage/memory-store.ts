import type { KeyValueStore } from './library';

/** Magasin en mémoire : adaptateur de test, et repli quand IndexedDB est indisponible. */
export function createMemoryStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    del: async (key) => {
      values.delete(key);
    },
    keys: async () => [...values.keys()],
  };
}
