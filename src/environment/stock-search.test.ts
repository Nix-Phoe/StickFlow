import { describe, expect, it } from 'vitest';

import { createEventBus, type AppEvents } from '../core/events';
import { createInitialState, Store } from '../core/store';
import type { StockPhoto } from '../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import type { StockClient } from './stock-client';
import { StockError } from './stock-client';
import { connectStockSearch } from './stock-search';

const photo = (id: string): StockPhoto => ({
  id,
  width: 4000,
  height: 3000,
  alt: `Photo ${id}`,
  color: '#335533',
  thumbnail: `https://img/${id}?h=350`,
  image: `https://img/${id}?w=1920`,
  author: 'Ana',
  authorUrl: 'https://www.pexels.com/@ana',
  url: `https://www.pexels.com/photo/${id}/`,
  provider: 'Pexels',
});

function setup(client: Partial<StockClient> = {}) {
  const bus = createEventBus();
  const store = new Store(createInitialState('Test', sortSkeleton(createDefaultSkeleton())));
  const imports: AppEvents['asset:import'][] = [];
  const errors: string[] = [];
  bus.on('asset:import', (payload) => imports.push(payload));
  bus.on('asset:error', ({ code }) => errors.push(code));
  const search = connectStockSearch({
    bus,
    store,
    client: {
      configured: true,
      searchEnabled: true,
      search: async (query, page) => ({ photos: [photo(`${query}-${page}`)], hasMore: page < 2 }),
      download: async () => new Blob(['img'], { type: 'image/jpeg' }),
      ...client,
    },
  });
  return { bus, store, search, imports, errors, stock: () => store.state.session.stock };
}

describe('connectStockSearch', () => {
  it('searches, then loads the next pages after the first ones (infinite scroll)', async () => {
    const { bus, search, stock } = setup();
    bus.emit('stock:search', { query: 'forêt', page: 1 });
    expect(stock()).toMatchObject({ query: 'forêt', status: 'loading' });
    await search.settled();
    expect(stock()).toMatchObject({ status: 'done', page: 1, hasMore: true });
    bus.emit('stock:search', { query: 'forêt', page: 2 });
    await search.settled();
    expect(stock().photos.map((p) => p.id)).toEqual(['forêt-1', 'forêt-2']);
    expect(stock().hasMore).toBe(false);
  });

  it('ignores the answer of a search replaced by a newer one', async () => {
    let release: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => (release = resolve));
    const { bus, search, stock } = setup({
      search: async (query, page) => {
        if (query === 'ville') await slow;
        return { photos: [photo(`${query}-${page}`)], hasMore: false };
      },
    });
    bus.emit('stock:search', { query: 'ville', page: 1 });
    bus.emit('stock:search', { query: 'mer', page: 1 });
    release();
    await search.settled();
    expect(stock().photos.map((p) => p.id)).toEqual(['mer-1']);
  });

  it('clears the results for an empty search', async () => {
    const { bus, search, stock } = setup();
    bus.emit('stock:search', { query: 'forêt', page: 1 });
    await search.settled();
    bus.emit('stock:search', { query: '  ', page: 1 });
    expect(stock()).toMatchObject({ query: '', photos: [], status: 'idle' });
  });

  it('explains why there are no results (proxy not configured, offline)', async () => {
    const { bus, search, stock } = setup({
      search: async () => {
        throw new StockError('offline');
      },
    });
    bus.emit('stock:search', { query: 'forêt', page: 1 });
    await search.settled();
    expect(stock()).toMatchObject({ status: 'error', error: 'offline' });
  });

  it('imports a photo of the results with its credit', async () => {
    const { bus, search, imports } = setup();
    bus.emit('stock:search', { query: 'forêt', page: 1 });
    await search.settled();
    bus.emit('stock:import', { photoId: 'forêt-1' });
    await search.settled();
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      source: 'stock',
      credit: { author: 'Ana', url: 'https://www.pexels.com/photo/forêt-1/', provider: 'Pexels' },
    });
  });

  it('imports an image from its address, through the proxy', async () => {
    const asked: string[] = [];
    const { bus, search, imports, errors } = setup({
      download: async (url) => {
        asked.push(url);
        if (url.includes('fail')) throw new StockError('failed');
        return new Blob(['img'], { type: 'image/png' });
      },
    });
    bus.emit('url:import', { url: '  https://example.com/chat.png ' });
    await search.settled();
    expect(asked).toEqual(['https://example.com/chat.png']);
    expect(imports[0]).toMatchObject({ source: 'url' });
    expect(imports[0]?.credit).toBeUndefined();
    bus.emit('url:import', { url: 'https://example.com/fail.png' });
    await search.settled();
    expect(errors).toEqual(['failed']);
  });
});
