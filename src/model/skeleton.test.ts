import { describe, expect, it } from 'vitest';

import type { SkeletonNode } from '../core/types';
import { createDefaultSkeleton, SkeletonError, sortSkeleton } from './skeleton';

const node = (id: string, parentId: string | null, length = 10): SkeletonNode => ({
  id,
  parentId,
  length,
  angle: 0,
  shape: 'segment',
});

describe('createDefaultSkeleton', () => {
  const skeleton = createDefaultSkeleton();

  it('has exactly one root', () => {
    expect(skeleton.filter((n) => n.parentId === null)).toHaveLength(1);
  });

  it('only references existing parents', () => {
    const ids = new Set(skeleton.map((n) => n.id));
    for (const n of skeleton) {
      if (n.parentId !== null) expect(ids.has(n.parentId)).toBe(true);
    }
  });

  it('has a circular head', () => {
    expect(skeleton.find((n) => n.id === 'head')?.shape).toBe('circle');
  });

  it('has two arms and two legs of two segments each', () => {
    for (const id of ['upperArmL', 'forearmL', 'upperArmR', 'forearmR', 'thighL', 'shinL', 'thighR', 'shinR']) {
      expect(skeleton.some((n) => n.id === id)).toBe(true);
    }
  });

  it('is valid', () => {
    expect(() => sortSkeleton(skeleton)).not.toThrow();
  });

  it('returns a new array on each call', () => {
    expect(createDefaultSkeleton()).not.toBe(createDefaultSkeleton());
  });
});

describe('sortSkeleton', () => {
  it('orders parents before their children', () => {
    const sorted = sortSkeleton([node('c', 'b'), node('b', 'a'), node('a', null, 0)]);
    expect(sorted.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps siblings in their original order', () => {
    const sorted = sortSkeleton([node('root', null, 0), node('x', 'root'), node('y', 'root')]);
    expect(sorted.map((n) => n.id)).toEqual(['root', 'x', 'y']);
  });

  it('does not mutate its input', () => {
    const input = [node('b', 'a'), node('a', null, 0)];
    sortSkeleton(input);
    expect(input.map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('rejects a skeleton without a root', () => {
    expect(() => sortSkeleton([node('a', 'b'), node('b', 'a')])).toThrow(SkeletonError);
  });

  it('rejects several roots', () => {
    expect(() => sortSkeleton([node('a', null), node('b', null)])).toThrow(SkeletonError);
  });

  it('rejects an unknown parent', () => {
    expect(() => sortSkeleton([node('a', null), node('b', 'ghost')])).toThrow(SkeletonError);
  });

  it('rejects a cycle hanging off the root', () => {
    expect(() => sortSkeleton([node('a', null), node('b', 'c'), node('c', 'b')])).toThrow(SkeletonError);
  });

  it('rejects duplicate ids', () => {
    expect(() => sortSkeleton([node('a', null), node('a', 'a')])).toThrow(SkeletonError);
  });

  it('rejects a negative length', () => {
    expect(() => sortSkeleton([node('a', null), node('b', 'a', -1)])).toThrow(SkeletonError);
  });
});
