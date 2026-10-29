import { describe, expect, it } from 'vitest';

import { createEventBus, type AppEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { sequenceOf } from '../core/selectors';
import { createInitialState, Store } from '../core/store';
import type { Vec2 } from '../core/types';
import { solvePose } from '../model/kinematics';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { DEFAULT_FORMAT } from '../core/formats';
import { stageWorldHeight, worldToScreen } from '../render/camera';
import { connectCharacterManipulation } from './character-manipulation';

const HALF_PI = Math.PI / 2;
/** Scène de 800 × 400 px montrant le cadre 16:9 du projet, avec sa marge. */
const VIEWPORT = { width: 800, height: 400 };
const WORLD_HEIGHT = stageWorldHeight(VIEWPORT, DEFAULT_FORMAT);

function setup() {
  const bus = createEventBus();
  const skeleton = sortSkeleton(createDefaultSkeleton());
  const store = new Store(createInitialState('Test', skeleton));
  connectIntents(bus, store);
  connectCharacterManipulation({ bus, store });
  const rest = solvePose(skeleton, {}, { x: 0, y: 0 });
  const posedNode = (id: string) => {
    const posed = rest.find((p) => p.id === id);
    if (!posed) throw new Error(`missing ${id}`);
    return posed;
  };
  const handle = (id: string): Vec2 => posedNode(id).end;
  const middleOf = (id: string): Vec2 => {
    const { start, end } = posedNode(id);
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  };
  const hero = store.state.project.present.characters[0]?.id ?? '';
  const poseAt = (index: number, characterId = hero) => sequenceOf(store.state)[index]?.poses[characterId];
  return { bus, store, handle, middleOf, hero, poseAt, session: () => store.state.session };
}

interface Extra {
  pointerId?: number;
  shiftKey?: boolean;
  pointerType?: 'mouse' | 'touch';
}

function screen(p: Vec2, extra: Extra = {}) {
  return { pointerId: 1, ...worldToScreen(p, VIEWPORT, WORLD_HEIGHT), ...VIEWPORT, ...extra };
}
const down = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:down', screen(p, extra));
const move = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:move', screen(p, extra));
const up = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:up', screen(p, extra));

describe('connectCharacterManipulation: selection', () => {
  it('selects the node whose handle is under the pointer, and its part', () => {
    const { bus, session, handle } = setup();
    down(bus, handle('upperArmL'));
    expect(session()).toMatchObject({ selectedNodeId: 'upperArmL', selectedParts: ['upperArmL'] });
  });

  it('selects a part by pressing on its segment, Maj adding more', () => {
    const { bus, session, middleOf, hero } = setup();
    bus.emit('character:select', { characterId: null });
    down(bus, middleOf('thighL'));
    up(bus, middleOf('thighL'));
    expect(session()).toMatchObject({ selectedCharacterId: hero, selectedParts: ['thighL'] });
    down(bus, middleOf('torso'), { shiftKey: true });
    up(bus, middleOf('torso'), { shiftKey: true });
    expect(session().selectedParts).toEqual(['thighL', 'torso']);
  });

  it('selects the whole character inside its frame, and clears everything in empty space', () => {
    const { bus, session, hero, middleOf } = setup();
    bus.emit('character:select', { characterId: null });
    const torso = middleOf('torso');
    down(bus, { x: torso.x - 30, y: torso.y });
    up(bus, { x: torso.x - 30, y: torso.y });
    expect(session()).toMatchObject({ selectedCharacterId: hero, selectedParts: [] });
    down(bus, { x: 300, y: 150 });
    expect(session().selectedCharacterId).toBeNull();
  });

  it('is wider around a handle for a finger than for a mouse', () => {
    const { bus, session, handle, hero } = setup();
    const near = { x: handle('forearmL').x - 16, y: handle('forearmL').y };
    down(bus, near, { pointerType: 'mouse' });
    up(bus, near, { pointerType: 'mouse' });
    expect(session().selectedNodeId).not.toBe('forearmL');
    bus.emit('character:select', { characterId: hero });
    down(bus, near, { pointerType: 'touch' });
    expect(session().selectedNodeId).toBe('forearmL');
  });

  it('ignores the stage while playing, in the Environnement mode, or with the eyedropper', () => {
    const { bus, session, handle, poseAt } = setup();
    const blockers = [
      () => bus.emit('playback:play'),
      () => bus.emit('editMode:change', { mode: 'environment' }),
      () => bus.emit('eyedropper:start'),
    ];
    for (const block of blockers) {
      bus.emit('node:select', { nodeId: null });
      block();
      down(bus, handle('upperArmL'));
      move(bus, { x: 100, y: 100 });
      up(bus, { x: 100, y: 100 });
      expect(session().selectedNodeId).toBeNull();
      expect(poseAt(0)?.pose).toEqual({});
      bus.emit('playback:pause');
      bus.emit('editMode:change', { mode: 'characters' });
      bus.emit('eyedropper:cancel');
    }
  });
});

describe('connectCharacterManipulation: dragging', () => {
  it('rotates the grabbed node to follow the pointer', () => {
    const { bus, handle, poseAt } = setup();
    const shoulder = handle('torso');
    down(bus, handle('upperArmL'));
    move(bus, { x: shoulder.x + 40, y: shoulder.y });
    // Le torse est à +90° : pointer à droite de l'épaule donne -90° en relatif.
    expect(poseAt(0)?.pose.upperArmL).toBeCloseTo(-HALF_PI, 6);
  });

  it('rotates a part dragged by its segment', () => {
    const { bus, handle, middleOf, poseAt } = setup();
    bus.emit('character:select', { characterId: null });
    const shoulder = handle('torso');
    down(bus, middleOf('upperArmL'));
    move(bus, { x: shoulder.x + 40, y: shoulder.y });
    expect(poseAt(0)?.pose.upperArmL).toBeCloseTo(-HALF_PI, 1);
  });

  it('moves the whole figure when dragging the root, or the character by its frame', () => {
    const { bus, poseAt } = setup();
    down(bus, { x: 0, y: 0 });
    move(bus, { x: 30, y: -20 });
    up(bus, { x: 30, y: -20 });
    expect(poseAt(0)?.rootPosition).toEqual({ x: 30, y: -20 });
    // Dans le cadre du personnage (déplacé en 30, -20), à 30 à gauche du torse, loin des bras.
    const inside = { x: 0, y: 30 };
    down(bus, inside);
    move(bus, { x: inside.x + 5, y: inside.y });
    expect(poseAt(0)?.rootPosition.x).toBeCloseTo(35, 6);
  });

  it('does not drag after a Maj click (it only changes the selection)', () => {
    const { bus, middleOf, poseAt } = setup();
    down(bus, middleOf('torso'), { shiftKey: true });
    move(bus, { x: 100, y: 0 }, { shiftKey: true });
    expect(poseAt(0)?.pose).toEqual({});
  });

  it('poses the character that was grabbed, not the others', () => {
    const { bus, store, poseAt, hero } = setup();
    bus.emit('character:add', { name: 'B' });
    const other = store.state.project.present.characters[1]?.id ?? '';
    const root = poseAt(0, other)?.rootPosition ?? { x: 0, y: 0 };
    down(bus, root);
    move(bus, { x: root.x, y: root.y + 10 });
    expect(poseAt(0, other)?.rootPosition.y).toBeCloseTo(10, 6);
    expect(poseAt(0, hero)?.rootPosition).toEqual({ x: 0, y: 0 });
  });

  it('stops following the pointer once released, and ignores other pointers', () => {
    const { bus, handle, poseAt } = setup();
    down(bus, handle('upperArmL'), { pointerId: 1 });
    move(bus, { x: 100, y: 100 }, { pointerId: 2 });
    up(bus, handle('upperArmL'), { pointerId: 1 });
    move(bus, { x: 100, y: 100 }, { pointerId: 1 });
    expect(poseAt(0)?.pose).toEqual({});
  });

  it('only edits the active frame, a generated frame becoming a keyframe in one undo step', () => {
    const { bus, store, poseAt } = setup();
    bus.emit('frame:select', { index: 2 });
    down(bus, { x: 0, y: 0 });
    for (const x of [5, 10, 15]) move(bus, { x, y: 0 });
    up(bus, { x: 15, y: 0 });
    expect(store.state.project.present.keyframes).toHaveLength(3);
    expect(poseAt(0)?.rootPosition).toEqual({ x: 0, y: 0 });
    bus.emit('history:undo');
    expect(store.state.project.present.keyframes).toHaveLength(2);
  });
});

describe('connectCharacterManipulation: keyboard', () => {
  it('walks through the nodes of the selected character', () => {
    const { bus, session } = setup();
    bus.emit('node:cycle', { direction: 1 });
    expect(session().selectedNodeId).toBe('hip');
    bus.emit('node:cycle', { direction: 1 });
    expect(session().selectedNodeId).toBe('torso');
  });

  it('nudges the selected node, and does nothing without one', () => {
    const { bus, poseAt } = setup();
    bus.emit('node:nudge', { radians: 0.1 });
    expect(poseAt(0)?.pose).toEqual({});
    bus.emit('node:select', { nodeId: 'torso' });
    bus.emit('node:nudge', { radians: 0.1 });
    expect(poseAt(0)?.pose.torso).toBeCloseTo(HALF_PI + 0.1, 6);
  });
});
