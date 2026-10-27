import { describe, expect, it } from 'vitest';

import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { createSession, fitSessionToProject } from './session';
import type { Frame, Project } from './types';

const frame = (id: string): Frame => ({ id, pose: {}, rootPosition: { x: 0, y: 0 }, generated: false });

const project: Project = {
  name: 'Test',
  fps: 12,
  skeleton: sortSkeleton(createDefaultSkeleton()),
  frames: [frame('a'), frame('b')],
  ai: {
    smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
    loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4 },
  },
};

describe('createSession', () => {
  it('starts on the first frame, paused, with nothing selected', () => {
    const session = createSession();
    expect(session.activeFrameIndex).toBe(0);
    expect(session.isPlaying).toBe(false);
    expect(session.selectedNodeId).toBeNull();
  });
});

describe('fitSessionToProject', () => {
  it('returns the same session when it already fits', () => {
    const session = { ...createSession(), activeFrameIndex: 1, selectedNodeId: 'torso' };
    expect(fitSessionToProject(session, project)).toBe(session);
  });

  it('brings the active frame back within the frames', () => {
    const session = { ...createSession(), activeFrameIndex: 5 };
    expect(fitSessionToProject(session, project).activeFrameIndex).toBe(1);
  });

  it('clears a selection whose node no longer exists', () => {
    const session = { ...createSession(), selectedNodeId: 'tail' };
    expect(fitSessionToProject(session, project).selectedNodeId).toBeNull();
  });
});

describe('createSession: phase 4', () => {
  it('shows the onion skin and has an empty clipboard', () => {
    const session = createSession();
    expect(session.onionSkin).toBe(true);
    expect(session.clipboard).toBeNull();
  });
});
