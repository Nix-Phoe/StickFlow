import { describe, expect, it } from 'vitest';

import { createMemoryStore } from '../storage/memory-store';
import { createProjectLibrary } from '../storage/library';
import { createMemoryPreferences } from '../storage/preferences';
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
    expect(state().preferences).toEqual({ sort: 'az', view: 'list', theme: 'dark', defaultFps: 60, defaultFormat: presetFormat('portrait') });
    expect(preferences.load()).toEqual(state().preferences);
  });

  it('opens and closes the sheets', async () => {
    const { bus, state } = await setup();
    bus.emit('home:sheet', { sheet: { kind: 'create', templateId: 'walk' } });
    expect(state().sheet).toEqual({ kind: 'create', templateId: 'walk' });
    bus.emit('home:sheet', { sheet: null });
    expect(state().sheet).toBeNull();
  });
});
