import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { imageBackground } from '../model/background';
import { testProject } from '../test/fixtures';
import type { Asset } from './asset-store';
import { toProjectFile } from './project-file';
import { ArchiveError, archiveFileName, backupFileName, readProjectArchive, writeProjectArchive, type ArchivedProject } from './project-archive';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const asset = (id: string, bytes = PNG, mimeType = 'image/png'): Asset => ({
  id,
  width: 640,
  height: 360,
  mimeType,
  source: 'stock',
  credit: { author: 'Ana', url: 'https://www.pexels.com/photo/1/', provider: 'Pexels' },
  thumbnail: 'data:image/jpeg;base64,AAAA',
  createdAt: 1,
  usedAt: 2,
  blob: new Blob([bytes], { type: mimeType }),
});

const archived = (id: string, name: string, assetId?: string): ArchivedProject => ({
  id,
  name,
  createdAt: 1000,
  updatedAt: 2000,
  project: testProject({
    name,
    environment: { background: assetId ? imageBackground(assetId) : null, shapes: [], drawing: { tiles: {} } },
  }),
});

/** Archive écrite à la main, pour fabriquer des fichiers abîmés ou malveillants. */
function rawArchive(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files);
}
const manifest = (body: object): Uint8Array =>
  strToU8(JSON.stringify({ format: 'stickflow-archive', version: 1, app: '2.2.0', exportedAt: 0, projects: [], assets: [], ...body }));

describe('writeProjectArchive / readProjectArchive', () => {
  it('round-trips projects, their dates and their background images', async () => {
    const bytes = await writeProjectArchive([archived('p1', 'Course', 'a1'), archived('p2', 'Saut')], [asset('a1')], { app: '2.2.0', now: () => 5 });
    const files = Object.keys(unzipSync(bytes)).sort();
    expect(files).toEqual(['assets/a1.png', 'projects/p1.json', 'projects/p2.json', 'stickflow.json']);

    const archive = await readProjectArchive(bytes);
    expect(archive.projects.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))).toEqual([
      { id: 'p1', name: 'Course', createdAt: 1000, updatedAt: 2000 },
      { id: 'p2', name: 'Saut', createdAt: 1000, updatedAt: 2000 },
    ]);
    expect(archive.projects[0]?.project.environment.background).toMatchObject({ type: 'image', assetId: 'a1' });
    expect(archive.assets).toHaveLength(1);
    const [image] = archive.assets;
    expect(image).toMatchObject({ id: 'a1', width: 640, height: 360, mimeType: 'image/png', source: 'stock', credit: { author: 'Ana' }, thumbnail: 'data:image/jpeg;base64,AAAA' });
    expect(new Uint8Array(await image!.blob.arrayBuffer())).toEqual(PNG);
  });

  it('reads an old project file inside an archive through the migration', async () => {
    const old = { ...toProjectFile(testProject({ name: 'Ancien' })), version: 3 };
    (old.project.environment as { background: unknown }).background = '#ff8800';
    const bytes = rawArchive({
      'stickflow.json': manifest({ projects: [{ id: 'old', name: 'Ancien', createdAt: 1, updatedAt: 2, path: 'projects/old.json' }] }),
      'projects/old.json': strToU8(JSON.stringify(old)),
    });
    const { projects } = await readProjectArchive(bytes);
    expect(projects[0]?.project.environment.background).toEqual({ type: 'color', color: '#ff8800' });
  });

  it('refuses a file that is not a StickFlow archive', async () => {
    await expect(readProjectArchive(strToU8('pas un zip'))).rejects.toMatchObject({ code: 'not-archive' });
    await expect(readProjectArchive(rawArchive({ 'autre.txt': strToU8('x') }))).rejects.toMatchObject({ code: 'not-archive' });
    await expect(readProjectArchive(rawArchive({ 'stickflow.json': strToU8('{"format":"autre"}') }))).rejects.toMatchObject({ code: 'not-archive' });
  });

  it('refuses an archive written by a newer version, or without any project', async () => {
    await expect(readProjectArchive(rawArchive({ 'stickflow.json': manifest({ version: 2 }) }))).rejects.toMatchObject({ code: 'too-new' });
    await expect(readProjectArchive(rawArchive({ 'stickflow.json': manifest({}) }))).rejects.toMatchObject({ code: 'empty' });
  });

  it('refuses invalid content: broken project, unexpected paths, images that are not images', async () => {
    const entry = { id: 'p', name: 'P', createdAt: 1, updatedAt: 2, path: 'projects/p.json' };
    const project = strToU8(JSON.stringify(toProjectFile(testProject())));
    await expect(
      readProjectArchive(rawArchive({ 'stickflow.json': manifest({ projects: [entry] }), 'projects/p.json': strToU8('{"format":"stickflow-project","version":4}') })),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      readProjectArchive(rawArchive({ 'stickflow.json': manifest({ projects: [{ ...entry, path: '../../etc/passwd' }] }), 'projects/p.json': project })),
    ).rejects.toMatchObject({ code: 'invalid' });
    const svg = strToU8('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(
      readProjectArchive(
        rawArchive({
          'stickflow.json': manifest({
            projects: [entry],
            assets: [{ id: 'a', width: 10, height: 10, mimeType: 'image/png', source: 'device', path: 'assets/a.png' }],
          }),
          'projects/p.json': project,
          'assets/a.png': svg,
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('refuses an archive too large to be read safely', async () => {
    await expect(readProjectArchive(new Uint8Array(10), { maxBytes: 5 })).rejects.toMatchObject({ code: 'too-large' });
    const big = rawArchive({ 'stickflow.json': manifest({}), 'projects/p.json': new Uint8Array(2000) });
    await expect(readProjectArchive(big, { maxEntryBytes: 1000 })).rejects.toMatchObject({ code: 'too-large' });
  });

  it('is an ArchiveError with a code the interface can explain', async () => {
    const error = await readProjectArchive(strToU8('x')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ArchiveError);
  });
});

describe('file names', () => {
  it('names a project file after the project, and a backup after the day', () => {
    expect(archiveFileName('Coup de poing !')).toBe('coup-de-poing.stickflow');
    expect(backupFileName(new Date(2026, 10, 2))).toBe('stickflow-sauvegarde-2026-11-02.stickflow');
  });
});
