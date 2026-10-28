import { describe, expect, it } from 'vitest';

import type { SequenceFrame } from '../model/sequence';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createSession, fitSessionToSequence } from './session';

const skeleton = sortSkeleton(createDefaultSkeleton());
const frame = (id: string): SequenceFrame => ({ kind: 'keyframe', id, pose: {}, rootPosition: { x: 0, y: 0 } });
const sequence = [frame('a'), frame('b'), frame('c')];

describe('createSession', () => {
  it('starts paused, with nothing selected, the onion skin on and an empty clipboard', () => {
    const session = createSession();
    expect(session.activeFrameId).toBeNull();
    expect(session.isPlaying).toBe(false);
    expect(session.selectedNodeId).toBeNull();
    expect(session.onionSkin).toBe(true);
    expect(session.clipboard).toBeNull();
  });
});

describe('fitSessionToSequence', () => {
  it('returns the same session when the active frame still exists', () => {
    const session = { ...createSession(), activeFrameId: 'b', selectedNodeId: 'torso' };
    expect(fitSessionToSequence(session, sequence, sequence, skeleton)).toBe(session);
  });

  it('picks the first frame when nothing is active yet', () => {
    expect(fitSessionToSequence(createSession(), [], sequence, skeleton).activeFrameId).toBe('a');
  });

  it('stays at the same place when the active frame disappears', () => {
    const session = { ...createSession(), activeFrameId: 'b' };
    const next = [frame('a'), frame('c')];
    expect(fitSessionToSequence(session, sequence, next, skeleton).activeFrameId).toBe('c');
  });

  it('falls back to the last frame when the active frame was at the end', () => {
    const session = { ...createSession(), activeFrameId: 'c' };
    const next = [frame('a'), frame('b')];
    expect(fitSessionToSequence(session, sequence, next, skeleton).activeFrameId).toBe('b');
  });

  it('clears a selection whose node no longer exists', () => {
    const session = { ...createSession(), activeFrameId: 'a', selectedNodeId: 'tail' };
    expect(fitSessionToSequence(session, sequence, sequence, skeleton).selectedNodeId).toBeNull();
  });
});
