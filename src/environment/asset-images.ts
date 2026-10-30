// Images décodées du magasin d'assets (v2.1) : chaque asset n'est décodé qu'une fois
// (`createImageBitmap`, hors du fil principal), puis réutilisé par la scène, les vignettes et l'export.
// Navigateur uniquement.

import type { AssetStore } from '../storage/asset-store';

/** Assets gardés décodés (les plus récemment demandés). */
const CACHE_SIZE = 4;

export interface AssetImages {
  /** Image décodée ; `null` si l'asset n'existe plus ou ne se décode pas. */
  load(assetId: string): Promise<ImageBitmap | null>;
  destroy(): void;
}

export function createAssetImages(assets: Pick<AssetStore, 'get'>): AssetImages {
  const cache = new Map<string, Promise<ImageBitmap | null>>();

  async function decode(assetId: string): Promise<ImageBitmap | null> {
    try {
      const asset = await assets.get(assetId);
      return asset ? await createImageBitmap(asset.blob) : null;
    } catch (error) {
      console.warn(`[assets] Image ${assetId} illisible :`, error);
      return null;
    }
  }

  return {
    load(assetId) {
      let image = cache.get(assetId);
      if (image) {
        // Le plus récent passe en dernier (ordre d'insertion de la Map).
        cache.delete(assetId);
      } else {
        image = decode(assetId);
      }
      cache.set(assetId, image);
      while (cache.size > CACHE_SIZE) {
        const [oldest, bitmap] = cache.entries().next().value as [string, Promise<ImageBitmap | null>];
        cache.delete(oldest);
        void bitmap.then((b) => b?.close());
      }
      return image;
    },
    destroy() {
      for (const bitmap of cache.values()) void bitmap.then((b) => b?.close());
      cache.clear();
    },
  };
}
