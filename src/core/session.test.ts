import { describe, expect, it } from 'vitest';

import type { SequenceFrame } from '../model/sequence';
import { testCharacter, testProject, testShape } from '../test/fixtures';
import { clearSelection, createSession, fitSessionToSequence, selectPart, type Session } from './session';

const frame = (id: string): SequenceFrame => ({ kind: 'keyframe', id, poses: {} });
const sequence = [frame('a'), frame('b'), frame('c')];
const project = testProject({
  characters: [testCharacter('c1'), testCharacter('c2')],
  environment: { background: null, shapes: [testShape('s1')], drawing: { tiles: {} } },
});
const fit = (session: Session, next = sequence) => fitSessionToSequence(session, sequence, next, project);

describe('createSession', () => {
  it('starts paused, with nothing selected, the onion skin on and an empty clipboard', () => {
    const session = createSession();
    expect(session.activeFrameId).toBeNull();
    expect(session.isPlaying).toBe(false);
    expect(session.selectedCharacterId).toBeNull();
    expect(session.selectedNodeId).toBeNull();
    expect(session.selectedParts).toEqual([]);
    expect(session.selectedShapeId).toBeNull();
    expect(session.onionSkin).toBe(true);
    expect(session.clipboard).toBeNull();
  });

  it('starts in the Personnages mode, panel closed, with the selection tool', () => {
    const session = createSession();
    expect(session.editorMode).toBe('characters');
    expect(session.panelOpen).toBe(false);
    expect(session.tool).toBe('select');
  });
});

describe('fitSessionToSequence', () => {
  it('returns the same session when everything still exists', () => {
    const session: Session = {
      ...createSession(),
      activeFrameId: 'b',
      selectedCharacterId: 'c2',
      selectedNodeId: 'torso',
      selectedParts: ['torso'],
      selectedShapeId: 's1',
    };
    expect(fit(session)).toBe(session);
  });

  it('picks the first frame when nothing is active yet', () => {
    expect(fitSessionToSequence(createSession(), [], sequence, project).activeFrameId).toBe('a');
  });

  it('stays at the same place when the active frame disappears', () => {
    expect(fit({ ...createSession(), activeFrameId: 'b' }, [frame('a'), frame('c')]).activeFrameId).toBe('c');
  });

  it('falls back to the last frame when the active frame was at the end', () => {
    expect(fit({ ...createSession(), activeFrameId: 'c' }, [frame('a'), frame('b')]).activeFrameId).toBe('b');
  });

  it('clears the node and parts that are not in the selected character', () => {
    const session = { ...createSession(), activeFrameId: 'a', selectedCharacterId: 'c1', selectedNodeId: 'tail', selectedParts: ['tail', 'head'] };
    expect(fit(session)).toMatchObject({ selectedNodeId: null, selectedParts: ['head'] });
  });

  it('clears the whole character selection when the character is gone', () => {
    const session = { ...createSession(), activeFrameId: 'a', selectedCharacterId: 'ghost', selectedNodeId: 'head', selectedParts: ['head'] };
    expect(fit(session)).toMatchObject({ selectedCharacterId: null, selectedNodeId: null, selectedParts: [] });
  });

  it('clears a selected shape that no longer exists', () => {
    expect(fit({ ...createSession(), activeFrameId: 'a', selectedShapeId: 'ghost' }).selectedShapeId).toBeNull();
  });
});

describe('selectPart', () => {
  const base = createSession();

  it('selects a whole character when no node is given', () => {
    expect(selectPart(base, 'c1', null, false)).toMatchObject({ selectedCharacterId: 'c1', selectedNodeId: null, selectedParts: [] });
  });

  it('selects one part, replacing the previous parts', () => {
    const one = selectPart(base, 'c1', 'head', false);
    expect(selectPart(one, 'c1', 'torso', false)).toMatchObject({ selectedNodeId: 'torso', selectedParts: ['torso'] });
  });

  it('adds and removes parts with Maj', () => {
    const one = selectPart(base, 'c1', 'head', false);
    const two = selectPart(one, 'c1', 'torso', true);
    expect(two.selectedParts).toEqual(['head', 'torso']);
    const back = selectPart(two, 'c1', 'torso', true);
    expect(back).toMatchObject({ selectedParts: ['head'], selectedNodeId: 'head' });
  });

  it('starts over when Maj-clicking a part of another character', () => {
    const one = selectPart(base, 'c1', 'head', false);
    expect(selectPart(one, 'c2', 'torso', true)).toMatchObject({ selectedCharacterId: 'c2', selectedParts: ['torso'] });
  });

  it('unselects any shape', () => {
    expect(selectPart({ ...base, selectedShapeId: 's1' }, 'c1', null, false).selectedShapeId).toBeNull();
  });
});

describe('clearSelection', () => {
  it('unselects characters, parts and shapes', () => {
    const session = { ...selectPart(base(), 'c1', 'head', false), selectedShapeId: 's1' };
    expect(clearSelection(session)).toMatchObject({
      selectedCharacterId: null,
      selectedNodeId: null,
      selectedParts: [],
      selectedShapeId: null,
    });
  });
});

function base(): Session {
  return createSession();
}
