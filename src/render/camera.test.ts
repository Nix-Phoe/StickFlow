import { describe, expect, it } from 'vitest';

import type { Vec2 } from '../core/types';
import { createCamera } from './camera';

/** Applique une matrice 3×3 colonne-major (format WebGL / gl-matrix) à un point 2D. */
function project(matrix: ArrayLike<number>, p: Vec2): Vec2 {
  const m = (i: number): number => matrix[i] ?? Number.NaN;
  return {
    x: m(0) * p.x + m(3) * p.y + m(6),
    y: m(1) * p.x + m(4) * p.y + m(7),
  };
}

describe('createCamera', () => {
  const camera = createCamera({ width: 1600, height: 800 }, 400);

  it('maps the world origin to the centre of the viewport', () => {
    const clip = project(camera.viewProjection, { x: 0, y: 0 });
    expect(clip.x).toBeCloseTo(0, 6);
    expect(clip.y).toBeCloseTo(0, 6);
  });

  it('shows exactly the world height vertically, with y pointing up', () => {
    expect(project(camera.viewProjection, { x: 0, y: 200 }).y).toBeCloseTo(1, 6);
    expect(project(camera.viewProjection, { x: 0, y: -200 }).y).toBeCloseTo(-1, 6);
  });

  it('keeps world units square whatever the aspect ratio', () => {
    // 1600 × 800 px pour 400 unités de haut : 2 px par unité, donc 800 unités de large.
    expect(project(camera.viewProjection, { x: 400, y: 0 }).x).toBeCloseTo(1, 6);
  });

  it('reports how many device pixels one world unit covers', () => {
    expect(camera.pixelsPerUnit).toBeCloseTo(2, 6);
  });

  it('returns a 3×3 matrix', () => {
    expect(camera.viewProjection).toHaveLength(9);
  });

  it('rejects an empty viewport', () => {
    expect(() => createCamera({ width: 0, height: 800 }, 400)).toThrow(RangeError);
    expect(() => createCamera({ width: 800, height: 0 }, 400)).toThrow(RangeError);
  });

  it('rejects a non-positive world height', () => {
    expect(() => createCamera({ width: 800, height: 800 }, 0)).toThrow(RangeError);
  });
});
