import { describe, expect, it } from 'vitest';

import { ORIGIN, testCharacter } from '../test/fixtures';
import { characterBounds, partColor, placeNewCharacter, posedCharacter, restSize } from './character';

describe('placeNewCharacter', () => {
  it('puts the first character at the origin', () => {
    expect(placeNewCharacter([])).toEqual(ORIGIN);
  });

  it('never lands exactly on another character', () => {
    const roots = [ORIGIN];
    for (let i = 0; i < 6; i += 1) {
      const next = placeNewCharacter(roots);
      expect(roots.every((r) => Math.hypot(r.x - next.x, r.y - next.y) > 1)).toBe(true);
      roots.push(next);
    }
  });

  it('stays on the stage, alternating right and left', () => {
    const first = placeNewCharacter([ORIGIN]);
    const second = placeNewCharacter([ORIGIN, first]);
    expect(first.x).toBeGreaterThan(0);
    expect(second.x).toBeLessThan(0);
    expect(first.y).toBe(0);
  });
});

describe('posedCharacter', () => {
  it('multiplies the segment lengths by the scale', () => {
    const small = testCharacter('c', { appearance: { scale: 1, defaultColor: null, segmentColors: {} } });
    const big = testCharacter('c', { appearance: { scale: 2, defaultColor: null, segmentColors: {} } });
    const head = (c: typeof small) => posedCharacter(c, { pose: {}, rootPosition: ORIGIN }).find((n) => n.id === 'head');
    expect(head(big)?.end.y).toBeCloseTo(2 * (head(small)?.end.y ?? 0), 9);
  });
});

describe('characterBounds', () => {
  it('encloses the posed figure, strokes included, and grows with the scale', () => {
    const character = testCharacter('c');
    const bounds = characterBounds(character, { pose: {}, rootPosition: ORIGIN }, 9);
    // Tête au-dessus de la racine, pieds en dessous.
    expect(bounds.maxY).toBeGreaterThan(100);
    expect(bounds.minY).toBeLessThan(-80);
    const big = characterBounds(
      testCharacter('c', { appearance: { scale: 2, defaultColor: null, segmentColors: {} } }),
      { pose: {}, rootPosition: ORIGIN },
      9,
    );
    expect(big.maxY - big.minY).toBeCloseTo(2 * (bounds.maxY - bounds.minY), 6);
  });
});

describe('partColor', () => {
  it('uses the part colour, then the character colour, then the fallback', () => {
    const character = testCharacter('c', { appearance: { scale: 1, defaultColor: '#00ff00', segmentColors: { head: '#ff0000' } } });
    expect(partColor(character, 'head', '#000000')).toBe('#ff0000');
    expect(partColor(character, 'torso', '#000000')).toBe('#00ff00');
    expect(partColor(testCharacter('c'), 'torso', '#000000')).toBe('#000000');
  });
});

describe('restSize', () => {
  it('measures the character in its rest pose at 100 %, whatever its current size', () => {
    const normal = restSize(testCharacter('c'));
    const big = restSize(testCharacter('c', { appearance: { scale: 2, defaultColor: null, segmentColors: {} } }));
    expect(big).toEqual(normal);
    expect(normal.height).toBeGreaterThan(normal.width);
    expect(normal.height).toBeGreaterThan(200);
  });
});
