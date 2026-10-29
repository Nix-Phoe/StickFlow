import { describe, expect, it } from 'vitest';

import type { SkeletonNode } from '../core/types';
import type { PosedNode } from '../model/kinematics';
import { buildCapsules, buildHandles, FLOATS_PER_CAPSULE, FLOATS_PER_SHAPE, packCapsules, packShapes, type ColoredCapsule } from './scene';

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
    expect(capsules[0]).toEqual({ nodeId: 'body', a: { x: 0, y: 0 }, b: { x: 0, y: 10 }, radius: 4 });
  });

  it('draws a circle as a filled disc spanning the segment', () => {
    expect(capsules[1]).toEqual({ nodeId: 'head', a: { x: 0, y: 13 }, b: { x: 0, y: 13 }, radius: 3 });
  });

  it('follows the skeleton order so later nodes are drawn on top', () => {
    const reversed = buildCapsules(skeleton, [...posed].reverse(), style);
    expect(reversed).toEqual(capsules);
  });

  it('scales the stroke and the head with the character size', () => {
    const big = buildCapsules(skeleton, posed, style, 2);
    expect(big[0]?.radius).toBe(8);
    expect(big[1]?.radius).toBe(6);
  });

  it('rejects a posed node that is missing', () => {
    expect(() => buildCapsules(skeleton, posed.slice(0, 2), style)).toThrow();
  });
});

describe('packCapsules', () => {
  const capsules: ColoredCapsule[] = [
    { a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, radius: 5, color: [0.5, 0.25, 1, 1] },
    { a: { x: 6, y: 7 }, b: { x: 8, y: 9 }, radius: 10, color: [0, 0, 0, 0.5] },
  ];

  it('packs start, end, radius, colour and an open clip (whole capsule) for each capsule', () => {
    expect(Array.from(packCapsules(capsules))).toEqual([
      1, 2, 3, 4, 5, 0.5, 0.25, 1, 1, 1, 2, 3, 4, 0, 1,
      6, 7, 8, 9, 10, 0, 0, 0, 0.5, 6, 7, 8, 9, 0, 1,
    ]);
  });

  it('packs the clip of a colour band: its axis and its stretch along it', () => {
    const band: ColoredCapsule = {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      radius: 20,
      color: [1, 0, 0, 1],
      clip: { start: { x: 0, y: -20 }, end: { x: 0, y: 20 }, from: 0.55, to: 1 },
    };
    expect(Array.from(packCapsules([band])).slice(9)).toEqual([0, -20, 0, 20, 0.550000011920929, 1]);
  });

  it('uses FLOATS_PER_CAPSULE floats per capsule', () => {
    expect(FLOATS_PER_CAPSULE).toBe(15);
    expect(packCapsules(capsules)).toHaveLength(2 * FLOATS_PER_CAPSULE);
  });

  it('returns an empty buffer for no capsules', () => {
    expect(packCapsules([])).toHaveLength(0);
  });
});

describe('buildHandles', () => {
  const handleStyle = { jointRadius: 4, rootRadius: 7, selectedRadius: 6, haloRadius: 12 };

  it('puts a joint handle at the end of every non-root node', () => {
    const { joints } = buildHandles(skeleton, posed, null, handleStyle);
    expect(joints).toEqual([
      { a: { x: 0, y: 10 }, b: { x: 0, y: 10 }, radius: 4 },
      { a: { x: 0, y: 16 }, b: { x: 0, y: 16 }, radius: 4 },
    ]);
  });

  it('marks the root with a larger handle of its own', () => {
    expect(buildHandles(skeleton, posed, null, handleStyle).root).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, radius: 7 },
    ]);
  });

  it('draws no selection when nothing is selected', () => {
    const { selected, halo } = buildHandles(skeleton, posed, null, handleStyle);
    expect(selected).toEqual([]);
    expect(halo).toEqual([]);
  });

  it('highlights the selected node with a bigger handle and a halo', () => {
    const { selected, halo } = buildHandles(skeleton, posed, 'body', handleStyle);
    expect(selected).toEqual([{ a: { x: 0, y: 10 }, b: { x: 0, y: 10 }, radius: 6 }]);
    expect(halo).toEqual([{ a: { x: 0, y: 10 }, b: { x: 0, y: 10 }, radius: 12 }]);
  });

  it('ignores a selection that is not in the pose', () => {
    expect(buildHandles(skeleton, posed, 'ghost', handleStyle).selected).toEqual([]);
  });
});

describe('packShapes', () => {
  it('packs centre, half size, rotation, kind, stroke width, fill and stroke colours', () => {
    const data = packShapes([
      {
        kind: 'triangle',
        x: 1,
        y: 2,
        width: 6,
        height: 8,
        rotation: 0.5,
        strokeWidth: 3,
        fill: null,
        stroke: [1, 0, 0, 0.5],
      },
    ]);
    expect(FLOATS_PER_SHAPE).toBe(15);
    expect(Array.from(data)).toEqual([1, 2, 3, 4, 0.5, 3, 3, 0, 0, 0, 0, 1, 0, 0, 0.5]);
  });
});
