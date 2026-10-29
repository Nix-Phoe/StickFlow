import { describe, expect, it } from 'vitest';

import { canRedo, canUndo } from '../model/project';
import { DEFAULT_FORMAT, presetFormat } from './formats';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createEventBus } from './events';
import { connectIntents } from './intents';
import { activeFrame, sequenceOf } from './selectors';
import { createInitialState, Store } from './store';
import type { FramePose } from './types';

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
    /** Id du personnage de départ. */
    hero: () => store.state.project.present.characters[0]?.id ?? '',
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

  it('changes the video format of the project, undoably', () => {
    const { bus, project } = setup();
    bus.emit('project:format:change', { format: presetFormat('vertical') });
    expect(project().format).toEqual(presetFormat('vertical'));
    bus.emit('history:undo');
    expect(project().format).toEqual(DEFAULT_FORMAT);
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

/** Pose d'un personnage dans une frame (image clé ou frame de la séquence). */
const poseOf = (frame: { poses: Readonly<Record<string, FramePose>> } | undefined, id: string) => frame?.poses[id]?.pose;

describe('connectIntents: frame actions', () => {
  it('inserts a copy of the active keyframe after it and makes it active', () => {
    const { bus, project, active, hero } = setup();
    bus.emit('frame:add');
    expect(project().keyframes).toHaveLength(3);
    expect(active()?.id).toBe(project().keyframes[1]?.id);
    expect(poseOf(project().keyframes[1], hero())).toEqual(poseOf(project().keyframes[0], hero()));
  });

  it('turns a generated frame into a keyframe when « + » is pressed on it', () => {
    const { bus, project, sequence, active, hero } = setup();
    const generated = sequence()[2];
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:add');
    expect(project().keyframes).toHaveLength(3);
    expect(poseOf(project().keyframes[1], hero())).toEqual(poseOf(generated, hero()));
    expect(active()?.kind).toBe('keyframe');
  });

  it('turns a posed generated frame into a keyframe between its neighbours, undone in one step', () => {
    const { bus, project, sequence, active, hero } = setup();
    const [first, , generated] = sequence();
    if (!first || !generated) throw new Error('sequence too short');
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:pose:change', { frameId: generated.id, characterId: hero(), pose: { torso: 1 }, rootPosition: { x: 0, y: 0 } });
    expect(project().keyframes.map((k) => poseOf(k, hero())?.torso)).toEqual([undefined, 1, undefined]);
    expect(project().keyframes[0]?.id).toBe(first.id);
    expect(active()?.kind).toBe('keyframe');
    expect(poseOf(active(), hero())).toEqual({ torso: 1 });
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
    const { bus, project, wait, hero } = setup();
    bus.emit('frame:select', { index: 4 });
    bus.emit('frame:copy');
    const copied = poseOf(project().keyframes[1], hero());
    bus.emit('frame:select', { index: 0 });
    wait(5000);
    bus.emit('frame:paste');
    expect(poseOf(project().keyframes[0], hero())).toEqual(copied);
    bus.emit('history:undo');
    expect(poseOf(project().keyframes[0], hero())).toEqual({});
  });

  it('turns a generated frame into a keyframe when pasting on it', () => {
    const { bus, project, active, hero } = setup();
    bus.emit('frame:copy');
    bus.emit('frame:select', { index: 2 });
    bus.emit('frame:paste');
    expect(project().keyframes).toHaveLength(3);
    expect(active()?.kind).toBe('keyframe');
    expect(poseOf(active(), hero())).toEqual({});
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
    bus.emit('editMode:change', { mode: 'environment' });
    bus.emit('panel:toggle', { open: true });
    bus.emit('tool:select', { tool: 'pen' });
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

describe('connectIntents: characters', () => {
  it('starts with one character, selected', () => {
    const { project, session, hero } = setup();
    expect(project().characters).toHaveLength(1);
    expect(session().selectedCharacterId).toBe(hero());
  });

  it('adds a character, selects it, and undoes the addition', () => {
    const { bus, project, session } = setup();
    bus.emit('character:add', { name: 'Personnage 2' });
    const added = project().characters[1];
    expect(added?.name).toBe('Personnage 2');
    expect(session().selectedCharacterId).toBe(added?.id);
    bus.emit('history:undo');
    expect(project().characters).toHaveLength(1);
    expect(session().selectedCharacterId).toBeNull();
  });

  it('duplicates, renames, reorders, hides, locks and removes a character', () => {
    const { bus, project, session, hero, wait } = setup();
    bus.emit('character:duplicate', { characterId: hero(), name: 'Copie' });
    const copy = session().selectedCharacterId ?? '';
    expect(project().characters.map((c) => c.name)).toEqual([project().characters[0]?.name, 'Copie']);
    wait(5000);
    bus.emit('character:rename', { characterId: copy, name: 'Bob' });
    bus.emit('character:reorder', { characterId: copy, direction: -1 });
    expect(project().characters[0]?.name).toBe('Bob');
    bus.emit('character:visibility', { characterId: copy, visible: false });
    bus.emit('character:lock', { characterId: copy, locked: true });
    expect(project().characters[0]).toMatchObject({ visible: false, locked: true });
    bus.emit('character:remove', { characterId: copy });
    expect(project().characters.map((c) => c.id)).toEqual([hero()]);
  });

  it('unselects a character that gets locked', () => {
    const { bus, session, hero } = setup();
    bus.emit('character:lock', { characterId: hero(), locked: true });
    expect(session().selectedCharacterId).toBeNull();
  });

  it('selects parts, with Maj to add more', () => {
    const { bus, session, hero } = setup();
    bus.emit('segment:select', { characterId: hero(), nodeId: 'head', additive: false });
    bus.emit('segment:select', { characterId: hero(), nodeId: 'torso', additive: true });
    expect(session().selectedParts).toEqual(['head', 'torso']);
    bus.emit('character:select', { characterId: null });
    expect(session().selectedParts).toEqual([]);
  });

  it('colours parts and scales a character, undoably, recording the committed colour', () => {
    const { bus, project, hero, wait } = setup();
    bus.emit('appearance:color', { characterId: hero(), parts: ['head'], color: '#ff0000' });
    bus.emit('color:commit', { color: '#ff0000' });
    wait(5000);
    bus.emit('appearance:scale', { characterId: hero(), scale: 1.5 });
    expect(project().characters[0]?.appearance).toMatchObject({ scale: 1.5, segmentColors: { head: '#ff0000' } });
    expect(project().recentColors).toEqual(['#ff0000']);
    bus.emit('history:undo');
    bus.emit('history:undo');
    expect(project().characters[0]?.appearance.segmentColors).toEqual({});
    expect(project().recentColors).toEqual(['#ff0000']);
  });

  it('colours parts partially (colour bands), undoably', () => {
    const { bus, project, hero } = setup();
    const sleeve = { from: 0, to: 0.5, color: '#990000' };
    bus.emit('appearance:bands', { characterId: hero(), bands: { upperArmL: [sleeve], upperArmR: [sleeve] } });
    expect(project().characters[0]?.appearance.segmentBands).toEqual({ upperArmL: [sleeve], upperArmR: [sleeve] });
    bus.emit('history:undo');
    expect(project().characters[0]?.appearance.segmentBands).toEqual({});
  });

  it('opens the partial colouring window and keeps its settings in the Session', () => {
    const { bus, store, session } = setup();
    expect(session().partialPaint).toEqual({ open: false, symmetric: true, color: '#9b1b30' });
    bus.emit('partialPaint:change', { open: true, color: '#123456' });
    bus.emit('partialPaint:change', { symmetric: false });
    expect(session().partialPaint).toEqual({ open: true, symmetric: false, color: '#123456' });
    expect(canUndo(store.state.project)).toBe(false);
  });

  it('ignores an invalid colour for the partial colouring window', () => {
    const { bus, session } = setup();
    bus.emit('partialPaint:change', { color: 'rouge' });
    expect(session().partialPaint.color).toBe('#9b1b30');
  });

  it('closes the partial colouring window when leaving the Personnages mode', () => {
    const { bus, session } = setup();
    bus.emit('partialPaint:change', { open: true });
    bus.emit('editMode:change', { mode: 'environment' });
    expect(session().partialPaint.open).toBe(false);
  });

  it('poses the given character only', () => {
    const { bus, project, hero, active } = setup();
    bus.emit('character:add', { name: 'B' });
    const other = project().characters[1]?.id ?? '';
    const frameId = active()?.id ?? '';
    bus.emit('frame:pose:change', { frameId, characterId: other, pose: { torso: 2 }, rootPosition: { x: 9, y: 0 } });
    expect(poseOf(project().keyframes[0], other)).toEqual({ torso: 2 });
    expect(poseOf(project().keyframes[0], hero())).toEqual({});
  });
});

describe('connectIntents: environment', () => {
  const shape = {
    id: 's1',
    kind: 'square' as const,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    stroke: '#000000',
    fill: null,
    strokeWidth: 2,
    opacity: 1,
  };

  it('creates, selects, updates, duplicates and removes shapes', () => {
    const { bus, project, session } = setup();
    bus.emit('shape:create', { shape });
    expect(session().selectedShapeId).toBe('s1');
    bus.emit('shape:update', { shapeId: 's1', changes: { x: 20 } });
    expect(project().environment.shapes[0]?.x).toBe(20);
    bus.emit('shape:duplicate', { shapeId: 's1' });
    expect(project().environment.shapes).toHaveLength(2);
    expect(session().selectedShapeId).toBe(project().environment.shapes[1]?.id);
    bus.emit('shape:remove', { shapeId: session().selectedShapeId ?? '' });
    expect(project().environment.shapes).toHaveLength(1);
    expect(session().selectedShapeId).toBeNull();
  });

  it('records a drawing stroke as one undo step', () => {
    const { bus, project } = setup();
    bus.emit('drawing:stroke', { tiles: { '0,0': 'data:a' } });
    expect(project().environment.drawing.tiles).toEqual({ '0,0': 'data:a' });
    bus.emit('history:undo');
    expect(project().environment.drawing.tiles).toEqual({});
  });

  it('switches mode, opens the panel and picks tools without touching the history', () => {
    const { bus, store, session } = setup();
    bus.emit('editMode:change', { mode: 'environment' });
    bus.emit('panel:toggle', { open: true });
    bus.emit('tool:select', { tool: 'rectangle' });
    bus.emit('tool:settings', { strokeWidth: 12, filled: true });
    expect(session()).toMatchObject({ editorMode: 'environment', panelOpen: true, tool: 'rectangle' });
    expect(session().toolSettings).toMatchObject({ strokeWidth: 12, filled: true });
    expect(canUndo(store.state.project)).toBe(false);
  });

  it('unselects the shape when going back to the Personnages mode, and the character in Environnement', () => {
    const { bus, session } = setup();
    bus.emit('shape:create', { shape });
    bus.emit('editMode:change', { mode: 'characters' });
    expect(session().selectedShapeId).toBeNull();
    bus.emit('editMode:change', { mode: 'environment' });
    expect(session().selectedCharacterId).toBeNull();
  });

  it('stops the eyedropper once a colour is picked', () => {
    const { bus, session } = setup();
    bus.emit('eyedropper:start');
    expect(session().eyedropper).toBe(true);
    bus.emit('eyedropper:pick', { color: '#123456' });
    expect(session().eyedropper).toBe(false);
  });
});
