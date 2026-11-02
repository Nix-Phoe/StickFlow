// Stockage protégé (v2.2) : les projets vivent dans IndexedDB, que le navigateur peut vider s'il
// manque de place. `navigator.storage.persist()` lui demande de les garder ; on le demande après la
// première sauvegarde d'un projet, une fois par session (Firefox pose la question à l'utilisateur).

import type { ProjectLibrary } from './library';

/** La partie de `navigator.storage` utile ici. */
export type PersistentStorage = Pick<StorageManager, 'persist' | 'persisted'>;

export interface StorageProtection {
  /** Le stockage est-il protégé ? `null` : le navigateur ne le dit pas. */
  status(): Promise<boolean | null>;
  /** Demande la protection (une fois par session, sauf `force` : bouton des Réglages). */
  request(options?: { force?: boolean }): Promise<boolean | null>;
}

export function createStorageProtection(manager: PersistentStorage | undefined): StorageProtection {
  let asked: Promise<boolean> | null = null;

  async function status(): Promise<boolean | null> {
    if (!manager) return null;
    try {
      return await manager.persisted();
    } catch {
      return null;
    }
  }

  return {
    status,
    async request({ force = false } = {}) {
      if (!manager) return null;
      if (await status()) return true;
      if (!asked || force) asked = manager.persist().catch(() => false);
      return asked;
    },
  };
}

/** La bibliothèque demande la protection après chaque sauvegarde réussie (sans l'attendre). */
export function protectOnSave(library: ProjectLibrary, protection: StorageProtection): ProjectLibrary {
  const protect = <T>(result: T): T => {
    void protection.request();
    return result;
  };
  return {
    ...library,
    save: (...args) => library.save(...args).then(protect),
    duplicate: (...args) => library.duplicate(...args).then(protect),
  };
}
