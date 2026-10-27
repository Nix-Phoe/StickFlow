import { describe, expect, it } from 'vitest';

import { createEventBus, type AppEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { createInitialState, Store } from '../core/store';
import type { Frame, Vec2 } from '../core/types';
import { solvePose } from '../model/kinematics';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { connectNodeManipulation } from './node-manipulation';

const HALF_PI = Math.PI / 2;
/** 800 × 400 px pour une hauteur de monde de 400 : 1 px = 1 unité, origine en (400, 200). */
const VIEWPORT = { width: 800, height: 400 };

function setup() {
  const bus = createEventBus();
  const skeleton = sortSkeleton(createDefaultSkeleton());
  const store = new Store(createInitialState('Test', skeleton));
  connectIntents(bus, store);
  connectNodeManipulation({ bus, store });
  const rest = solvePose(skeleton, {}, { x: 0, y: 0 });
  const handle = (id: string): Vec2 => {
    const posed = rest.find((p) => p.id === id);
    if (!posed) throw new Error(`missing ${id}`);
    return posed.end;
  };
  return { bus, store, handle };
}

function screen(p: Vec2, pointerId = 1) {
  return { pointerId, x: p.x + VIEWPORT.width / 2, y: VIEWPORT.height / 2 - p.y, ...VIEWPORT };
}
const down = (bus: AppEventBus, p: Vec2, id = 1): void => bus.emit('stage:pointer:down', screen(p, id));
const move = (bus: AppEventBus, p: Vec2, id = 1): void => bus.emit('stage:pointer:move', screen(p, id));
const up = (bus: AppEventBus, p: Vec2, id = 1): void => bus.emit('stage:pointer:up', screen(p, id));

function frameAt(store: Store, index: number): Frame {
  const frame = store.state.project.present.frames[index];
  if (!frame) throw new Error(`missing frame ${index}`);
  return frame;
}

describe('connectNodeManipulation: selection', () => {
  it('selects the node whose handle is under the pointer', () => {
    const { bus, store, handle } = setup();
    down(bus, handle('upperArmL'));
    expect(store.state.session.selectedNodeId).toBe('upperArmL');
  });

  it('clears the selection when pressing on empty space', () => {
    const { bus, store, handle } = setup();
    down(bus, handle('upperArmL'));
    up(bus, handle('upperArmL'));
    down(bus, { x: 300, y: 150 });
    expect(store.state.session.selectedNodeId).toBeNull();
  });

  it('ignores the stage while the animation is playing', () => {
    const { bus, store, handle } = setup();
    bus.emit('playback:play');
    down(bus, handle('upperArmL'));
    move(bus, { x: 100, y: 100 });
    expect(store.state.session.selectedNodeId).toBeNull();
    expect(frameAt(store, 0).pose).toEqual({});
  });
});

describe('connectNodeManipulation: dragging', () => {
  it('rotates the grabbed node to follow the pointer', () => {
    const { bus, store, handle } = setup();
    const shoulder = handle('torso');
    down(bus, handle('upperArmL'));
    move(bus, { x: shoulder.x + 40, y: shoulder.y });
    // Le torse est à +90° : pointer à droite de l'épaule donne -90° en relatif.
    expect(frameAt(store, 0).pose.upperArmL).toBeCloseTo(-HALF_PI, 6);
  });

  it('moves the whole figure when dragging the root', () => {
    const { bus, store } = setup();
    down(bus, { x: 0, y: 0 });
    move(bus, { x: 30, y: -20 });
    expect(frameAt(store, 0).rootPosition).toEqual({ x: 30, y: -20 });
  });

  it('stops following the pointer once released', () => {
    const { bus, store, handle } = setup();
    down(bus, handle('upperArmL'));
    up(bus, handle('upperArmL'));
    move(bus, { x: 100, y: 100 });
    expect(frameAt(store, 0).pose).toEqual({});
  });

  it('ignores other pointers during a drag', () => {
    const { bus, store, handle } = setup();
    down(bus, handle('upperArmL'), 1);
    move(bus, { x: 100, y: 100 }, 2);
    expect(frameAt(store, 0).pose).toEqual({});
  });

  it('only edits the active frame', () => {
    const { bus, store, handle } = setup();
    bus.emit('frame:select', { index: 1 });
    down(bus, { x: 0, y: 0 });
    move(bus, { x: 10, y: 0 });
    expect(frameAt(store, 1).rootPosition).toEqual({ x: 10, y: 0 });
    expect(frameAt(store, 0).rootPosition).toEqual({ x: 0, y: 0 });
    expect(handle('hip')).toEqual({ x: 0, y: 0 });
  });

  it('undoes a whole drag in one step', () => {
    const { bus, store, handle } = setup();
    const shoulder = handle('torso');
    down(bus, handle('upperArmL'));
    for (const dx of [10, 20, 30, 40]) move(bus, { x: shoulder.x + dx, y: shoulder.y });
    up(bus, { x: shoulder.x + 40, y: shoulder.y });
    bus.emit('history:undo');
    expect(frameAt(store, 0).pose).toEqual({});
  });

  it('turns an edited generated frame into a keyframe', () => {
    const { bus, store } = setup();
    bus.emit('frame:select', { index: 2 });
    expect(frameAt(store, 2).generated).toBe(true);
    down(bus, { x: 0, y: 0 });
    move(bus, { x: 10, y: 0 });
    expect(frameAt(store, 2).generated).toBe(false);
  });
});

describe('connectNodeManipulation: keyboard', () => {
  it('walks through the nodes in skeleton order', () => {
    const { bus, store } = setup();
    bus.emit('node:cycle', { direction: 1 });
    expect(store.state.session.selectedNodeId).toBe('hip');
    bus.emit('node:cycle', { direction: 1 });
    expect(store.state.session.selectedNodeId).toBe('torso');
  });

  it('nudges the selected node', () => {
    const { bus, store } = setup();
    bus.emit('node:select', { nodeId: 'torso' });
    bus.emit('node:nudge', { radians: 0.1 });
    expect(frameAt(store, 0).pose.torso).toBeCloseTo(HALF_PI + 0.1, 6);
  });

  it('does nothing when nudging without a selection', () => {
    const { bus, store } = setup();
    bus.emit('node:nudge', { radians: 0.1 });
    expect(frameAt(store, 0).pose).toEqual({});
  });
});
