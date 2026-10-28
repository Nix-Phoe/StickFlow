import { describe, expect, it } from 'vitest';

import { canRedo, canUndo } from '../model/project';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createEventBus } from './events';
import { connectIntents } from './intents';
import { activeFrame, sequenceOf } from './selectors';
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
    sequence: () => sequenceOf(store.state),
    active: () => activeFrame(store.state)?.frame,
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

describe('connectIntents: sequence and selection', () => {
  it('starts on the first of 2 keyframes with 3 generated frames between them', () => {
    const { sequence, active } = setup();
    expect(sequence().map((f) => f.kind)).toEqual(['keyframe', 'generated', 'generated', 'generated', 'keyframe']);
    expect(active()?.id).toBe(sequence()[0]?.id);
  });

  it('selects a frame of the sequence by its position, clamped', () => {
    const { bus, sequence, active } = setup();
    bus.emit('frame:select', { index: 2 });
    expect(active()?.id).toBe(sequence()[2]?.id);
    bus.emit('frame:select', { index: 99 });
    expect(active()?.id).toBe(sequence().at(-1)?.id);
  });

  it('stays at the same place when the active generated frame disappears', () => {
    const { bus, sequence, active } = setup();
    bus.emit('frame:select', { index: 2 });
    bus.emit('ai:smoothing:change', { enabled: false });
    expect(sequence()).toHaveLength(2);
    expect(active()?.id).toBe(sequence()[1]?.id);
  });
});

describe('connectIntents: frame actions', () => {
  it('inserts a copy of the active keyframe after it and makes it active', () => {
    const { bus, project, active } = setup();
    bus.emit('frame:add');
    expect(project().keyframes).toHaveLength(3);
    expect(active()?.id).toBe(project().keyframes[1]?.id);
    expect(project().keyframes[1]?.pose).toEqual(project().keyframes[0]?.pose);
  });

  it('turns a generated frame into a keyframe when « + » is pressed on it', () => {
    const { bus, project, sequence, active } = setup();
    const generated = sequence()[2];
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:add');
    expect(project().keyframes).toHaveLength(3);
    expect(project().keyframes[1]?.pose).toEqual(generated?.pose);
    expect(active()?.kind).toBe('keyframe');
  });

  it('turns a posed generated frame into a keyframe between its neighbours, undone in one step', () => {
    const { bus, project, sequence, active } = setup();
    const [first, , generated] = sequence();
    if (!first || !generated) throw new Error('sequence too short');
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:pose:change', { frameId: generated.id, pose: { torso: 1 }, rootPosition: { x: 0, y: 0 } });
    expect(project().keyframes.map((k) => k.pose.torso)).toEqual([undefined, 1, undefined]);
    expect(project().keyframes[0]?.id).toBe(first.id);
    expect(active()?.kind).toBe('keyframe');
    expect(active()?.pose).toEqual({ torso: 1 });
    bus.emit('history:undo');
    expect(project().keyframes).toHaveLength(2);
  });

  it('deletes the active keyframe and keeps a valid active frame', () => {
    const { bus, project, active } = setup();
    const second = project().keyframes[1];
    bus.emit('frame:select', { index: 4 });
    bus.emit('frame:delete');
    expect(project().keyframes.map((k) => k.id)).not.toContain(second?.id);
    expect(active()?.id).toBe(project().keyframes[0]?.id);
  });

  it('never deletes the last remaining keyframe', () => {
    const { bus, project } = setup();
    for (let i = 0; i < 5; i += 1) bus.emit('frame:delete');
    expect(project().keyframes).toHaveLength(1);
  });

  it('does not delete a generated frame', () => {
    const { bus, store } = setup();
    const before = store.state.project;
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:delete');
    expect(store.state.project).toBe(before);
  });

  it('copies the pose of the active frame and pastes it on another keyframe, undoably', () => {
    const { bus, project, wait } = setup();
    bus.emit('frame:select', { index: 4 });
    bus.emit('frame:copy');
    const copied = project().keyframes[1]?.pose;
    bus.emit('frame:select', { index: 0 });
    wait(5000);
    bus.emit('frame:paste');
    expect(project().keyframes[0]?.pose).toEqual(copied);
    bus.emit('history:undo');
    expect(project().keyframes[0]?.pose).toEqual({});
  });

  it('turns a generated frame into a keyframe when pasting on it', () => {
    const { bus, project, active } = setup();
    bus.emit('frame:copy');
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:paste');
    expect(project().keyframes).toHaveLength(3);
    expect(active()?.kind).toBe('keyframe');
    expect(active()?.pose).toEqual({});
  });

  it('does nothing when pasting with an empty clipboard', () => {
    const { bus, store } = setup();
    const before = store.state.project;
    bus.emit('frame:paste');
    expect(store.state.project).toBe(before);
  });
});

describe('connectIntents: Session', () => {
  it('never puts Session changes in the undo history', () => {
    const { bus, store, session } = setup();
    bus.emit('playback:play');
    bus.emit('playback:speed:change', { speed: 5 });
    bus.emit('editor:mode:change', { mode: 'scene' });
    bus.emit('frame:select', { index: 3 });
    expect(canUndo(store.state.project)).toBe(false);
    bus.emit('history:undo');
    expect(session().isPlaying).toBe(true);
    expect(session().playbackSpeed).toBe(5);
  });

  it('moves the playhead without touching the Projet', () => {
    const { bus, store, sequence, active } = setup();
    const before = store.state.project;
    bus.emit('playback:frame', { index: 3 });
    expect(active()?.id).toBe(sequence()[3]?.id);
    expect(store.state.project).toBe(before);
  });

  it('toggles between play and pause with a single event', () => {
    const { bus, session } = setup();
    bus.emit('playback:toggle');
    expect(session().isPlaying).toBe(true);
    bus.emit('playback:toggle');
    expect(session().isPlaying).toBe(false);
  });

  it('switches the onion skin on and off', () => {
    const { bus, session } = setup();
    bus.emit('animation:onion-skin:change', { enabled: false });
    expect(session().onionSkin).toBe(false);
  });
});
