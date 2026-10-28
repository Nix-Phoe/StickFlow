import { describe, expect, it } from 'vitest';

import { createEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { activeFrame, saveStatus, sequenceOf } from '../core/selectors';
import { createInitialState, Store } from '../core/store';
import { canUndo } from '../model/project';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createProjectLibrary, type KeyValueStore } from './library';
import { createMemoryStore } from './memory-store';
import { connectProjectStorage } from './project-storage';

function setup(store: KeyValueStore = createMemoryStore()) {
  const bus = createEventBus();
  const app = new Store(createInitialState('Saut', sortSkeleton(createDefaultSkeleton())));
  let id = 0;
  const library = createProjectLibrary(store, { now: () => 1000, newId: () => `p${++id}` });
  connectIntents(bus, app, { now: () => 0 });
  const storage = connectProjectStorage({ bus, store: app, library });
  return { bus, app, library, storage, status: () => saveStatus(app.state), session: () => app.state.session };
}

const failingStore = (): KeyValueStore => ({
  get: () => Promise.reject(new Error('disque plein')),
  set: () => Promise.reject(new Error('disque plein')),
  del: () => Promise.reject(new Error('disque plein')),
  keys: () => Promise.reject(new Error('disque plein')),
});

describe('connectProjectStorage: sauvegarder', () => {
  it('starts as a project that was never saved', () => {
    expect(setup().status()).toBe('unsaved');
  });

  it('saves a new project and remembers it as the current document', async () => {
    const { storage, library, status, session } = setup();
    await storage.save();
    expect(session().documentId).toBe('p1');
    expect(status()).toBe('saved');
    expect(session().notice).toMatchObject({ kind: 'success', code: 'saved' });
    expect(await library.list()).toHaveLength(1);
  });

  it('marks the project as modified after a change, and saves it in place', async () => {
    const { bus, storage, library, status } = setup();
    await storage.save();
    bus.emit('animation:fps:change', { fps: 24 });
    expect(status()).toBe('modified');
    await storage.save();
    expect(status()).toBe('saved');
    expect(await library.list()).toHaveLength(1);
    expect((await library.load('p1')).fps).toBe(24);
  });

  it('saves a copy under a new name with « save as »', async () => {
    const { storage, library, app, session } = setup();
    await storage.save();
    await storage.saveAs('Saut (copie)');
    expect(session().documentId).toBe('p2');
    expect(app.state.project.present.name).toBe('Saut (copie)');
    expect((await library.list()).map((e) => e.name).sort()).toEqual(['Saut', 'Saut (copie)']);
  });

  it('reports a failed save and keeps the status', async () => {
    const { storage, status, session } = setup(failingStore());
    await storage.save();
    expect(status()).toBe('unsaved');
    expect(session().notice).toMatchObject({ kind: 'error', code: 'save-failed' });
  });
});

describe('connectProjectStorage: ouvrir', () => {
  it('replaces the project with the opened one, with a fresh history', async () => {
    const { bus, storage, app, status, session } = setup();
    await storage.save();
    bus.emit('animation:fps:change', { fps: 30 });
    bus.emit('frame:select', { index: 3 });
    bus.emit('node:select', { nodeId: 'torso' });
    await storage.open('p1');
    expect(app.state.project.present.fps).toBe(12);
    expect(canUndo(app.state.project)).toBe(false);
    expect(activeFrame(app.state)?.frame.id).toBe(sequenceOf(app.state)[0]?.id);
    expect(session().selectedNodeId).toBeNull();
    expect(status()).toBe('saved');
  });

  it('reports a project that cannot be opened and keeps the current one', async () => {
    const { storage, app, session } = setup();
    const before = app.state.project;
    await storage.open('ghost');
    expect(app.state.project).toBe(before);
    expect(session().notice).toMatchObject({ kind: 'error', code: 'open-failed' });
  });

  it('lists the saved projects for the open dialog, and closes it', async () => {
    const { bus, storage, session } = setup();
    await storage.save();
    await storage.refreshLibrary();
    expect(session().library).toEqual([{ id: 'p1', name: 'Saut', savedAt: 1000 }]);
    bus.emit('project:library:close');
    expect(session().library).toBeNull();
  });
});

describe('connectIntents: nom du projet', () => {
  it('renames the project through a named change', () => {
    const { bus, app } = setup();
    bus.emit('project:rename', { name: 'Course' });
    expect(app.state.project.present.name).toBe('Course');
    expect(canUndo(app.state.project)).toBe(true);
  });
});
