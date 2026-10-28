import { describe, expect, it } from 'vitest';

import { harmonyHues, hexToHsv, hsvToHex, normalizeHex, wheelHueSaturation, wheelPoint } from './color';

describe('normalizeHex', () => {
  it('accepts #rgb and #rrggbb, with or without #, in any case', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('ff8000')).toBe('#ff8000');
    expect(normalizeHex('  #FF8000 ')).toBe('#ff8000');
  });

  it('rejects anything else', () => {
    for (const value of ['', 'red', '#12', '#12345', '#gggggg', '#1234567']) expect(normalizeHex(value)).toBeNull();
  });
});

describe('HSV ⇄ HEX', () => {
  it('converts the primaries and greys', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00');
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 0, s: 0, v: 0.5 })).toBe('#808080');
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000');
  });

  it('wraps the hue and clamps saturation and value', () => {
    expect(hsvToHex({ h: 360 + 120, s: 2, v: 5 })).toBe('#00ff00');
  });

  it('reads a colour back into hue, saturation and value', () => {
    expect(hexToHsv('#ff8000')).toEqual({ h: expect.closeTo(30.1, 1) as number, s: 1, v: 1 });
    expect(hexToHsv('#808080')).toEqual({ h: 0, s: 0, v: expect.closeTo(0.502, 3) as number });
  });

  it('round-trips', () => {
    for (const hex of ['#123456', '#abcdef', '#ff0000', '#00ffaa', '#ffffff']) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
});

describe('harmonyHues', () => {
  it('gives nothing extra for no harmony', () => {
    expect(harmonyHues(10, 'none')).toEqual([]);
  });

  it('gives the neighbours for analogous, the opposite for complementary, thirds for triadic', () => {
    expect(harmonyHues(10, 'analogous')).toEqual([340, 40]);
    expect(harmonyHues(10, 'complementary')).toEqual([190]);
    expect(harmonyHues(300, 'triadic')).toEqual([60, 180]);
  });
});

describe('color wheel geometry', () => {
  it('puts hue on the angle (red to the right, counter-clockwise) and saturation on the radius', () => {
    expect(wheelPoint(0, 1)).toEqual({ x: 1, y: 0 });
    const green = wheelPoint(120, 0.5);
    expect(green.x).toBeCloseTo(-0.25, 9);
    expect(green.y).toBeCloseTo(0.5 * Math.sin((2 * Math.PI) / 3), 9);
  });

  it('reads hue and saturation back from a point, clamping outside the wheel', () => {
    expect(wheelHueSaturation({ x: 0, y: 1 })).toEqual({ h: 90, s: 1 });
    expect(wheelHueSaturation({ x: -3, y: 0 })).toEqual({ h: 180, s: 1 });
    expect(wheelHueSaturation({ x: 0, y: 0 })).toEqual({ h: 0, s: 0 });
  });

  it('round-trips', () => {
    const { h, s } = wheelHueSaturation(wheelPoint(250, 0.3));
    expect(h).toBeCloseTo(250, 9);
    expect(s).toBeCloseTo(0.3, 9);
  });
});
