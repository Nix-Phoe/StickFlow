// Bibliothèque des projets enregistrés, au-dessus de deux magasins clé-valeur (seam : IndexedDB en
// production, mémoire en test) : les projets complets sous « project:<id> », et un index séparé des
// résumés (nom, format, IPS, dates, vignette) pour que l'accueil s'affiche sans charger les projets.
import { createId } from '../core/id';
import { LIMITS, type Project, type ProjectSummary } from '../core/types';
import { deriveSequence } from '../model/sequence';
import { fromProjectFile, toProjectFile, type ProjectFile } from './project-file';
import { createMemoryStore } from './memory-store';

/** Magasin clé-valeur asynchrone (même forme que `idb-keyval`). */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export type { ProjectSummary };

export class LibraryError extends Error {
  override name = 'LibraryError';
}

export interface ProjectLibrary {
  /**
   * Enregistre le projet sous `id`, ou sous un nouvel id s'il n'est pas donné. Sans nouvelle
   * vignette, l'ancienne est gardée.
   */
  save(project: Project, id?: string, options?: { thumbnail?: string | null }): Promise<ProjectSummary>;
  /** Résumés des projets enregistrés (index), du plus récemment modifié au plus ancien. */
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project>;
  remove(id: string): Promise<void>;
  /** Renomme un projet enregistré (un nom vide est ignoré). */
  rename(id: string, name: string): Promise<ProjectSummary>;
  /** Copie un projet enregistré sous un nouvel id et un nouveau nom. */
  duplicate(id: string, name: string): Promise<ProjectSummary>;
  /** Remplace la vignette d'un projet, sans changer sa date de modification. */
  setThumbnail(id: string, thumbnail: string): Promise<void>;
}

interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  file: ProjectFile;
}

const PREFIX = 'project:';

export interface LibraryOptions {
  /** Index des résumés ; en mémoire par défaut (tests). */
  index?: KeyValueStore;
  now?: () => number;
  newId?: () => string;
}

export function createProjectLibrary(
  store: KeyValueStore,
  { index = createMemoryStore(), now = Date.now, newId = createId }: LibraryOptions = {},
): ProjectLibrary {
  async function read(id: string): Promise<StoredProject | null> {
    return toStoredProject(await store.get(PREFIX + id));
  }

  async function readSummary(id: string): Promise<ProjectSummary | null> {
    const value = await index.get(id);
    return isSummary(value) ? value : null;
  }

  async function write(
    project: Project,
    id: string,
    dates: { createdAt: number; updatedAt: number },
    thumbnail: string | null,
  ): Promise<ProjectSummary> {
    const stored: StoredProject = { id, name: project.name, ...dates, file: toProjectFile(project) };
    const summary = summarize(project, id, dates, thumbnail);
    // Copies JSON : ce qui est enregistré ne partage rien avec l'état en mémoire.
    await store.set(PREFIX + id, JSON.parse(JSON.stringify(stored)));
    await index.set(id, JSON.parse(JSON.stringify(summary)));
    return summary;
  }

  async function loadStored(id: string): Promise<{ stored: StoredProject; project: Project }> {
    const stored = await read(id);
    if (!stored) throw new LibraryError(`Projet introuvable : ${id}`);
    return { stored, project: fromProjectFile(stored.file) };
  }

  const library: ProjectLibrary = {
    async save(project, id, { thumbnail } = {}) {
      const time = now();
      const existing = id === undefined ? null : await readSummary(id);
      const createdAt = existing?.createdAt ?? (id === undefined ? null : (await read(id))?.createdAt) ?? time;
      return write(project, id ?? newId(), { createdAt, updatedAt: time }, thumbnail ?? existing?.thumbnail ?? null);
    },

    async list() {
      const projectIds = new Set(
        (await store.keys()).filter((key) => key.startsWith(PREFIX)).map((key) => key.slice(PREFIX.length)),
      );
      const indexed = new Set(await index.keys());
      const summaries: ProjectSummary[] = [];
      for (const id of indexed) {
        const summary = projectIds.has(id) ? await readSummary(id) : null;
        if (summary) summaries.push(summary);
        else await index.del(id);
      }
      // Projets enregistrés avant l'index (version 1.0) : on les résume une fois, sans vignette.
      for (const id of projectIds) {
        if (indexed.has(id)) continue;
        const stored = await read(id);
        if (!stored) continue;
        try {
          const summary = summarize(fromProjectFile(stored.file), id, stored, null);
          await index.set(id, summary);
          summaries.push(summary);
        } catch {
          // Projet illisible : il n'apparaît pas dans la liste.
        }
      }
      return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async load(id) {
      return (await loadStored(id)).project;
    },

    async remove(id) {
      await store.del(PREFIX + id);
      await index.del(id);
    },

    async rename(id, name) {
      const { stored, project } = await loadStored(id);
      const clean = name.trim().slice(0, LIMITS.projectNameLength);
      const thumbnail = (await readSummary(id))?.thumbnail ?? null;
      if (clean === '' || clean === project.name) return summarize(project, id, stored, thumbnail);
      return write({ ...project, name: clean }, id, { createdAt: stored.createdAt, updatedAt: now() }, thumbnail);
    },

    async duplicate(id, name) {
      const { project } = await loadStored(id);
      const time = now();
      const thumbnail = (await readSummary(id))?.thumbnail ?? null;
      return write({ ...project, name }, newId(), { createdAt: time, updatedAt: time }, thumbnail);
    },

    async setThumbnail(id, thumbnail) {
      const summary = await readSummary(id);
      if (summary) await index.set(id, { ...summary, thumbnail });
    },
  };
  return library;
}

function summarize(
  project: Project,
  id: string,
  { createdAt, updatedAt }: { createdAt: number; updatedAt: number },
  thumbnail: string | null,
): ProjectSummary {
  return {
    id,
    name: project.name,
    format: project.format,
    fps: project.fps,
    frameCount: deriveSequence(project).length,
    createdAt,
    updatedAt,
    thumbnail,
  };
}

/** Projet enregistré ; ceux de la version 1.0 n'avaient qu'une date (`savedAt`). */
function toStoredProject(value: unknown): StoredProject | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string' || !('file' in v)) return null;
  const legacy = typeof v.savedAt === 'number' ? v.savedAt : null;
  const createdAt = typeof v.createdAt === 'number' ? v.createdAt : legacy;
  const updatedAt = typeof v.updatedAt === 'number' ? v.updatedAt : legacy;
  if (createdAt === null || updatedAt === null) return null;
  return { id: v.id, name: v.name, createdAt, updatedAt, file: v.file as ProjectFile };
}

function isSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.updatedAt === 'number' && typeof v.createdAt === 'number';
}
