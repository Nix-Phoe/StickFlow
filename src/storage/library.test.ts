import { describe, expect, it } from 'vitest';

import { presetFormat } from '../core/formats';
import type { Project } from '../core/types';
import { deriveSequence } from '../model/sequence';
import { imageBackground } from '../model/background';
import { testProject } from '../test/fixtures';
import { createProjectLibrary, LibraryError, type KeyValueStore } from './library';
import { createMemoryStore } from './memory-store';
import { toProjectFile } from './project-file';

const project = (name: string, overrides: Partial<Project> = {}): Project => testProject({ name, ...overrides });

/** Magasin qui compte les lectures, pour vérifier que l'accueil ne charge pas les projets. */
function countingStore(): KeyValueStore & { reads: () => number } {
  const store = createMemoryStore();
  let reads = 0;
  return {
    ...store,
    get: (key) => {
      reads += 1;
      return store.get(key);
    },
    reads: () => reads,
  };
}

function setup(projects: KeyValueStore = createMemoryStore(), index: KeyValueStore = createMemoryStore()) {
  let now = 1000;
  let id = 0;
  const library = createProjectLibrary(projects, {
    index,
    now: () => now,
    newId: () => `p${++id}`,
  });
  return { library, projects, index, later: () => (now += 1000) };
}

describe('createProjectLibrary: enregistrer et ouvrir', () => {
  it('saves a new project under a fresh id, with its summary', async () => {
    const { library } = setup();
    const saved = project('Saut', { fps: 24, format: presetFormat('vertical') });
    const summary = await library.save(saved, undefined, { thumbnail: 'data:image/png;base64,AA' });
    expect(summary).toEqual({
      id: 'p1',
      name: 'Saut',
      format: presetFormat('vertical'),
      fps: 24,
      frameCount: deriveSequence(saved).length,
      createdAt: 1000,
      updatedAt: 1000,
      thumbnail: 'data:image/png;base64,AA',
      assetIds: [],
    });
  });

  it('lists in the summary the image used as background (v2.1)', async () => {
    const { library } = setup();
    const base = project('Forêt');
    const withImage = { ...base, environment: { ...base.environment, background: imageBackground('a7') } };
    expect((await library.save(withImage)).assetIds).toEqual(['a7']);
  });

  it('loads back a saved project', async () => {
    const { library } = setup();
    const { id } = await library.save(project('Saut'));
    expect(await library.load(id)).toEqual(project('Saut'));
  });

  it('overwrites a project saved again under the same id, keeping its creation date and thumbnail', async () => {
    const { library, later } = setup();
    const { id } = await library.save(project('Saut'), undefined, { thumbnail: 'data:a' });
    later();
    const summary = await library.save(project('Saut périlleux'), id);
    expect(summary).toMatchObject({ id, name: 'Saut périlleux', createdAt: 1000, updatedAt: 2000, thumbnail: 'data:a' });
    expect(await library.list()).toHaveLength(1);
  });

  it('keeps the dates of an imported project (v2.2) instead of the current time', async () => {
    const { library } = setup();
    const summary = await library.save(project('Ancien'), 'old-id', { dates: { createdAt: 10, updatedAt: 20 } });
    expect(summary).toMatchObject({ id: 'old-id', createdAt: 10, updatedAt: 20 });
  });

  it('fails clearly when loading an unknown project', async () => {
    const { library } = setup();
    await expect(library.load('ghost')).rejects.toThrow(LibraryError);
  });
});

describe('createProjectLibrary: index des projets', () => {
  it('lists the summaries from the index, most recently modified first, without loading the projects', async () => {
    const projects = countingStore();
    const { library, later } = setup(projects);
    await library.save(project('Ancien'));
    later();
    await library.save(project('Récent'));
    const reads = projects.reads();
    expect((await library.list()).map((e) => e.name)).toEqual(['Récent', 'Ancien']);
    expect(projects.reads()).toBe(reads);
  });

  it('indexes the projects saved before the index existed (version 1.0)', async () => {
    const projects = createMemoryStore();
    await projects.set('project:old', { id: 'old', name: 'Ancien', savedAt: 500, file: toProjectFile(project('Ancien')) });
    const { library, index } = setup(projects);
    expect(await library.list()).toEqual([
      expect.objectContaining({ id: 'old', name: 'Ancien', createdAt: 500, updatedAt: 500, thumbnail: null }),
    ]);
    expect(await index.get('old')).toMatchObject({ name: 'Ancien' });
  });

  it('forgets index entries whose project is gone, and ignores stored values that are not projects', async () => {
    const { library, projects, index } = setup();
    const { id } = await library.save(project('Saut'));
    await projects.del(`project:${id}`);
    await projects.set('project:broken', { nonsense: true });
    expect(await library.list()).toEqual([]);
    expect(await index.keys()).toEqual([]);
  });

  it('removes a project and its summary', async () => {
    const { library, index } = setup();
    const { id } = await library.save(project('Saut'));
    await library.remove(id);
    expect(await library.list()).toEqual([]);
    expect(await index.keys()).toEqual([]);
  });
});

describe('createProjectLibrary: actions sur un projet enregistré', () => {
  it('renames a project, in the project itself and in its summary', async () => {
    const { library, later } = setup();
    const { id } = await library.save(project('Saut'));
    later();
    expect(await library.rename(id, '  Grand saut ')).toMatchObject({ name: 'Grand saut', updatedAt: 2000 });
    expect((await library.load(id)).name).toBe('Grand saut');
  });

  it('keeps the name when the new one is empty', async () => {
    const { library } = setup();
    const { id } = await library.save(project('Saut'));
    expect(await library.rename(id, '   ')).toMatchObject({ name: 'Saut' });
  });

  it('duplicates a project under a new id and name, with its thumbnail', async () => {
    const { library, later } = setup();
    const { id } = await library.save(project('Saut'), undefined, { thumbnail: 'data:a' });
    later();
    const copy = await library.duplicate(id, 'Saut (copie)');
    expect(copy).toMatchObject({ id: 'p2', name: 'Saut (copie)', createdAt: 2000, updatedAt: 2000, thumbnail: 'data:a' });
    expect((await library.load('p2')).name).toBe('Saut (copie)');
    expect(await library.list()).toHaveLength(2);
  });

  it('updates a thumbnail without changing the modification date', async () => {
    const { library, later } = setup();
    const { id } = await library.save(project('Saut'));
    later();
    await library.setThumbnail(id, 'data:b');
    expect(await library.list()).toEqual([expect.objectContaining({ thumbnail: 'data:b', updatedAt: 1000 })]);
  });
});
