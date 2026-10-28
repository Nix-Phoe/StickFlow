import { describe, expect, it } from 'vitest';

import type { Keyframe, Project, SkeletonNode, SmoothingSettings } from '../core/types';
import { deriveSequence } from './sequence';

const skeleton: SkeletonNode[] = [
  { id: 'root', parentId: null, length: 0, angle: 0, shape: 'segment' },
  { id: 'arm', parentId: 'root', length: 10, angle: 1, shape: 'segment' },
];

const key = (id: string, pose: Record<string, number> = {}, x = 0): Keyframe => ({
  id,
  pose,
  rootPosition: { x, y: 0 },
});

function project(keyframes: Keyframe[], smoothing: Partial<SmoothingSettings> = {}): Project {
  return {
    name: 'Test',
    fps: 12,
    skeleton,
    keyframes,
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'linear', ...smoothing },
      loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4 },
    },
  };
}

const kinds = (p: Project): string[] => deriveSequence(p).map((f) => f.kind);

describe('deriveSequence: structure', () => {
  it('is just the keyframes when smoothing is off', () => {
    const sequence = deriveSequence(project([key('a'), key('b')], { enabled: false }));
    expect(sequence.map((f) => [f.kind, f.id])).toEqual([
      ['keyframe', 'a'],
      ['keyframe', 'b'],
    ]);
  });

  it('puts `intensity` generated frames between each pair of consecutive keyframes', () => {
    expect(kinds(project([key('a'), key('b'), key('c')], { intensity: 2 }))).toEqual([
      'keyframe',
      'generated',
      'generated',
      'keyframe',
      'generated',
      'generated',
      'keyframe',
    ]);
  });

  it('generates nothing for a single keyframe', () => {
    expect(kinds(project([key('a')]))).toEqual(['keyframe']);
  });

  it('tells each generated frame which keyframes it sits between, and its rank', () => {
    const [, first, second] = deriveSequence(project([key('a'), key('b')], { intensity: 2 }));
    expect(first).toMatchObject({ kind: 'generated', from: 'a', to: 'b', step: 1 });
    expect(second).toMatchObject({ kind: 'generated', from: 'a', to: 'b', step: 2 });
  });

  it('gives every frame a unique id', () => {
    const ids = deriveSequence(project([key('a'), key('b'), key('c')])).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives generated frames the same id for the same keyframes and rank', () => {
    const before = deriveSequence(project([key('a'), key('b')]))[2]?.id;
    const after = deriveSequence(project([key('a', { arm: 2 }), key('b')]))[2]?.id;
    expect(after).toBe(before);
  });
});

describe('deriveSequence: interpolation (linéaire)', () => {
  it('interpolates angles evenly between the two keyframes', () => {
    // 3 intermédiaires : t = 1/4, 2/4, 3/4.
    const sequence = deriveSequence(project([key('a', { arm: 0 }), key('b', { arm: 1 })]));
    expect(sequence.slice(1, 4).map((f) => f.pose.arm)).toEqual([0.25, 0.5, 0.75]);
  });

  it('turns the short way round across ±π', () => {
    const [, middle] = deriveSequence(project([key('a', { arm: 3 }), key('b', { arm: -3 })], { intensity: 1 }));
    expect(Math.abs(middle?.pose.arm ?? 0)).toBeCloseTo(Math.PI, 6);
  });

  it('uses the rest angle for a node posed in only one keyframe', () => {
    // Repos de arm = 1 ; b le pose à 2 : le milieu vaut 1,5.
    const [, middle] = deriveSequence(project([key('a'), key('b', { arm: 2 })], { intensity: 1 }));
    expect(middle?.pose.arm).toBeCloseTo(1.5, 9);
  });

  it('leaves out nodes posed in neither keyframe', () => {
    const [, middle] = deriveSequence(project([key('a'), key('b')], { intensity: 1 }));
    expect(middle?.pose).toEqual({});
  });

  it('interpolates the root position', () => {
    const [, middle] = deriveSequence(project([key('a', {}, 0), key('b', {}, 10)], { intensity: 1 }));
    expect(middle?.rootPosition).toEqual({ x: 5, y: 0 });
  });
});

describe('deriveSequence: non destructif et mémoïsé', () => {
  it('copies keyframes unchanged into the sequence', () => {
    const a = key('a', { arm: 0.3 }, 4);
    const [first] = deriveSequence(project([a, key('b')]));
    expect(first).toMatchObject({ kind: 'keyframe', id: 'a', pose: { arm: 0.3 }, rootPosition: { x: 4, y: 0 } });
  });

  it('never mutates the keyframes', () => {
    const keyframes = [key('a', { arm: 0 }), key('b', { arm: 1 })];
    const snapshot = structuredClone(keyframes);
    deriveSequence(project(keyframes));
    expect(keyframes).toEqual(snapshot);
  });

  it('returns the same sequence while keyframes, skeleton and smoothing are unchanged', () => {
    const p = project([key('a'), key('b')]);
    expect(deriveSequence({ ...p, fps: 30 })).toBe(deriveSequence(p));
  });

  it('reuses the frames of segments that did not change', () => {
    const a = key('a');
    const b = key('b');
    const before = deriveSequence(project([a, b, key('c')]));
    const after = deriveSequence(project([a, b, key('c', { arm: 2 })]));
    // Le segment a → b est intact : mêmes objets, donc pas de vignette à repeindre.
    expect(after.slice(0, 5)).toEqual(before.slice(0, 5));
    after.slice(0, 5).forEach((frame, i) => expect(frame).toBe(before[i]));
  });
});
