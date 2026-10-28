import { describe, expect, it } from 'vitest';

import type { SkeletonNode, Vec2 } from '../core/types';
import { solvePose, type PosedNode } from './kinematics';

const HALF_PI = Math.PI / 2;

const node = (id: string, parentId: string | null, length: number, angle: number): SkeletonNode => ({
  id,
  parentId,
  length,
  angle,
  shape: 'segment',
});

function find(posed: readonly PosedNode[], id: string): PosedNode {
  const found = posed.find((p) => p.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function expectPoint(actual: Vec2, expected: Vec2): void {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

/** root → arm (10, vers le haut) → hand (5, relatif 0). Ordre parent avant enfant. */
const chain: SkeletonNode[] = [node('root', null, 0, 0), node('arm', 'root', 10, HALF_PI), node('hand', 'arm', 5, 0)];

describe('solvePose', () => {
  it('returns one posed node per skeleton node, in skeleton order', () => {
    const posed = solvePose(chain, {}, { x: 0, y: 0 });
    expect(posed.map((p) => p.id)).toEqual(['root', 'arm', 'hand']);
  });

  it('places the root at the root position', () => {
    const root = find(solvePose(chain, {}, { x: 3, y: -4 }), 'root');
    expectPoint(root.start, { x: 3, y: -4 });
    expectPoint(root.end, { x: 3, y: -4 });
  });

  it('starts each node where its parent ends', () => {
    const posed = solvePose(chain, {}, { x: 0, y: 0 });
    expectPoint(find(posed, 'hand').start, find(posed, 'arm').end);
  });

  it('extends a node by its length along its absolute angle', () => {
    const arm = find(solvePose(chain, {}, { x: 1, y: 1 }), 'arm');
    expectPoint(arm.end, { x: 1, y: 11 });
    expect(arm.angle).toBeCloseTo(HALF_PI, 6);
  });

  it('accumulates angles from the root down', () => {
    const bent = [chain[0]!, chain[1]!, node('hand', 'arm', 5, -HALF_PI)];
    const hand = find(solvePose(bent, {}, { x: 0, y: 0 }), 'hand');
    expect(hand.angle).toBeCloseTo(0, 6);
    expectPoint(hand.end, { x: 5, y: 10 });
  });

  it('uses the pose angle instead of the rest angle when present', () => {
    const arm = find(solvePose(chain, { arm: 0 }, { x: 0, y: 0 }), 'arm');
    expectPoint(arm.end, { x: 10, y: 0 });
  });

  it('falls back to the rest angle for nodes missing from the pose', () => {
    const hand = find(solvePose(chain, { arm: 0 }, { x: 0, y: 0 }), 'hand');
    expectPoint(hand.end, { x: 15, y: 0 });
  });

  it('rotates descendants rigidly with their parent', () => {
    const posed = solvePose(chain, { root: Math.PI }, { x: 0, y: 0 });
    expectPoint(find(posed, 'arm').end, { x: 0, y: -10 });
    expectPoint(find(posed, 'hand').end, { x: 0, y: -15 });
  });

  it('rejects a skeleton whose parents come after their children', () => {
    expect(() => solvePose([chain[1]!, chain[0]!], {}, { x: 0, y: 0 })).toThrow();
  });
});

describe('solvePose with a scale', () => {
  it('multiplies every length, keeping the angles', () => {
    const skeleton = [
      { id: 'root', parentId: null, length: 0, angle: 0, shape: 'segment' as const },
      { id: 'arm', parentId: 'root', length: 10, angle: Math.PI / 2, shape: 'segment' as const },
    ];
    const [, arm] = solvePose(skeleton, {}, { x: 1, y: 1 }, 1.5);
    expect(arm?.end.x).toBeCloseTo(1, 9);
    expect(arm?.end.y).toBeCloseTo(16, 9);
  });
});
