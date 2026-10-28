import { describe, expect, it } from 'vitest';

import type { Project } from '../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createProjectLibrary, LibraryError } from './library';
import { createMemoryStore } from './memory-store';

const project = (name: string): Project => ({
  name,
  fps: 12,
  skeleton: sortSkeleton(createDefaultSkeleton()),
  keyframes: [{ id: 'k1', pose: {}, rootPosition: { x: 0, y: 0 } }],
  ai: {
    smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
    loop: { enabled: false, repeatCount: 3, infinite: true, transitionFrames: 4 },
  },
});

function setup() {
  let now = 1000;
  let id = 0;
  const library = createProjectLibrary(createMemoryStore(), {
    now: () => now,
    newId: () => `p${++id}`,
  });
  return { library, later: () => (now += 1000) };
}

describe('createProjectLibrary', () => {
  it('saves a new project under a fresh id', async () => {
    const { library } = setup();
    const entry = await library.save(project('Saut'));
    expect(entry).toEqual({ id: 'p1', name: 'Saut', savedAt: 1000 });
  });

  it('loads back a saved project', async () => {
    const { library } = setup();
    const { id } = await library.save(project('Saut'));
    expect(await library.load(id)).toEqual(project('Saut'));
  });

  it('overwrites a project saved again under the same id', async () => {
    const { library, later } = setup();
    const { id } = await library.save(project('Saut'));
    later();
    const entry = await library.save(project('Saut périlleux'), id);
    expect(entry).toEqual({ id, name: 'Saut périlleux', savedAt: 2000 });
    expect(await library.list()).toHaveLength(1);
  });

  it('lists saved projects, most recent first', async () => {
    const { library, later } = setup();
    await library.save(project('Ancien'));
    later();
    await library.save(project('Récent'));
    expect((await library.list()).map((e) => e.name)).toEqual(['Récent', 'Ancien']);
  });

  it('fails clearly when loading an unknown project', async () => {
    const { library } = setup();
    await expect(library.load('ghost')).rejects.toThrow(LibraryError);
  });

  it('removes a project', async () => {
    const { library } = setup();
    const { id } = await library.save(project('Saut'));
    await library.remove(id);
    expect(await library.list()).toEqual([]);
  });

  it('ignores stored values that are not projects when listing', async () => {
    const store = createMemoryStore();
    await store.set('project:broken', { nonsense: true });
    const library = createProjectLibrary(store);
    expect(await library.list()).toEqual([]);
  });
});
