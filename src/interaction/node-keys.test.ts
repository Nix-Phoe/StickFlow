import { describe, expect, it } from 'vitest';

import type { SkeletonNode } from '../core/types';
import { cycleNode, nudgeNode } from './node-keys';

const node = (id: string, parentId: string | null, angle = 0): SkeletonNode => ({
  id,
  parentId,
  length: 10,
  angle,
  shape: 'segment',
});

const skeleton = [node('root', null), node('a', 'root', 1), node('b', 'a', 2)];

describe('cycleNode', () => {
  it('selects the first node when nothing is selected', () => {
    expect(cycleNode(skeleton, null, 1)).toBe('root');
  });

  it('selects the last node when going backwards from nothing', () => {
    expect(cycleNode(skeleton, null, -1)).toBe('b');
  });

  it('moves to the next node in skeleton order', () => {
    expect(cycleNode(skeleton, 'root', 1)).toBe('a');
  });

  it('wraps around both ways', () => {
    expect(cycleNode(skeleton, 'b', 1)).toBe('root');
    expect(cycleNode(skeleton, 'root', -1)).toBe('b');
  });

  it('restarts from the ends when the selected node no longer exists', () => {
    expect(cycleNode(skeleton, 'ghost', 1)).toBe('root');
  });

  it('returns null for an empty skeleton', () => {
    expect(cycleNode([], null, 1)).toBeNull();
  });
});

describe('nudgeNode', () => {
  it('adds the delta to the posed angle', () => {
    expect(nudgeNode({ a: 0.5 }, skeleton, 'a', 0.25).a).toBeCloseTo(0.75, 9);
  });

  it('starts from the rest angle when the node is not posed yet', () => {
    expect(nudgeNode({}, skeleton, 'b', -0.5).b).toBeCloseTo(1.5, 9);
  });

  it('keeps the angle normalised', () => {
    expect(nudgeNode({ a: Math.PI - 0.1 }, skeleton, 'a', 0.2).a).toBeCloseTo(-Math.PI + 0.1, 9);
  });

  it('returns a new pose and leaves the input untouched', () => {
    const pose = { a: 0.5 };
    const next = nudgeNode(pose, skeleton, 'a', 0.25);
    expect(next).not.toBe(pose);
    expect(pose).toEqual({ a: 0.5 });
  });

  it('rejects an unknown node', () => {
    expect(() => nudgeNode({}, skeleton, 'ghost', 0.1)).toThrow();
  });
});
