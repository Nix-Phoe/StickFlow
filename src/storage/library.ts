// Bibliothèque des projets enregistrés, au-dessus d'un magasin clé-valeur (seam : IndexedDB
// en production, mémoire en test). Chaque projet est rangé sous « project:<id> ».

import { createId } from '../core/id';
import type { LibraryEntry, Project } from '../core/types';
import { fromProjectFile, toProjectFile, type ProjectFile } from './project-file';

/** Magasin clé-valeur asynchrone (même forme que `idb-keyval`). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export type { LibraryEntry };

export class LibraryError extends Error {
  override name = 'LibraryError';
}

export interface ProjectLibrary {
  /** Enregistre le projet sous `id`, ou sous un nouvel id s'il n'est pas donné. */
  save(project: Project, id?: string): Promise<LibraryEntry>;
  /** Projets enregistrés, du plus récent au plus ancien. */
  list(): Promise<LibraryEntry[]>;
  load(id: string): Promise<Project>;
  remove(id: string): Promise<void>;
}

interface StoredProject extends LibraryEntry {
  file: ProjectFile;
}

const PREFIX = 'project:';

export function createProjectLibrary(
  store: KeyValueStore,
  { now = Date.now, newId = createId }: { now?: () => number; newId?: () => string } = {},
): ProjectLibrary {
  async function read(id: string): Promise<StoredProject | null> {
    const value = await store.get(PREFIX + id);
    return isStoredProject(value) ? value : null;
  }

  return {
    async save(project, id = newId()) {
      const stored: StoredProject = { id, name: project.name, savedAt: now(), file: toProjectFile(project) };
      // Copie JSON : ce qui est enregistré ne partage rien avec l'état en mémoire.
      await store.set(PREFIX + id, JSON.parse(JSON.stringify(stored)));
      return { id, name: stored.name, savedAt: stored.savedAt };
    },

    async list() {
      const ids = (await store.keys()).filter((key) => key.startsWith(PREFIX)).map((key) => key.slice(PREFIX.length));
      const entries = await Promise.all(ids.map(read));
      return entries
        .filter((entry): entry is StoredProject => entry !== null)
        .map(({ id, name, savedAt }) => ({ id, name, savedAt }))
        .sort((a, b) => b.savedAt - a.savedAt);
    },

    async load(id) {
      const stored = await read(id);
      if (!stored) throw new LibraryError(`Projet introuvable : ${id}`);
      return fromProjectFile(stored.file);
    },

    async remove(id) {
      await store.del(PREFIX + id);
    },
  };
}

function isStoredProject(value: unknown): value is StoredProject {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.savedAt === 'number' && 'file' in v;
}
