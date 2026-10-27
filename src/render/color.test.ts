import { describe, expect, it } from 'vitest';

import { parseHexColor } from './color';

describe('parseHexColor', () => {
  it('parses #rrggbb into normalised RGBA', () => {
    const [r, g, b, a] = parseHexColor('#ff8000');
    expect(r).toBeCloseTo(1, 6);
    expect(g).toBeCloseTo(128 / 255, 6);
    expect(b).toBeCloseTo(0, 6);
    expect(a).toBe(1);
  });

  it('parses the short #rgb form', () => {
    expect(parseHexColor('#fff')).toEqual([1, 1, 1, 1]);
  });

  it('parses #rrggbbaa', () => {
    expect(parseHexColor('#00000080')[3]).toBeCloseTo(128 / 255, 6);
  });

  it('ignores surrounding whitespace and case, as returned by getComputedStyle', () => {
    expect(parseHexColor('  #FFFFFF ')).toEqual([1, 1, 1, 1]);
  });

  it('rejects anything that is not a hex colour', () => {
    expect(() => parseHexColor('rgb(0, 0, 0)')).toThrow(SyntaxError);
    expect(() => parseHexColor('#12')).toThrow(SyntaxError);
    expect(() => parseHexColor('')).toThrow(SyntaxError);
  });
});
