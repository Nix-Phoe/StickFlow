import { describe, expect, it } from 'vitest';

import type { Vec2 } from '../core/types';
import { createCamera, pixelsToWorld, screenToWorld, worldToScreen } from './camera';

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

describe('screenToWorld', () => {
  // 800 × 400 px pour 400 unités de haut : 1 px = 1 unité, origine du monde en (400, 200).
  const viewport = { width: 800, height: 400 };

  it('maps the centre of the viewport to the world origin', () => {
    const p = screenToWorld({ x: 400, y: 200 }, viewport, 400);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('flips y: screen y grows downwards, world y upwards', () => {
    expect(screenToWorld({ x: 400, y: 0 }, viewport, 400).y).toBeCloseTo(200, 9);
    expect(screenToWorld({ x: 400, y: 400 }, viewport, 400).y).toBeCloseTo(-200, 9);
  });

  it('maps the left edge to minus half the world width', () => {
    expect(screenToWorld({ x: 0, y: 200 }, viewport, 400).x).toBeCloseTo(-400, 9);
  });

  it('scales with the viewport height', () => {
    // 200 px pour 400 unités : 1 px = 2 unités.
    expect(screenToWorld({ x: 0, y: 0 }, { width: 400, height: 200 }, 400)).toEqual({ x: -400, y: 200 });
  });

  it('is the inverse of the view-projection', () => {
    const world = screenToWorld({ x: 600, y: 100 }, viewport, 400);
    const clip = project(createCamera(viewport, 400).viewProjection, world);
    expect(clip.x).toBeCloseTo(0.5, 6);
    expect(clip.y).toBeCloseTo(0.5, 6);
  });
});

describe('pixelsToWorld', () => {
  it('converts a screen distance to world units', () => {
    expect(pixelsToWorld(22, 200, 400)).toBeCloseTo(44, 9);
    expect(pixelsToWorld(22, 800, 400)).toBeCloseTo(11, 9);
  });
});

describe('worldToScreen', () => {
  const viewport = { width: 800, height: 400 };

  it('maps the world origin to the centre of the viewport', () => {
    expect(worldToScreen({ x: 0, y: 0 }, viewport, 400)).toEqual({ x: 400, y: 200 });
  });

  it('is the inverse of screenToWorld', () => {
    const screen = { x: 123, y: 321 };
    const back = worldToScreen(screenToWorld(screen, viewport, 400), viewport, 400);
    expect(back.x).toBeCloseTo(123, 9);
    expect(back.y).toBeCloseTo(321, 9);
  });

  it('scales with the viewport height (thumbnails)', () => {
    // 80 px de haut pour 400 unités : 1 unité = 0,2 px.
    expect(worldToScreen({ x: 100, y: 100 }, { width: 128, height: 80 }, 400)).toEqual({ x: 84, y: 20 });
  });
});
