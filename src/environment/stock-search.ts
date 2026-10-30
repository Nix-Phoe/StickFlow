// Onglet Internet (v2.1), sans DOM : recherche dans la banque d'images (pages suivantes au
// défilement), import d'une photo avec son crédit, ou d'une image par son adresse (via le proxy).
// Le fichier téléchargé passe ensuite par `asset:import`, comme une image de l'appareil.

import type { AppEventBus } from '../core/events';
import { EMPTY_STOCK, type StockState } from '../core/session';
import type { Store } from '../core/store';
import { StockError, type StockClient } from './stock-client';

export interface StockSearchOptions {
  bus: AppEventBus;
  store: Store;
  client: StockClient;
}

export interface StockSearch {
  /** Attend la fin des recherches et téléchargements lancés (tests). */
  settled(): Promise<void>;
  disconnect(): void;
}

export function connectStockSearch({ bus, store, client }: StockSearchOptions): StockSearch {
  const pending = new Set<Promise<void>>();
  const track = (task: Promise<void>): void => {
    pending.add(task);
    void task.finally(() => pending.delete(task));
  };
  /** Numéro de la recherche en cours : une réponse arrivée après une recherche plus récente est ignorée. */
  let ticket = 0;
  const setStock = (patch: Partial<StockState>): void =>
    store.update((s) => ({ session: { ...s.session, stock: { ...s.session.stock, ...patch } } }));
  const codeOf = (error: unknown): StockError['code'] => (error instanceof StockError ? error.code : 'failed');

  async function search(query: string, page: number, current: number): Promise<void> {
    try {
      const result = await client.search(query, page);
      if (current !== ticket) return;
      const previous = page > 1 ? store.state.session.stock.photos : [];
      // Une même photo peut revenir d'une page à l'autre : on ne la montre qu'une fois.
      const seen = new Set(previous.map((photo) => photo.id));
      setStock({ photos: [...previous, ...result.photos.filter((photo) => !seen.has(photo.id))], page, hasMore: result.hasMore, status: 'done', error: null });
    } catch (error) {
      if (current === ticket) setStock({ status: 'error', error: codeOf(error) });
    }
  }

  async function download(url: string, source: 'stock' | 'url', credit?: { author: string; url: string; provider: string }): Promise<void> {
    store.update((s) => ({ session: { ...s.session, assetImport: { status: 'busy', error: null } } }));
    try {
      const file = await client.download(url);
      bus.emit('asset:import', { file, source, ...(credit ? { credit } : {}) });
    } catch (error) {
      const code = codeOf(error);
      store.update((s) => ({ session: { ...s.session, assetImport: { status: 'error', error: code } } }));
      bus.emit('asset:error', { code });
    }
  }

  const stops = [
    bus.on('stock:search', ({ query, page }) => {
      const clean = query.trim();
      ticket += 1;
      if (clean === '') {
        setStock(EMPTY_STOCK);
        return;
      }
      setStock(page > 1 ? { status: 'loading' } : { ...EMPTY_STOCK, query: clean, status: 'loading' });
      track(search(clean, page, ticket));
    }),
    bus.on('stock:import', ({ photoId }) => {
      const photo = store.state.session.stock.photos.find((p) => p.id === photoId);
      if (photo) track(download(photo.image, 'stock', { author: photo.author, url: photo.url, provider: photo.provider }));
    }),
    bus.on('url:import', ({ url }) => track(download(url.trim(), 'url'))),
  ];

  return {
    async settled() {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
    disconnect: () => stops.forEach((stop) => stop()),
  };
}
