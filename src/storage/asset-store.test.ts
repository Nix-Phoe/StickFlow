import { describe, expect, it } from 'vitest';

import { createAssetStore, RECENT_ASSETS, type NewAsset } from './asset-store';
import { createMemoryStore } from './memory-store';

const asset = (changes: Partial<NewAsset> = {}): NewAsset => ({
  blob: new Blob([new Uint8Array(10)], { type: 'image/webp' }),
  width: 1920,
  height: 1080,
  mimeType: 'image/webp',
  source: 'device',
  ...changes,
});

function setup() {
  let time = 1000;
  let id = 0;
  const assets = createAssetStore(createMemoryStore(), { now: () => time, newId: () => `a${++id}` });
  return { assets, later: () => (time += 1000) };
}

describe('createAssetStore', () => {
  it('keeps an image with its size, type, source and credit', async () => {
    const { assets } = setup();
    const credit = { author: 'Ana', url: 'https://www.pexels.com/photo/1', provider: 'Pexels' };
    const saved = await assets.add(asset({ source: 'stock', credit }));
    expect(saved).toEqual({ id: 'a1', width: 1920, height: 1080, mimeType: 'image/webp', source: 'stock', credit, createdAt: 1000, usedAt: 1000 });
    expect((await assets.get('a1'))?.blob.size).toBe(10);
    expect(await assets.get('missing')).toBeNull();
  });

  it('lists the most recently used images first, at most eight', async () => {
    const { assets, later } = setup();
    for (let i = 0; i < RECENT_ASSETS + 2; i += 1) {
      await assets.add(asset());
      later();
    }
    await assets.touch('a1');
    const recent = await assets.recent();
    expect(RECENT_ASSETS).toBe(8);
    expect(recent).toHaveLength(8);
    expect(recent.map((a) => a.id).slice(0, 3)).toEqual(['a1', 'a10', 'a9']);
  });

  it('removes the images that no project uses any more', async () => {
    const { assets } = setup();
    await assets.add(asset());
    await assets.add(asset());
    await assets.add(asset());
    await assets.removeUnused(['a1', 'a2'], new Set(['a2']));
    expect(await assets.get('a1')).toBeNull();
    expect(await assets.get('a2')).not.toBeNull();
    expect(await assets.get('a3')).not.toBeNull();
  });
});
