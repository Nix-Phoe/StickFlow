import { describe, expect, it } from 'vitest';

import type { SkeletonNode } from '../core/types';
import { solvePose } from '../model/kinematics';
import { startNodeDrag } from './node-drag';

const HALF_PI = Math.PI / 2;

const node = (id: string, parentId: string | null, length: number, angle: number): SkeletonNode => ({
  id,
  parentId,
  length,
  angle,
  shape: 'segment',
});

/** root → arm (10, vers le haut) → hand (10, prolonge le bras). */
const skeleton: SkeletonNode[] = [node('root', null, 0, 0), node('arm', 'root', 10, HALF_PI), node('hand', 'arm', 10, 0)];
const frame = { pose: {}, rootPosition: { x: 0, y: 0 } };
const posed = solvePose(skeleton, frame.pose, frame.rootPosition);

describe('startNodeDrag on a limb', () => {
  it('rotates the node around its start to follow the pointer', () => {
    // Le bout du bras est en (0, 10) ; on l'amène à droite de l'épaule : angle absolu 0.
    const drag = startNodeDrag(skeleton, posed, frame, 'arm', { x: 0, y: 10 });
    expect(drag.update({ x: 10, y: 0 }).pose.arm).toBeCloseTo(0, 9);
  });

  it('stores the angle relative to the parent', () => {
    // Le parent de hand (arm) est à +90° ; viser à droite du coude donne -90° en relatif.
    const drag = startNodeDrag(skeleton, posed, frame, 'hand', { x: 0, y: 20 });
    expect(drag.update({ x: 10, y: 10 }).pose.hand).toBeCloseTo(-HALF_PI, 9);
  });

  it('keeps the offset between the grab point and the handle, so nothing jumps', () => {
    // Saisi légèrement à côté du bout : sans mouvement, la pose ne change pas.
    const drag = startNodeDrag(skeleton, posed, frame, 'arm', { x: 1, y: 10 });
    expect(drag.update({ x: 1, y: 10 }).pose.arm).toBeCloseTo(HALF_PI, 9);
  });

  it('keeps angles normalised in (-π, π]', () => {
    // Viser en bas à gauche du coude : absolu ≈ -153°, relatif brut ≈ -243°, normalisé ≈ +117°.
    const drag = startNodeDrag(skeleton, posed, frame, 'hand', { x: 0, y: 20 });
    const angle = drag.update({ x: -10, y: 5 }).pose.hand ?? Number.NaN;
    expect(angle).toBeCloseTo(Math.atan2(-5, -10) - HALF_PI + 2 * Math.PI, 9);
    expect(angle).toBeLessThanOrEqual(Math.PI);
  });

  it('leaves the other nodes and the root position alone', () => {
    const result = startNodeDrag(skeleton, posed, frame, 'arm', { x: 0, y: 10 }).update({ x: 10, y: 0 });
    expect(Object.keys(result.pose)).toEqual(['arm']);
    expect(result.rootPosition).toEqual(frame.rootPosition);
  });

  it('keeps the previous angle when the pointer sits exactly on the pivot', () => {
    const drag = startNodeDrag(skeleton, posed, frame, 'arm', { x: 0, y: 10 });
    expect(drag.update({ x: 0, y: 0 }).pose.arm).toBeCloseTo(HALF_PI, 9);
  });

  it('does not mutate the frame pose', () => {
    const own = { pose: { arm: HALF_PI }, rootPosition: { x: 0, y: 0 } };
    startNodeDrag(skeleton, solvePose(skeleton, own.pose, own.rootPosition), own, 'arm', { x: 0, y: 10 }).update({ x: 10, y: 0 });
    expect(own.pose).toEqual({ arm: HALF_PI });
  });
});

describe('startNodeDrag on the root', () => {
  it('moves the whole figure by the pointer displacement', () => {
    const drag = startNodeDrag(skeleton, posed, { pose: {}, rootPosition: { x: 5, y: 5 } }, 'root', { x: 6, y: 4 });
    expect(drag.update({ x: 16, y: -6 }).rootPosition).toEqual({ x: 15, y: -5 });
  });

  it('does not change the pose', () => {
    const drag = startNodeDrag(skeleton, posed, { pose: { arm: 1 }, rootPosition: { x: 0, y: 0 } }, 'root', { x: 0, y: 0 });
    expect(drag.update({ x: 3, y: 3 }).pose).toEqual({ arm: 1 });
  });
});

describe('startNodeDrag errors', () => {
  it('rejects an unknown node', () => {
    expect(() => startNodeDrag(skeleton, posed, frame, 'ghost', { x: 0, y: 0 })).toThrow();
  });
});
