// Vidéos exportées (MP4, WebM, GIF) conservées dans l'app, en plus du téléchargement : un magasin
// clé-valeur séparé (IndexedDB « stickflow-videos » en production), le fichier gardé en Blob.

import { createId } from '../core/id';
import type { VideoFileType, VideoSummary } from '../core/home-state';
import type { KeyValueStore } from './library';

interface StoredVideo extends VideoSummary {
  blob: Blob;
}

export interface NewVideo {
  projectId: string | null;
  projectName: string;
  type: VideoFileType;
  blob: Blob;
  /** Durée, en secondes. */
  duration: number;
  thumbnail: string | null;
}

export interface VideoLibrary {
  add(video: NewVideo): Promise<VideoSummary>;
  /** Vidéos conservées, de la plus récente à la plus ancienne (sans leur fichier). */
  list(): Promise<VideoSummary[]>;
  /** Fichier d'une vidéo (lecture, téléchargement, partage). */
  file(id: string): Promise<Blob>;
  remove(id: string): Promise<void>;
  removeMany(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export function createVideoLibrary(
  store: KeyValueStore,
  { now = Date.now, newId = createId }: { now?: () => number; newId?: () => string } = {},
): VideoLibrary {
  async function read(id: string): Promise<StoredVideo | null> {
    const value = await store.get(id);
    return isStoredVideo(value) ? value : null;
  }

  const library: VideoLibrary = {
    async add(video) {
      const stored: StoredVideo = { id: newId(), ...video, size: video.blob.size, createdAt: now() };
      await store.set(stored.id, stored);
      return summarize(stored);
    },
    async list() {
      const videos = await Promise.all((await store.keys()).map(read));
      return videos
        .filter((video): video is StoredVideo => video !== null)
        .map(summarize)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async file(id) {
      const video = await read(id);
      if (!video) throw new Error(`Vidéo introuvable : ${id}`);
      return video.blob;
    },
    remove: (id) => store.del(id),
    async removeMany(ids) {
      for (const id of ids) await store.del(id);
    },
    async clear() {
      await library.removeMany(await store.keys());
    },
  };
  return library;
}

function summarize({ blob: _blob, ...summary }: StoredVideo): VideoSummary {
  return summary;
}

function isStoredVideo(value: unknown): value is StoredVideo {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.createdAt === 'number' && v.blob instanceof Blob;
}
