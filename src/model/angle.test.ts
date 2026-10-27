import { describe, expect, it } from 'vitest';

import { normalizeAngle } from './angle';

describe('normalizeAngle', () => {
  it('leaves angles already in (-π, π] untouched', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(1)).toBeCloseTo(1, 9);
    expect(normalizeAngle(-1)).toBeCloseTo(-1, 9);
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 9);
  });

  it('maps -π to π', () => {
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 9);
  });

  it('wraps angles beyond a full turn', () => {
    expect(normalizeAngle(2 * Math.PI + 0.5)).toBeCloseTo(0.5, 9);
    expect(normalizeAngle(-2 * Math.PI - 0.5)).toBeCloseTo(-0.5, 9);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
  });

  it('wraps just past π to the negative side', () => {
    expect(normalizeAngle(Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 9);
  });
});
