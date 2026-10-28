import { describe, expect, it } from 'vitest';

import type { Keyframe, SkeletonNode } from '../core/types';
import { catmullRom, easeInOutCubic, interpolateKeyframes } from './interpolation';

const skeleton: SkeletonNode[] = [
  { id: 'root', parentId: null, length: 0, angle: 0, shape: 'segment' },
  { id: 'arm', parentId: 'root', length: 10, angle: 0, shape: 'segment' },
];

const key = (id: string, arm: number, x = 0): Keyframe => ({ id, pose: { arm }, rootPosition: { x, y: 0 } });

describe('easeInOutCubic', () => {
  it('starts at 0, ends at 1 and passes through the middle', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('starts and ends slowly', () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe('catmullRom', () => {
  it('passes through the two inner points', () => {
    expect(catmullRom(3, 1, 2, 7, 0)).toBeCloseTo(1, 9);
    expect(catmullRom(3, 1, 2, 7, 1)).toBeCloseTo(2, 9);
  });

  it('is a straight line for evenly spaced points', () => {
    expect(catmullRom(0, 1, 2, 3, 0.25)).toBeCloseTo(1.25, 9);
  });

  it('leaves a keyframe with a flat tangent when its neighbour repeats it', () => {
    // 0, 0, 1, 1 : départ et arrivée en douceur, milieu au milieu.
    expect(catmullRom(0, 0, 1, 1, 0.25)).toBeLessThan(0.25);
    expect(catmullRom(0, 0, 1, 1, 0.5)).toBeCloseTo(0.5, 9);
  });
});

describe('interpolateKeyframes', () => {
  const neighbours = (arms: [number, number, number, number]) => ({
    before: key('p', arms[0]),
    from: key('a', arms[1]),
    to: key('b', arms[2]),
    after: key('n', arms[3]),
  });

  it('is linear with the linear curve, ignoring the neighbours', () => {
    const { pose } = interpolateKeyframes(neighbours([5, 0, 1, -5]), 0.25, 'linear', skeleton);
    expect(pose.arm).toBeCloseTo(0.25, 9);
  });

  it('follows the Catmull-Rom spline through the neighbours with the smooth curve', () => {
    const { pose } = interpolateKeyframes(neighbours([0, 0, 1, 1]), 0.25, 'smooth', skeleton);
    expect(pose.arm).toBeCloseTo(catmullRom(0, 0, 1, 1, 0.25), 9);
  });

  it('eases the timing with the ease-in-out curve', () => {
    // Points alignés : la spline est une droite, seul le rythme change.
    const { pose } = interpolateKeyframes(neighbours([-1, 0, 1, 2]), 0.25, 'ease-in-out', skeleton);
    expect(pose.arm).toBeCloseTo(easeInOutCubic(0.25), 9);
  });

  it('turns the short way round across ±π, whatever the curve', () => {
    for (const curve of ['linear', 'smooth', 'ease-in-out'] as const) {
      const { pose } = interpolateKeyframes(neighbours([3, 3, -3, -3]), 0.5, curve, skeleton);
      expect(Math.abs(pose.arm ?? 0)).toBeCloseTo(Math.PI, 6);
    }
  });

  it('interpolates the root position along the same curve', () => {
    const frames = { before: key('p', 0, -10), from: key('a', 0, 0), to: key('b', 0, 10), after: key('n', 0, 20) };
    expect(interpolateKeyframes(frames, 0.5, 'smooth', skeleton).rootPosition.x).toBeCloseTo(5, 9);
  });

  it('uses the rest angle for a node posed in only some keyframes', () => {
    const frames = {
      before: { id: 'p', pose: {}, rootPosition: { x: 0, y: 0 } },
      from: { id: 'a', pose: {}, rootPosition: { x: 0, y: 0 } },
      to: key('b', 1),
      after: key('n', 1),
    };
    expect(interpolateKeyframes(frames, 0.5, 'linear', skeleton).pose.arm).toBeCloseTo(0.5, 9);
  });
});
