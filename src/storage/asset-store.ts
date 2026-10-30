// Magasin d'assets (v2.1) : les images d'arrière-plan, gardées en Blob dans un magasin clé-valeur
// séparé (IndexedDB « stickflow-assets » en production), jamais en data URL dans le Projet.
// Un asset est partagé par un projet et ses copies ; il est supprimé avec le dernier projet qui l'utilise.

import { createId } from '../core/id';
import type { AssetSource, AssetSummary, ImageCredit } from '../core/types';
import type { KeyValueStore } from './library';

/** Images récentes proposées dans la sous-page « Arrière-plan ». */
export const RECENT_ASSETS = 8;

export interface NewAsset {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  source: AssetSource;
  credit?: ImageCredit;
  /** Petite vignette (JPEG en data URL) des images récentes. */
  thumbnail: string | null;
}

export type { AssetSource, AssetSummary };

export interface Asset extends AssetSummary {
  blob: Blob;
}

export interface AssetStore {
  add(asset: NewAsset): Promise<AssetSummary>;
  /** L'asset et son fichier ; `null` s'il n'existe pas (ou plus). */
  get(id: string): Promise<Asset | null>;
  /** Le note comme utilisé maintenant (il remonte dans les récents). */
  touch(id: string): Promise<void>;
  /** Les plus récemment utilisés d'abord, `RECENT_ASSETS` au plus. */
  recent(): Promise<AssetSummary[]>;
  /** Supprime, parmi `candidates`, ceux qui ne sont pas dans `used`. */
  removeUnused(candidates: readonly string[], used: ReadonlySet<string>): Promise<void>;
}

export function createAssetStore(
  store: KeyValueStore,
  { now = Date.now, newId = createId }: { now?: () => number; newId?: () => string } = {},
): AssetStore {
  async function read(id: string): Promise<Asset | null> {
    const value = await store.get(id);
    return isAsset(value) ? value : null;
  }

  return {
    async add(asset) {
      const time = now();
      const stored: Asset = { ...asset, id: newId(), createdAt: time, usedAt: time };
      await store.set(stored.id, stored);
      return summarize(stored);
    },
    get: read,
    async touch(id) {
      const asset = await read(id);
      if (asset) await store.set(id, { ...asset, usedAt: now() });
    },
    async recent() {
      const assets = await Promise.all((await store.keys()).map(read));
      return assets
        .filter((asset): asset is Asset => asset !== null)
        .sort((a, b) => b.usedAt - a.usedAt || b.createdAt - a.createdAt)
        .slice(0, RECENT_ASSETS)
        .map(summarize);
    },
    async removeUnused(candidates, used) {
      for (const id of new Set(candidates)) if (!used.has(id)) await store.del(id);
    },
  };
}

function summarize({ blob: _blob, ...summary }: Asset): AssetSummary {
  return summary;
}

function isAsset(value: unknown): value is Asset {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.width === 'number' && typeof v.height === 'number' && v.blob instanceof Blob;
}
