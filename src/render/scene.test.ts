import { describe, expect, it } from 'vitest';

import type { SkeletonNode } from '../core/types';
import type { PosedNode } from '../model/kinematics';
import { buildCapsules, FLOATS_PER_CAPSULE, packCapsules, type Capsule } from './scene';

const style = { strokeWidth: 8 };

const skeleton: SkeletonNode[] = [
  { id: 'root', parentId: null, length: 0, angle: 0, shape: 'segment' },
  { id: 'body', parentId: 'root', length: 10, angle: Math.PI / 2, shape: 'segment' },
  { id: 'head', parentId: 'body', length: 6, angle: 0, shape: 'circle' },
];

const posed: PosedNode[] = [
  { id: 'root', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, angle: 0 },
  { id: 'body', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, angle: Math.PI / 2 },
  { id: 'head', start: { x: 0, y: 10 }, end: { x: 0, y: 16 }, angle: Math.PI / 2 },
];

describe('buildCapsules', () => {
  const capsules = buildCapsules(skeleton, posed, style);

  it('draws nothing for zero-length nodes such as the root', () => {
    expect(capsules).toHaveLength(2);
  });

  it('draws a segment as a capsule from its start to its end, half the stroke wide', () => {
    expect(capsules[0]).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 }, radius: 4 });
  });

  it('draws a circle as a filled disc spanning the segment', () => {
    expect(capsules[1]).toEqual({ a: { x: 0, y: 13 }, b: { x: 0, y: 13 }, radius: 3 });
  });

  it('follows the skeleton order so later nodes are drawn on top', () => {
    const reversed = buildCapsules(skeleton, [...posed].reverse(), style);
    expect(reversed).toEqual(capsules);
  });

  it('rejects a posed node that is missing', () => {
    expect(() => buildCapsules(skeleton, posed.slice(0, 2), style)).toThrow();
  });
});

describe('packCapsules', () => {
  const capsules: Capsule[] = [
    { a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, radius: 5 },
    { a: { x: 6, y: 7 }, b: { x: 8, y: 9 }, radius: 10 },
  ];

  it('packs start, end and radius contiguously for each capsule', () => {
    expect(Array.from(packCapsules(capsules))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('uses FLOATS_PER_CAPSULE floats per capsule', () => {
    expect(FLOATS_PER_CAPSULE).toBe(5);
    expect(packCapsules(capsules)).toHaveLength(2 * FLOATS_PER_CAPSULE);
  });

  it('returns an empty buffer for no capsules', () => {
    expect(packCapsules([])).toHaveLength(0);
  });
});
