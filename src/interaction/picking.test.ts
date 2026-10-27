import { describe, expect, it } from 'vitest';

import type { PosedNode } from '../model/kinematics';
import { pickNode } from './picking';

const posed: PosedNode[] = [
  { id: 'root', start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, angle: 0 },
  { id: 'arm', start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, angle: 0 },
  { id: 'hand', start: { x: 10, y: 0 }, end: { x: 20, y: 0 }, angle: 0 },
];

describe('pickNode', () => {
  it('picks the node whose handle (its end) is under the point', () => {
    expect(pickNode(posed, { x: 10, y: 0 }, 3)).toBe('arm');
  });

  it('picks the root by its position', () => {
    expect(pickNode(posed, { x: 0.5, y: -0.5 }, 3)).toBe('root');
  });

  it('picks the nearest handle within the tolerance', () => {
    expect(pickNode(posed, { x: 17, y: 1 }, 5)).toBe('hand');
  });

  it('returns null when no handle is within the tolerance', () => {
    expect(pickNode(posed, { x: 5, y: 0 }, 3)).toBeNull();
  });

  it('counts a handle exactly at the tolerance distance as hit', () => {
    expect(pickNode(posed, { x: 13, y: 0 }, 3)).toBe('arm');
  });

  it('prefers the node drawn last when two handles are equally close', () => {
    const stacked: PosedNode[] = [...posed, { id: 'finger', start: { x: 20, y: 0 }, end: { x: 10, y: 0 }, angle: Math.PI }];
    expect(pickNode(stacked, { x: 10, y: 0 }, 3)).toBe('finger');
  });

  it('returns null for an empty pose', () => {
    expect(pickNode([], { x: 0, y: 0 }, 3)).toBeNull();
  });
});
