import { describe, expect, it } from 'vitest';

import type { Character, Keyframe, LoopSettings, Project, SkeletonNode, SmoothingSettings } from '../core/types';
import { catmullRom } from './interpolation';
import { deriveSequence } from './sequence';

const skeleton: SkeletonNode[] = [
  { id: 'root', parentId: null, length: 0, angle: 0, shape: 'segment' },
  { id: 'arm', parentId: 'root', length: 10, angle: 1, shape: 'segment' },
];

const character: Character = {
  id: 'c',
  name: 'c',
  visible: true,
  locked: false,
  skeleton,
  appearance: { scale: 1, defaultColor: null, segmentColors: {} },
};

/** Image clé du seul personnage « c » ; `other` pose aussi un second personnage « d ». */
const key = (id: string, pose: Record<string, number> = {}, x = 0, other?: Record<string, number>): Keyframe => ({
  id,
  poses: {
    c: { pose, rootPosition: { x, y: 0 } },
    ...(other ? { d: { pose: other, rootPosition: { x: 50, y: 0 } } } : {}),
  },
});

function project(
  keyframes: Keyframe[],
  smoothing: Partial<SmoothingSettings> = {},
  loop: Partial<LoopSettings> = {},
): Project {
  return {
    name: 'Test',
    fps: 12,
    characters: [character],
    keyframes,
    environment: { background: null, shapes: [], drawing: { tiles: {} } },
    recentColors: [],
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'linear', ...smoothing },
      loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4, ...loop },
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
    expect(sequence.slice(1, 4).map((f) => f.poses.c?.pose.arm)).toEqual([0.25, 0.5, 0.75]);
  });

  it('turns the short way round across ±π', () => {
    const [, middle] = deriveSequence(project([key('a', { arm: 3 }), key('b', { arm: -3 })], { intensity: 1 }));
    expect(Math.abs(middle?.poses.c?.pose.arm ?? 0)).toBeCloseTo(Math.PI, 6);
  });

  it('uses the rest angle for a node posed in only one keyframe', () => {
    // Repos de arm = 1 ; b le pose à 2 : le milieu vaut 1,5.
    const [, middle] = deriveSequence(project([key('a'), key('b', { arm: 2 })], { intensity: 1 }));
    expect(middle?.poses.c?.pose.arm).toBeCloseTo(1.5, 9);
  });

  it('leaves out nodes posed in neither keyframe', () => {
    const [, middle] = deriveSequence(project([key('a'), key('b')], { intensity: 1 }));
    expect(middle?.poses.c?.pose).toEqual({});
  });

  it('interpolates the root position', () => {
    const [, middle] = deriveSequence(project([key('a', {}, 0), key('b', {}, 10)], { intensity: 1 }));
    expect(middle?.poses.c?.rootPosition).toEqual({ x: 5, y: 0 });
  });
});

describe('deriveSequence: non destructif et mémoïsé', () => {
  it('copies keyframes unchanged into the sequence', () => {
    const a = key('a', { arm: 0.3 }, 4);
    const [first] = deriveSequence(project([a, key('b')]));
    expect(first).toMatchObject({ kind: 'keyframe', id: 'a', poses: { c: { pose: { arm: 0.3 }, rootPosition: { x: 4, y: 0 } } } });
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

describe('deriveSequence: courbes', () => {
  it('follows the spline through neighbouring keyframes with the smooth curve', () => {
    // arm : 0, 1, 0. Entre a et b, la spline tient compte de c (après b) et de a répété (avant a).
    const sequence = deriveSequence(
      project([key('a', { arm: 0 }), key('b', { arm: 1 }), key('c', { arm: 0 })], { intensity: 1, curve: 'smooth' }),
    );
    expect(sequence[1]?.poses.c?.pose.arm).toBeCloseTo(catmullRom(0, 0, 1, 0, 0.5), 9);
  });

  it('changes the generated frames when the curve changes', () => {
    const keyframes = [key('a', { arm: 0 }), key('b', { arm: 1 })];
    const linear = deriveSequence(project(keyframes, { curve: 'linear' }))[1]?.poses.c?.pose.arm;
    const eased = deriveSequence(project(keyframes, { curve: 'ease-in-out' }))[1]?.poses.c?.pose.arm;
    expect(eased).not.toBeCloseTo(linear ?? 0, 3);
  });
});

describe('deriveSequence: Répétition', () => {
  const keyframes = [key('a', { arm: 0 }), key('b', { arm: 1 })];

  it('adds no transition when the loop is off', () => {
    expect(kinds(project(keyframes, { enabled: false }))).toEqual(['keyframe', 'keyframe']);
  });

  it('adds `transitionFrames` generated frames from the last keyframe back to the first', () => {
    const sequence = deriveSequence(project(keyframes, { enabled: false }, { enabled: true, transitionFrames: 2 }));
    expect(sequence.map((f) => f.kind)).toEqual(['keyframe', 'keyframe', 'generated', 'generated']);
    expect(sequence[2]).toMatchObject({ from: 'b', to: 'a', step: 1 });
    expect(sequence[3]).toMatchObject({ from: 'b', to: 'a', step: 2 });
  });

  it('comes after the smoothing frames of the last segment', () => {
    expect(kinds(project(keyframes, { intensity: 1 }, { enabled: true, transitionFrames: 1 }))).toEqual([
      'keyframe',
      'generated',
      'keyframe',
      'generated',
    ]);
  });

  it('gives transition frames their own ids', () => {
    const ids = deriveSequence(project(keyframes, { intensity: 2 }, { enabled: true })).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('adds no transition to a single keyframe', () => {
    expect(kinds(project([key('a')], {}, { enabled: true }))).toEqual(['keyframe']);
  });

  it('brings the pose back towards the first keyframe', () => {
    const sequence = deriveSequence(project(keyframes, { enabled: false, curve: 'linear' }, { enabled: true, transitionFrames: 1 }));
    expect(sequence[2]?.poses.c?.pose.arm).toBeCloseTo(0.5, 9);
  });

  it('treats the animation as a loop for the spline (the first keyframe follows the last)', () => {
    // a → b avec la boucle : avant a vient b, après b vient a.
    const sequence = deriveSequence(
      project([key('a', { arm: 0 }), key('b', { arm: 1 })], { intensity: 1, curve: 'smooth' }, { enabled: true, transitionFrames: 1 }),
    );
    expect(sequence[1]?.poses.c?.pose.arm).toBeCloseTo(catmullRom(1, 0, 1, 0, 0.5), 9);
  });

  it('uses the smooth curve for the transition when smoothing is off', () => {
    const three = [key('a', { arm: 0 }), key('b', { arm: 1 }), key('c', { arm: 2 })];
    const sequence = deriveSequence(project(three, { enabled: false, curve: 'linear' }, { enabled: true, transitionFrames: 1 }));
    // Transition c → a, voisins en boucle : b avant c, b après a.
    expect(sequence[3]?.poses.c?.pose.arm).toBeCloseTo(catmullRom(1, 2, 0, 1, 0.5), 9);
  });

  it('recomputes the sequence when the loop settings change', () => {
    const p = project(keyframes);
    const longer = { ...p, ai: { ...p.ai, loop: { ...p.ai.loop, enabled: true } } };
    expect(deriveSequence(longer)).not.toBe(deriveSequence(p));
  });
});

describe('deriveSequence: plusieurs personnages', () => {
  const second: Character = { ...character, id: 'd', name: 'd' };
  const duo = (keyframes: Keyframe[]): Project => ({ ...project(keyframes, { intensity: 1 }), characters: [character, second] });

  it('interpolates every character independently', () => {
    const [, middle] = deriveSequence(duo([key('a', { arm: 0 }, 0, { arm: 2 }), key('b', { arm: 1 }, 0, { arm: 0 })]));
    expect(middle?.poses.c?.pose.arm).toBeCloseTo(0.5, 9);
    expect(middle?.poses.d?.pose.arm).toBeCloseTo(1, 9);
    expect(middle?.poses.d?.rootPosition).toEqual({ x: 50, y: 0 });
  });

  it('keeps the same sequence when only the appearance of a character changes', () => {
    const p = duo([key('a', {}, 0, {}), key('b', {}, 0, {})]);
    const recoloured: Project = {
      ...p,
      characters: [{ ...character, appearance: { ...character.appearance, defaultColor: '#ff0000' } }, second],
    };
    expect(deriveSequence(recoloured)).toBe(deriveSequence(p));
  });

  it('recomputes the sequence when a character is added', () => {
    const p = project([key('a'), key('b')]);
    const before = deriveSequence(p);
    expect(deriveSequence({ ...p, characters: [character, second] })).not.toBe(before);
  });
});
