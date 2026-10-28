import { createStore, del, get, keys, set } from 'idb-keyval';

import type { KeyValueStore } from './library';

/** Magasin IndexedDB (base « stickflow », table « projects ») : adaptateur de production. */
export function createIdbStore(): KeyValueStore {
  const store = createStore('stickflow', 'projects');
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}
