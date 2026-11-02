// Import des images d'arrière-plan (v2.1), sans DOM : `asset:import` (appareil, banque d'images,
// adresse) → vérification → traitement (injecté) → magasin d'assets → nouvel arrière-plan ;
// `asset:apply` réapplique une image récente. Les erreurs vont dans la Session (et `asset:error`).

import type { AppEventBus } from '../core/events';
import type { Store } from '../core/store';
import type { AssetErrorCode, ImageCredit } from '../core/types';
import type { VideoFormat } from '../core/formats';
import { imageBackground } from '../model/background';
import type { AssetStore } from '../storage/asset-store';
import { checkImageFile, SNIFF_BYTES, type ProcessedImage } from './image-import';

/** Décode, réduit et compresse une image vérifiée (navigateur : `processImage`). */
export type ProcessImage = (file: Blob, format: VideoFormat) => Promise<ProcessedImage>;

export interface AssetImporterOptions {
  bus: AppEventBus;
  store: Store;
  assets: AssetStore;
  process: ProcessImage;
}

export interface AssetImporter {
  /** Attend la fin des imports lancés (tests). */
  settled(): Promise<void>;
  disconnect(): void;
}

export function connectAssetImporter({ bus, store, assets, process }: AssetImporterOptions): AssetImporter {
  let queue: Promise<void> = Promise.resolve();
  /** Les imports passent un par un, dans l'ordre. */
  const run = (task: () => Promise<void>): void => {
    queue = queue.then(task).catch((error: unknown) => console.error('[assets]', error));
  };
  const setImport = (status: 'idle' | 'busy' | 'error', error: AssetErrorCode | null = null): void =>
    store.update((s) => ({ session: { ...s.session, assetImport: { status, error } } }));
  const refreshRecents = async (): Promise<void> => {
    const recentAssets = await assets.recent();
    store.update((s) => ({ session: { ...s.session, recentAssets } }));
  };
  const fail = (code: AssetErrorCode): void => {
    setImport('error', code);
    bus.emit('asset:error', { code });
  };

  async function importFile(file: Blob, source: 'device' | 'stock' | 'url', credit?: ImageCredit): Promise<void> {
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const problem = checkImageFile(file, head);
    if (problem) return fail(problem);
    let processed: ProcessedImage;
    try {
      processed = await process(file, store.state.project.present.format);
    } catch {
      return fail('unreadable');
    }
    const asset = await assets.add({ ...processed, source, ...(credit ? { credit } : {}) });
    bus.emit('background:set', { background: imageBackground(asset.id, credit) });
    setImport('idle');
    await refreshRecents();
  }

  const stops = [
    bus.on('asset:import', ({ file, source, credit }) => {
      setImport('busy');
      run(() => importFile(file, source, credit));
    }),
    bus.on('asset:apply', ({ assetId }) =>
      run(async () => {
        const asset = (await assets.get(assetId)) ?? null;
        if (!asset) return refreshRecents();
        await assets.touch(assetId);
        bus.emit('background:set', { background: imageBackground(assetId, asset.credit) });
        await refreshRecents();
      }),
    ),
  ];
  run(refreshRecents);

  return {
    settled: () => queue,
    disconnect: () => stops.forEach((stop) => stop()),
  };
}
