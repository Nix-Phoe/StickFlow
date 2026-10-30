import { describe, expect, it } from 'vitest';

import { createEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { createInitialState, Store } from '../core/store';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createAssetStore } from '../storage/asset-store';
import { createMemoryStore } from '../storage/memory-store';
import { connectAssetImporter, type ProcessImage } from './asset-importer';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const png = (): Blob => new Blob([PNG], { type: 'image/png' });

async function setup(process: ProcessImage = async () => ({
  blob: new Blob(['webp'], { type: 'image/webp' }),
  width: 1600,
  height: 900,
  mimeType: 'image/webp',
  thumbnail: 'data:image/jpeg;base64,AA',
})) {
  const bus = createEventBus();
  const store = new Store(createInitialState('Test', sortSkeleton(createDefaultSkeleton())));
  let id = 0;
  let time = 0;
  const assets = createAssetStore(createMemoryStore(), { newId: () => `a${++id}`, now: () => (time += 1) });
  connectIntents(bus, store);
  const importer = connectAssetImporter({ bus, store, assets, process });
  await importer.settled();
  return { bus, store, assets, importer, background: () => store.state.project.present.environment.background, session: () => store.state.session };
}

describe('connectAssetImporter', () => {
  it('processes an image, keeps it, and makes it the background', async () => {
    const { bus, importer, assets, background, session } = await setup();
    bus.emit('asset:import', { file: png(), source: 'device' });
    expect(session().assetImport.status).toBe('busy');
    await importer.settled();
    expect(session().assetImport).toEqual({ status: 'idle', error: null });
    expect(background()).toMatchObject({ type: 'image', assetId: 'a1', fit: 'cover' });
    expect(await assets.get('a1')).toMatchObject({ width: 1600, height: 900, mimeType: 'image/webp', source: 'device' });
    expect(session().recentAssets.map((a) => a.id)).toEqual(['a1']);
  });

  it('keeps the credit of a stock photo, in the asset and in the background', async () => {
    const { bus, importer, background } = await setup();
    const credit = { author: 'Ana', url: 'https://www.pexels.com/photo/1', provider: 'Pexels' };
    bus.emit('asset:import', { file: png(), source: 'stock', credit });
    await importer.settled();
    expect(background()).toMatchObject({ credit });
  });

  it('refuses an SVG or a file too large, with a clear error, and changes nothing', async () => {
    const { bus, importer, background, session, assets } = await setup();
    bus.emit('asset:import', { file: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }), source: 'device' });
    await importer.settled();
    expect(session().assetImport).toEqual({ status: 'error', error: 'svg' });
    const huge = { size: 21 * 1024 * 1024, type: 'image/png', slice: () => png() } as unknown as Blob;
    bus.emit('asset:import', { file: huge, source: 'device' });
    await importer.settled();
    expect(session().assetImport).toEqual({ status: 'error', error: 'too-large' });
    expect(background()).toBeNull();
    expect(await assets.recent()).toEqual([]);
  });

  it('reports an image that cannot be decoded', async () => {
    const { bus, importer, session } = await setup(async () => {
      throw new Error('decode');
    });
    bus.emit('asset:import', { file: png(), source: 'device' });
    await importer.settled();
    expect(session().assetImport).toEqual({ status: 'error', error: 'unreadable' });
  });

  it('applies a recent image again, which comes back to the top of the recents', async () => {
    const { bus, importer, background, session } = await setup();
    bus.emit('asset:import', { file: png(), source: 'device' });
    bus.emit('asset:import', { file: png(), source: 'device' });
    await importer.settled();
    bus.emit('asset:apply', { assetId: 'a1' });
    await importer.settled();
    expect(background()).toMatchObject({ assetId: 'a1' });
    expect(session().recentAssets.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('loads the recent images when it starts', async () => {
    const { store, assets } = await setup();
    await assets.add({ blob: png(), width: 1, height: 1, mimeType: 'image/png', source: 'device', thumbnail: null });
    const bus = createEventBus();
    const importer = connectAssetImporter({ bus, store, assets, process: async () => Promise.reject(new Error()) });
    await importer.settled();
    expect(store.state.session.recentAssets).toHaveLength(1);
  });
});
