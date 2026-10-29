import { createStore, del, get, keys, set } from 'idb-keyval';

import type { KeyValueStore } from './library';

/**
 * Magasin IndexedDB : adaptateur de production. Une base par magasin, car idb-keyval ne crée
 * qu'une table par base : « stickflow » / « projects » (projets), « stickflow-index » (résumés),
 * « stickflow-videos » (vidéos exportées).
 */
export function createIdbStore(database = 'stickflow', table = 'projects'): KeyValueStore {
  const store = createStore(database, table);
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}
