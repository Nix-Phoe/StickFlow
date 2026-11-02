import { describe, expect, it } from 'vitest';

import type { Project } from '../core/types';
import { imageBackground } from '../model/background';
import { testProject } from '../test/fixtures';
import { createAssetStore, type NewAsset } from './asset-store';
import { createProjectLibrary } from './library';
import { createMemoryStore } from './memory-store';
import type { ProjectArchive } from './project-archive';
import { collectProjects, importProjects } from './project-transfer';

const withImage = (name: string, assetId: string | null): Project =>
  testProject({ name, environment: { background: assetId ? imageBackground(assetId) : null, shapes: [], drawing: { tiles: {} } } });

const image = (): NewAsset => ({
  blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
  width: 10,
  height: 10,
  mimeType: 'image/png',
  source: 'device',
  thumbnail: null,
});

function setup() {
  let time = 1000;
  let projectId = 0;
  let assetId = 0;
  const library = createProjectLibrary(createMemoryStore(), { now: () => (time += 1), newId: () => `p${++projectId}` });
  const assets = createAssetStore(createMemoryStore(), { now: () => time, newId: () => `a${++assetId}` });
  return { library, assets };
}

describe('collectProjects', () => {
  it('gathers the projects with their dates, and each image they use once', async () => {
    const { library, assets } = setup();
    const { id: imageId } = await assets.add(image());
    const course = await library.save(withImage('Course', imageId));
    const copy = await library.save(withImage('Course 2', imageId));
    const plain = await library.save(withImage('Saut', null));

    const collected = await collectProjects([course.id, copy.id, plain.id], { library, assets });
    expect(collected.projects.map(({ id, name, createdAt }) => ({ id, name, createdAt }))).toEqual([
      { id: course.id, name: 'Course', createdAt: course.createdAt },
      { id: copy.id, name: 'Course 2', createdAt: copy.createdAt },
      { id: plain.id, name: 'Saut', createdAt: plain.createdAt },
    ]);
    expect(collected.assets.map((asset) => asset.id)).toEqual([imageId]);
  });

  it('skips an image that is no longer in the store', async () => {
    const { library, assets } = setup();
    const { id } = await library.save(withImage('Forêt', 'gone'));
    expect((await collectProjects([id], { library, assets })).assets).toEqual([]);
  });
});

describe('importProjects', () => {
  const archive = (): ProjectArchive => ({
    projects: [{ id: 'old-1', name: 'Course', createdAt: 10, updatedAt: 20, project: withImage('Course', 'img-1') }],
    assets: [{ id: 'img-1', width: 10, height: 10, mimeType: 'image/png', source: 'stock', thumbnail: null, blob: image().blob }],
  });

  it('restores projects under their own id and dates, with their images', async () => {
    const { library, assets } = setup();
    const imported = await importProjects(archive(), { library, assets, thumbnail: () => 'data:thumb' });
    expect(imported).toEqual([expect.objectContaining({ id: 'old-1', name: 'Course', createdAt: 10, updatedAt: 20, thumbnail: 'data:thumb' })]);
    expect(imported[0]!.assetIds).toEqual(['img-1']);
    expect(await assets.get('img-1')).toMatchObject({ source: 'stock', width: 10 });
    expect((await library.load('old-1')).environment.background).toMatchObject({ assetId: 'img-1' });
  });

  it('imports a project already in the library as a copy, reusing the image already there', async () => {
    const { library, assets } = setup();
    const first = await importProjects(archive(), { library, assets });
    const second = await importProjects(archive(), { library, assets });
    expect(second[0]).toMatchObject({ name: 'Course 2' });
    expect(second[0]!.id).not.toBe('old-1');
    expect(second[0]!.assetIds).toEqual(first[0]!.assetIds);
    expect(await library.list()).toHaveLength(2);
    expect(await assets.recent()).toHaveLength(1);
  });

  it('keeps the image id of a restored image when it is still in the store', async () => {
    const { library, assets } = setup();
    const { id } = await assets.add(image());
    const backup: ProjectArchive = {
      projects: [{ id: 'p-x', name: 'Forêt', createdAt: 1, updatedAt: 2, project: withImage('Forêt', id) }],
      assets: [{ id, width: 10, height: 10, mimeType: 'image/png', source: 'device', thumbnail: null, blob: image().blob }],
    };
    const [summary] = await importProjects(backup, { library, assets });
    expect(summary!.assetIds).toEqual([id]);
    expect(await assets.recent()).toHaveLength(1);
  });
});
