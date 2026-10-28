import { describe, expect, it } from 'vitest';

import type { Project } from '../core/types';
import { posedCharacter } from '../model/character';
import type { SequenceFrame } from '../model/sequence';
import { ORIGIN, testCharacter, testFrame, testProject } from '../test/fixtures';
import { pickCharacterTarget, type HitTolerance } from './hit-test';

const tolerance: HitTolerance = { handle: 10, segment: 4 };
const project: Project = testProject({
  characters: [testCharacter('c1'), testCharacter('c2'), testCharacter('locked', { locked: true }), testCharacter('hidden', { visible: false })],
  keyframes: [
    testFrame('f1', {}, ORIGIN, {
      c2: { pose: {}, rootPosition: { x: 10, y: 0 } },
      locked: { pose: {}, rootPosition: { x: -200, y: 0 } },
      hidden: { pose: {}, rootPosition: { x: 200, y: 0 } },
    }),
  ],
});
const frame: SequenceFrame = { kind: 'keyframe', id: 'f1', poses: project.keyframes[0]?.poses ?? {} };

const endOf = (characterId: string, nodeId: string) => {
  const character = project.characters.find((c) => c.id === characterId);
  const pose = frame.poses[characterId];
  if (!character || !pose) throw new Error('missing');
  const node = posedCharacter(character, pose).find((n) => n.id === nodeId);
  if (!node) throw new Error('missing node');
  return node;
};
const middle = (n: { start: { x: number; y: number }; end: { x: number; y: number } }) => ({
  x: (n.start.x + n.end.x) / 2,
  y: (n.start.y + n.end.y) / 2,
});

describe('pickCharacterTarget', () => {
  it('prefers a handle of the selected character', () => {
    const hand = endOf('c1', 'forearmL').end;
    expect(pickCharacterTarget(project, frame, hand, tolerance, 'c1')).toEqual({ characterId: 'c1', nodeId: 'forearmL', target: 'node' });
  });

  it('does not offer the handles of characters that are not selected', () => {
    const hand = endOf('c1', 'forearmL').end;
    expect(pickCharacterTarget(project, frame, hand, tolerance, null)?.target).not.toBe('node');
  });

  it('hits a segment of any character, the topmost first', () => {
    // c2 (au-dessus) est décalé de 10 : au milieu de son torse, c'est lui qui est touché.
    const torso = middle(endOf('c2', 'torso'));
    expect(pickCharacterTarget(project, frame, torso, tolerance, null)).toEqual({ characterId: 'c2', nodeId: 'torso', target: 'segment' });
  });

  it('hits the head as a part of its own', () => {
    const head = middle(endOf('c1', 'head'));
    expect(pickCharacterTarget(project, frame, { x: head.x - 15, y: head.y }, tolerance, null)).toMatchObject({ characterId: 'c1', nodeId: 'head' });
  });

  it('falls back to the whole character inside its frame', () => {
    const torso = middle(endOf('c1', 'torso'));
    const beside = { x: torso.x - 30, y: torso.y };
    expect(pickCharacterTarget(project, frame, beside, tolerance, null)).toEqual({ characterId: 'c1', nodeId: null, target: 'character' });
  });

  it('ignores locked and hidden characters', () => {
    expect(pickCharacterTarget(project, frame, middle(endOf('locked', 'torso')), tolerance, 'locked')).toBeNull();
    expect(pickCharacterTarget(project, frame, middle(endOf('hidden', 'torso')), tolerance, null)).toBeNull();
  });

  it('returns null in empty space', () => {
    expect(pickCharacterTarget(project, frame, { x: 0, y: 190 }, tolerance, null)).toBeNull();
  });
});
