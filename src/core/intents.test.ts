import { describe, expect, it } from 'vitest';

import { canRedo, canUndo } from '../model/project';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createEventBus } from './events';
import { connectIntents } from './intents';
import { createInitialState, Store } from './store';

function setup() {
  const bus = createEventBus();
  const store = new Store(createInitialState('Test', sortSkeleton(createDefaultSkeleton())));
  let now = 0;
  connectIntents(bus, store, { now: () => now });
  return {
    bus,
    store,
    project: () => store.state.project.present,
    session: () => store.state.session,
    /** Avance l'horloge, pour séparer ou rapprocher les changements. */
    wait: (ms: number) => {
      now += ms;
    },
  };
}

describe('connectIntents: Projet', () => {
  it('lets the Projet module clamp the fps', () => {
    const { bus, project } = setup();
    bus.emit('animation:fps:change', { fps: 99 });
    expect(project().fps).toBe(60);
  });

  it('undoes and redoes a Projet change', () => {
    const { bus, store, project } = setup();
    bus.emit('animation:fps:change', { fps: 30 });
    bus.emit('history:undo');
    expect(project().fps).toBe(12);
    expect(canRedo(store.state.project)).toBe(true);
    bus.emit('history:redo');
    expect(project().fps).toBe(30);
  });

  it('groups a slider drag into a single undo step', () => {
    const { bus, store, project, wait } = setup();
    for (const intensity of [4, 5, 6]) {
      bus.emit('ai:smoothing:change', { intensity });
      wait(50);
    }
    bus.emit('history:undo');
    expect(project().ai.smoothing.intensity).toBe(3);
    expect(canUndo(store.state.project)).toBe(false);
  });

  it('keeps the repeat count when the loop goes infinite and back', () => {
    const { bus, project } = setup();
    bus.emit('ai:loop:change', { repeatCount: 7 });
    bus.emit('ai:loop:change', { infinite: true });
    bus.emit('ai:loop:change', { infinite: false });
    expect(project().ai.loop.repeatCount).toBe(7);
  });
});

describe('connectIntents: frames', () => {
  it('inserts a new frame after the active one and makes it active', () => {
    const { bus, project, session } = setup();
    const before = project().frames.map((f) => f.id);
    bus.emit('frame:select', { index: 1 });
    bus.emit('frame:add');
    const after = project().frames.map((f) => f.id);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[3]).toBe(before[2]);
    expect(session().activeFrameIndex).toBe(2);
  });

  it('keeps the active frame within the frames after an undo', () => {
    const { bus, project, session } = setup();
    const count = project().frames.length;
    bus.emit('frame:select', { index: count - 1 });
    bus.emit('frame:add');
    expect(session().activeFrameIndex).toBe(count);
    bus.emit('history:undo');
    expect(session().activeFrameIndex).toBe(count - 1);
  });

  it('clamps the selected frame index', () => {
    const { bus, session, project } = setup();
    bus.emit('frame:select', { index: 99 });
    expect(session().activeFrameIndex).toBe(project().frames.length - 1);
  });
});

describe('connectIntents: Session', () => {
  it('never puts Session changes in the undo history', () => {
    const { bus, store, session } = setup();
    bus.emit('playback:play');
    bus.emit('playback:speed:change', { speed: 5 });
    bus.emit('editor:mode:change', { mode: 'scene' });
    expect(canUndo(store.state.project)).toBe(false);
    bus.emit('history:undo');
    expect(session().isPlaying).toBe(true);
    expect(session().playbackSpeed).toBe(5);
  });
});
