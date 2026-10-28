import { describe, expect, it } from 'vitest';

import { testShape } from '../test/fixtures';
import {
  hitShape,
  moveShape,
  pickShape,
  pickShapeHandle,
  resizeShape,
  rotateShape,
  shapeFromDrag,
  shapeHandles,
  shapeOutline,
} from './shape';

const HALF_PI = Math.PI / 2;

describe('shapeFromDrag', () => {
  it('spans the dragged box for a rectangle or a triangle', () => {
    expect(shapeFromDrag('rectangle', { x: 0, y: 0 }, { x: 40, y: -20 }, false)).toEqual({ x: 20, y: -10, width: 40, height: 20, rotation: 0 });
    expect(shapeFromDrag('triangle', { x: 10, y: 10 }, { x: 0, y: 0 }, false)).toEqual({ x: 5, y: 5, width: 10, height: 10, rotation: 0 });
  });

  it('makes the box square with Maj, towards the drag', () => {
    expect(shapeFromDrag('rectangle', { x: 0, y: 0 }, { x: 40, y: -10 }, true)).toEqual({ x: 20, y: -20, width: 40, height: 40, rotation: 0 });
  });

  it('always keeps squares and circles in proportion', () => {
    expect(shapeFromDrag('square', { x: 0, y: 0 }, { x: -30, y: 10 }, false)).toEqual({ x: -15, y: 15, width: 30, height: 30, rotation: 0 });
    expect(shapeFromDrag('circle', { x: 0, y: 0 }, { x: 10, y: 20 }, false)).toMatchObject({ width: 20, height: 20 });
  });

  it('draws a line from the start to the end point', () => {
    const line = shapeFromDrag('line', { x: 0, y: 0 }, { x: 0, y: 10 }, false);
    expect(line).toMatchObject({ x: 0, y: 5, width: 10, height: 0 });
    expect(line.rotation).toBeCloseTo(HALF_PI, 9);
  });

  it('snaps a line to 45° steps with Maj', () => {
    const line = shapeFromDrag('line', { x: 0, y: 0 }, { x: 10, y: 1 }, true);
    expect(line.rotation).toBeCloseTo(0, 9);
    expect(line.width).toBeCloseTo(Math.hypot(10, 1), 9);
  });
});

describe('hitShape', () => {
  const box = testShape('b', { kind: 'rectangle', x: 0, y: 0, width: 40, height: 20 });

  it('hits inside a rectangle, and on its edge within the tolerance', () => {
    expect(hitShape(box, { x: 10, y: 5 }, 0)).toBe(true);
    expect(hitShape(box, { x: 22, y: 0 }, 0)).toBe(true); // dans l'épaisseur du trait (4)
    expect(hitShape(box, { x: 30, y: 0 }, 0)).toBe(false);
    expect(hitShape(box, { x: 30, y: 0 }, 9)).toBe(true);
  });

  it('follows the rotation', () => {
    const turned = { ...box, rotation: HALF_PI };
    expect(hitShape(turned, { x: 0, y: 18 }, 0)).toBe(true);
    expect(hitShape(turned, { x: 18, y: 0 }, 0)).toBe(false);
  });

  it('uses the ellipse of a circle, not its box', () => {
    const circle = testShape('c', { kind: 'circle', width: 20, height: 20, strokeWidth: 0 });
    expect(hitShape(circle, { x: 6, y: 6 }, 0)).toBe(true);
    expect(hitShape(circle, { x: 9, y: 9 }, 0)).toBe(false);
  });

  it('uses the three sides of a triangle (apex at the top)', () => {
    const triangle = testShape('t', { kind: 'triangle', width: 20, height: 20, strokeWidth: 0 });
    expect(hitShape(triangle, { x: 0, y: 5 }, 0)).toBe(true);
    expect(hitShape(triangle, { x: 9, y: 8 }, 0)).toBe(false);
  });

  it('hits a line near its segment only', () => {
    const line = testShape('l', { kind: 'line', width: 40, height: 0, strokeWidth: 4 });
    expect(hitShape(line, { x: 15, y: 1 }, 0)).toBe(true);
    expect(hitShape(line, { x: 15, y: 6 }, 0)).toBe(false);
    expect(hitShape(line, { x: 15, y: 6 }, 5)).toBe(true);
  });
});

describe('pickShape', () => {
  it('picks the topmost shape under the point (the last one)', () => {
    const shapes = [testShape('under'), testShape('over'), testShape('away', { x: 500 })];
    expect(pickShape(shapes, { x: 0, y: 0 }, 0)).toBe('over');
    expect(pickShape(shapes, { x: 250, y: 0 }, 0)).toBeNull();
  });
});

describe('handles', () => {
  const box = testShape('b', { width: 40, height: 20 });

  it('puts four corner handles and a rotation handle above the shape', () => {
    const handles = shapeHandles(box);
    expect(handles.map((h) => h.handle)).toEqual(['nw', 'ne', 'se', 'sw', 'rotate']);
    expect(handles.find((h) => h.handle === 'ne')?.position).toEqual({ x: 20, y: 10 });
    expect(handles.find((h) => h.handle === 'rotate')?.position.y).toBeGreaterThan(10);
  });

  it('gives a line one handle at each end', () => {
    const line = testShape('l', { kind: 'line', width: 40, height: 0 });
    expect(shapeHandles(line)).toEqual([
      { handle: 'start', position: { x: -20, y: 0 } },
      { handle: 'end', position: { x: 20, y: 0 } },
    ]);
  });

  it('finds the handle under the point', () => {
    expect(pickShapeHandle(box, { x: 19, y: -9 }, 4)).toBe('se');
    expect(pickShapeHandle(box, { x: 0, y: 0 }, 4)).toBeNull();
  });

  it('outlines the rotated box of a shape', () => {
    const outline = shapeOutline({ ...box, rotation: HALF_PI });
    expect(outline[0]?.x).toBeCloseTo(10, 9);
    expect(outline[0]?.y).toBeCloseTo(-20, 9);
  });
});

describe('moveShape / resizeShape / rotateShape', () => {
  const box = testShape('b', { x: 0, y: 0, width: 40, height: 20 });

  it('moves the centre', () => {
    expect(moveShape(box, { x: 3, y: -2 })).toEqual({ x: 3, y: -2 });
  });

  it('resizes from a corner, keeping the opposite corner in place', () => {
    // On tire le coin nord-est (20, 10) jusqu'en (30, 20) : le coin sud-ouest (-20, -10) ne bouge pas.
    expect(resizeShape(box, 'ne', { x: 30, y: 20 }, false)).toEqual({ x: 5, y: 5, width: 50, height: 30 });
  });

  it('keeps the proportions of a square, or with Maj', () => {
    const square = testShape('s', { kind: 'square', width: 20, height: 20 });
    const resized = resizeShape(square, 'ne', { x: 30, y: 15 }, false);
    expect(resized.width).toBe(resized.height);
    const constrained = resizeShape(box, 'ne', { x: 60, y: 10 }, true);
    expect((constrained.width ?? 0) / (constrained.height ?? 1)).toBeCloseTo(2, 9);
  });

  it('resizes in the shape frame when it is rotated', () => {
    const turned = { ...box, rotation: HALF_PI };
    // Coin nord-est local (20, 10) → monde (-10, 20). On le tire 10 plus loin le long de l'axe local x (monde +y).
    const resized = resizeShape(turned, 'ne', { x: -10, y: 30 }, false);
    expect(resized.width).toBeCloseTo(50, 9);
    expect(resized.height).toBeCloseTo(20, 9);
  });

  it('moves one end of a line, the other staying put', () => {
    const line = testShape('l', { kind: 'line', width: 40, height: 0 });
    const resized = resizeShape(line, 'end', { x: 0, y: 20 }, false);
    expect(resized.x).toBeCloseTo(-10, 9);
    expect(resized.y).toBeCloseTo(10, 9);
    expect(resized.width).toBeCloseTo(Math.hypot(20, 20), 9);
  });

  it('rotates to face the pointer from the centre, the handle being on top', () => {
    expect(rotateShape(box, { x: 10, y: 0 }, false)).toBeCloseTo(-HALF_PI, 9);
    expect(rotateShape(box, { x: 10, y: 1 }, true)).toBeCloseTo(-HALF_PI, 9);
  });
});
