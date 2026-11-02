import { describe, expect, it } from 'vitest';

import { imageBackground } from '../model/background';
import { createAssetStore } from '../storage/asset-store';
import { ArchiveError, type ProjectArchive } from '../storage/project-archive';
import type { InstallMode } from '../app/install';
import { createMemoryStore } from '../storage/memory-store';
import { createProjectLibrary } from '../storage/library';
import { createMemoryPreferences } from '../storage/preferences';
import { createVideoLibrary } from '../storage/video-store';
import { testProject } from '../test/fixtures';
import { createEventBus } from './events';
import { DEFAULT_FORMAT, presetFormat } from './formats';
import { connectHomeIntents, type HomeIntentOptions } from './home-intents';
import { createHomeState, DEFAULT_PREFERENCES, type HomeState } from './home-state';
import type { Route } from './router';
import { Store } from './store';

const TEMPLATE = testProject({ name: 'Marche', fps: 8 });

async function setup(overrides: Partial<HomeIntentOptions> = {}) {
  const bus = createEventBus();
  const store = new Store<HomeState>(createHomeState('home', DEFAULT_PREFERENCES));
  let time = 1000;
  let id = 0;
  const library = createProjectLibrary(createMemoryStore(), { now: () => time, newId: () => `p${++id}` });
  const preferences = createMemoryPreferences();
  const routes: Route[] = [];
  const home = connectHomeIntents({
    bus,
    store,
    library,
    preferences,
    navigate: (route) => routes.push(route),
    templates: { load: (templateId) => (templateId === 'walk' ? TEMPLATE : null) },
    names: { project: 'Projet sans titre', character: 'Personnage 1' },
    thumbnail: (project) => `data:${project.name}`,
    ...overrides,
  });
  await home.settled();
  return { bus, store, library, preferences, routes, home, state: () => store.state, later: () => (time += 1000) };
}

describe('connectHomeIntents: projets', () => {
  it('loads the saved projects when it starts', async () => {
    const library = createProjectLibrary(createMemoryStore());
    await library.save(testProject({ name: 'Saut' }));
    const { state } = await setup({ library });
    expect(state().projects?.map((p) => p.name)).toEqual(['Saut']);
  });

  it('creates a project in the chosen format and fps, with its thumbnail, then opens it in the editor', async () => {
    const { bus, home, library, routes } = await setup();
    bus.emit('project:create', { name: 'Course', format: presetFormat('vertical'), fps: 24 });
    await home.settled();
    expect(await library.load('p1')).toMatchObject({ name: 'Course', fps: 24, format: presetFormat('vertical') });
    expect((await library.list())[0]?.thumbnail).toBe('data:Course');
    expect(routes).toEqual([{ name: 'editor', projectId: 'p1' }]);
  });

  it('uses the default format, fps and a free name when none is given', async () => {
    const { bus, home, library, store } = await setup();
    store.update({ preferences: { ...DEFAULT_PREFERENCES, defaultFps: 30, defaultFormat: presetFormat('square') } });
    bus.emit('project:create', {});
    bus.emit('project:create', { name: '  ' });
    await home.settled();
    const projects = await Promise.all(['p1', 'p2'].map((id) => library.load(id)));
    expect(projects.map((p) => p.name)).toEqual(['Projet sans titre', 'Projet sans titre 2']);
    expect(projects[0]).toMatchObject({ fps: 30, format: presetFormat('square') });
  });

  it('starts from a copy of a template', async () => {
    const { bus, home, library } = await setup();
    bus.emit('project:create', { templateId: 'walk', format: DEFAULT_FORMAT });
    await home.settled();
    const project = await library.load('p1');
    expect(project.keyframes).toEqual(TEMPLATE.keyframes);
    expect(project.fps).toBe(8);
    expect(TEMPLATE.name).toBe('Marche');
  });

  it('opens a project and changes section through the router', async () => {
    const { bus, routes } = await setup();
    bus.emit('project:open', { projectId: 'p9' });
    bus.emit('route:change', { route: { name: 'projects' } });
    expect(routes).toEqual([{ name: 'editor', projectId: 'p9' }, { name: 'projects' }]);
  });

  it('renames, duplicates and deletes a saved project, and keeps the list up to date', async () => {
    const { bus, home, state, later } = await setup();
    bus.emit('project:create', { name: 'Saut' });
    await home.settled();
    later();
    bus.emit('library:rename', { projectId: 'p1', name: 'Grand saut' });
    await home.settled();
    expect(state().projects?.map((p) => p.name)).toEqual(['Grand saut']);
    later();
    bus.emit('library:duplicate', { projectId: 'p1', name: 'Grand saut (copie)' });
    await home.settled();
    expect(state().projects?.map((p) => p.name)).toEqual(['Grand saut (copie)', 'Grand saut']);
    bus.emit('library:delete', { projectId: 'p1' });
    await home.settled();
    expect(state().projects?.map((p) => p.id)).toEqual(['p2']);
    expect(state().notice).toMatchObject({ kind: 'success', code: 'deleted' });
  });

  it('shares the background image between a project and its copy, and deletes it with the last one (v2.1)', async () => {
    const assets = createAssetStore(createMemoryStore(), { newId: () => 'a1' });
    await assets.add({ blob: new Blob(['x']), width: 10, height: 10, mimeType: 'image/webp', source: 'device', thumbnail: null });
    const library = createProjectLibrary(createMemoryStore(), { newId: (() => { let n = 0; return () => `p${++n}`; })() });
    const base = testProject({ name: 'Forêt' });
    await library.save({ ...base, environment: { ...base.environment, background: imageBackground('a1') } });
    const { bus, home } = await setup({ library, assets });
    bus.emit('library:duplicate', { projectId: 'p1', name: 'Forêt (copie)' });
    await home.settled();
    bus.emit('library:delete', { projectId: 'p1' });
    await home.settled();
    expect(await assets.get('a1')).not.toBeNull();
    bus.emit('library:delete', { projectId: 'p2' });
    await home.settled();
    expect(await assets.get('a1')).toBeNull();
  });

  it('reports a failed action', async () => {
    const { bus, home, state } = await setup();
    bus.emit('library:rename', { projectId: 'ghost', name: 'x' });
    await home.settled();
    expect(state().notice).toMatchObject({ kind: 'error', code: 'action-failed' });
  });
});

describe('connectHomeIntents: recherche, tri, vue et réglages', () => {
  it('filters by search without remembering it', async () => {
    const { bus, state, preferences } = await setup();
    bus.emit('home:search', { query: 'saut' });
    expect(state().query).toBe('saut');
    expect(preferences.load()).toBeUndefined();
  });

  it('remembers the sort order, the view and the settings', async () => {
    const { bus, state, preferences } = await setup();
    bus.emit('home:sort', { sort: 'az' });
    bus.emit('home:view', { view: 'list' });
    bus.emit('settings:change', { theme: 'dark', defaultFps: 999, defaultFormat: presetFormat('portrait') });
    expect(state().preferences).toEqual({ sort: 'az', view: 'list', theme: 'dark', defaultFps: 60, defaultFormat: presetFormat('portrait'), installInviteDismissed: false });
    expect(preferences.load()).toEqual(state().preferences);
  });

  it('opens and closes the sheets', async () => {
    const { bus, state } = await setup();
    bus.emit('home:sheet', { sheet: { kind: 'create', templateId: 'walk' } });
    expect(state().sheet).toEqual({ kind: 'create', templateId: 'walk' });
    bus.emit('home:sheet', { sheet: null });
    expect(state().sheet).toBeNull();
  });

  it('follows whether the banner is on screen', async () => {
    const { bus, state } = await setup();
    bus.emit('home:hero:visibility', { visible: false });
    expect(state().heroVisible).toBe(false);
    bus.emit('home:hero:visibility', { visible: true });
    expect(state().heroVisible).toBe(true);
  });
});

describe('connectHomeIntents: vidéos', () => {
  const file = (extension: string, bytes = 100) => ({
    blob: new Blob([new Uint8Array(bytes)]),
    filename: `saut.${extension}`,
    extension,
    duration: 2,
  });

  async function withVideos(extension = 'mp4', storage = { usage: 100, quota: 1000 }) {
    const videos = createVideoLibrary(createMemoryStore(), { now: () => 5 });
    const downloads: string[] = [];
    const context = await setup({
      videos,
      estimateStorage: async () => storage,
      exportProject: async (_project, _format, onProgress) => {
        onProgress(0.5);
        return file(extension);
      },
      download: ({ filename }) => downloads.push(filename),
    });
    return { ...context, videos, downloads };
  }

  it('loads the kept videos and the storage used', async () => {
    const { state } = await withVideos();
    expect(state().videos).toEqual([]);
    expect(state().storage).toEqual({ usage: 100, quota: 1000 });
  });

  it('exports a saved project, downloads it and keeps a video in « Mes vidéos »', async () => {
    const { bus, home, state, downloads } = await withVideos('mp4');
    bus.emit('project:create', { name: 'Saut' });
    await home.settled();
    bus.emit('library:export', { projectId: 'p1', format: 'mp4' });
    await home.settled();
    expect(downloads).toEqual(['saut.mp4']);
    expect(state().videos).toEqual([expect.objectContaining({ projectId: 'p1', projectName: 'Saut', type: 'mp4', duration: 2, size: 100 })]);
    expect(state().exporting).toBeNull();
    expect(state().notice).toMatchObject({ code: 'exported', detail: 'saut.mp4' });
  });

  it('does not keep a PNG sequence', async () => {
    const { bus, home, state } = await withVideos('zip');
    bus.emit('project:create', { name: 'Saut' });
    await home.settled();
    bus.emit('library:export', { projectId: 'p1', format: 'png' });
    await home.settled();
    expect(state().videos).toEqual([]);
  });

  it('deletes one video, the oldest ones when space runs out, or all of them', async () => {
    const { bus, home, state, videos } = await withVideos('mp4', { usage: 900, quota: 1000 });
    for (const name of ['a', 'b', 'c', 'd']) await videos.add({ projectId: null, projectName: name, type: 'gif', blob: new Blob([new Uint8Array(100)]), duration: 1, thumbnail: null });
    await home.refresh();
    const [newest] = state().videos ?? [];
    bus.emit('video:delete', { videoId: newest?.id ?? '' });
    await home.settled();
    expect(state().videos).toHaveLength(3);
    expect(state().notice).toMatchObject({ code: 'video-deleted' });
    // 900 / 1000 : il faut libérer 200 octets, soit les deux plus anciennes vidéos.
    bus.emit('videos:prune');
    await home.settled();
    expect(state().videos).toHaveLength(1);
    bus.emit('videos:clear');
    await home.settled();
    expect(state().videos).toEqual([]);
    expect(state().notice).toMatchObject({ code: 'videos-cleared' });
  });
});

describe('connectHomeIntents: fichiers .stickflow et stockage protégé (v2.2)', () => {
  const ARCHIVE: ProjectArchive = {
    projects: [{ id: 'imported', name: 'Venu d’ailleurs', createdAt: 10, updatedAt: 20, project: testProject({ name: 'Venu d’ailleurs' }) }],
    assets: [],
  };

  async function withArchive(read: (file: Blob) => Promise<ProjectArchive> = async () => ARCHIVE) {
    const written: Array<{ names: string[]; assets: number }> = [];
    const downloads: string[] = [];
    const context = await setup({
      assets: createAssetStore(createMemoryStore()),
      archive: {
        write: async ({ projects, assets }) => {
          written.push({ names: projects.map((p) => p.name), assets: assets.length });
          return new Blob(['zip']);
        },
        read,
      },
      download: ({ filename }) => downloads.push(filename),
      now: () => new Date(2026, 10, 2).getTime(),
    });
    return { ...context, written, downloads };
  }

  it('exports one project to a .stickflow file named after it', async () => {
    const { bus, home, state, written, downloads } = await withArchive();
    bus.emit('project:create', { name: 'Coup de poing' });
    await home.settled();
    bus.emit('library:export-file', { projectId: 'p1' });
    await home.settled();
    expect(written).toEqual([{ names: ['Coup de poing'], assets: 0 }]);
    expect(downloads).toEqual(['coup-de-poing.stickflow']);
    expect(state().notice).toMatchObject({ kind: 'success', code: 'project-exported', detail: 'coup-de-poing.stickflow' });
  });

  it('backs up every project in one dated file, and says so when there is nothing to back up', async () => {
    const { bus, home, state, written, downloads } = await withArchive();
    bus.emit('library:backup');
    await home.settled();
    expect(downloads).toEqual([]);
    expect(state().notice).toMatchObject({ kind: 'error', code: 'backup-empty' });
    for (const name of ['Saut', 'Course']) {
      bus.emit('project:create', { name });
      await home.settled();
    }
    bus.emit('library:backup');
    await home.settled();
    expect(written.at(-1)?.names.sort()).toEqual(['Course', 'Saut']);
    expect(downloads).toEqual(['stickflow-sauvegarde-2026-11-02.stickflow']);
    expect(state().notice).toMatchObject({ code: 'backup-created' });
  });

  it('imports the projects of a file into the library', async () => {
    const { bus, home, state } = await withArchive();
    bus.emit('library:import', { file: new Blob(['zip']) });
    await home.settled();
    expect(state().projects?.map((p) => p.name)).toEqual(['Venu d’ailleurs']);
    expect(state().notice).toMatchObject({ kind: 'success', code: 'imported', detail: '1' });
    expect(state().transfer).toBeNull();
  });

  it('explains why a file cannot be imported', async () => {
    const { bus, home, state } = await withArchive(async () => {
      throw new ArchiveError('too-new');
    });
    bus.emit('library:import', { file: new Blob(['zip']) });
    await home.settled();
    expect(state().notice).toMatchObject({ kind: 'error', code: 'import-failed', detail: 'too-new' });
    expect(state().projects).toEqual([]);
  });

  it('shows whether the storage is protected, and asks again on demand', async () => {
    let persisted = false;
    const protection = {
      status: async () => persisted,
      request: async () => (persisted = true),
    };
    const { bus, home, state } = await setup({ protection });
    expect(state().storageProtected).toBe(false);
    bus.emit('storage:protect');
    await home.settled();
    expect(state().storageProtected).toBe(true);
  });
});

describe('connectHomeIntents: installation de l’app (v2.2)', () => {
  it('follows what the browser allows, and opens its install prompt on demand', async () => {
    let mode: InstallMode = 'unavailable';
    const listeners: Array<(next: InstallMode) => void> = [];
    let prompts = 0;
    const installer = {
      mode: () => mode,
      subscribe: (listener: (next: InstallMode) => void) => {
        listeners.push(listener);
        return () => undefined;
      },
      prompt: async () => {
        prompts += 1;
        return true;
      },
    };
    const { bus, home, state } = await setup({ installer });
    expect(state().install).toBe('unavailable');
    mode = 'prompt';
    listeners.forEach((listener) => listener(mode));
    expect(state().install).toBe('prompt');
    bus.emit('app:install');
    await home.settled();
    expect(prompts).toBe(1);
  });
});
