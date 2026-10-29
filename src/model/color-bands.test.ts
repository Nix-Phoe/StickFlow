import { describe, expect, it } from 'vitest';

import { LIMITS } from '../core/types';
import { testCharacter } from '../test/fixtures';
import { bandStops, mirrorPart, normalizeBands, OUTFITS, outfitBands } from './color-bands';

describe('normalizeBands', () => {
  it('keeps valid bands in their order (the last one is painted on top)', () => {
    const bands = [
      { from: 0, to: 1, color: '#000000' },
      { from: 0.8, to: 1, color: '#ffffff' },
    ];
    expect(normalizeBands(bands)).toEqual(bands);
  });

  it('clamps to the part, swaps reversed ends and rounds to hundredths', () => {
    expect(normalizeBands([{ from: 1.4, to: -0.2, color: '#ff0000' }])).toEqual([{ from: 0, to: 1, color: '#ff0000' }]);
    expect(normalizeBands([{ from: 0.123, to: 0.456, color: '#ff0000' }])).toEqual([{ from: 0.12, to: 0.46, color: '#ff0000' }]);
  });

  it('normalises colours and drops invalid colours, empty or non-numeric bands', () => {
    expect(
      normalizeBands([
        { from: 0, to: 0.5, color: '#ABC' },
        { from: 0, to: 0.5, color: 'red' },
        { from: 0.3, to: 0.3, color: '#000000' },
        { from: Number.NaN, to: 0.5, color: '#000000' },
      ]),
    ).toEqual([{ from: 0, to: 0.5, color: '#aabbcc' }]);
  });

  it(`keeps at most ${LIMITS.bandsPerPart} bands, the most recent ones`, () => {
    const bands = Array.from({ length: LIMITS.bandsPerPart + 2 }, (_, i) => ({ from: 0, to: 0.1 * (i + 1), color: '#000000' }));
    const kept = normalizeBands(bands);
    expect(kept).toHaveLength(LIMITS.bandsPerPart);
    expect(kept.at(-1)?.to).toBe(0.6);
  });
});

describe('bandStops', () => {
  it('is the base colour alone without bands', () => {
    expect(bandStops('#ffffff', [])).toEqual([{ from: 0, to: 1, color: '#ffffff' }]);
  });

  it('cuts the part into visible stretches, later bands on top', () => {
    expect(
      bandStops('#ffcc99', [
        { from: 0, to: 0.6, color: '#000000' },
        { from: 0.5, to: 0.8, color: '#ff0000' },
      ]),
    ).toEqual([
      { from: 0, to: 0.5, color: '#000000' },
      { from: 0.5, to: 0.8, color: '#ff0000' },
      { from: 0.8, to: 1, color: '#ffcc99' },
    ]);
  });

  it('merges neighbouring stretches of the same colour', () => {
    expect(
      bandStops('#000000', [{ from: 0.5, to: 1, color: '#000000' }]),
    ).toEqual([{ from: 0, to: 1, color: '#000000' }]);
  });
});

describe('mirrorPart', () => {
  it('gives the same part on the other side', () => {
    const character = testCharacter('c1');
    expect(mirrorPart('upperArmL', character.skeleton)).toBe('upperArmR');
    expect(mirrorPart('shinR', character.skeleton)).toBe('shinL');
  });

  it('is null for a part in the middle or without a twin', () => {
    const character = testCharacter('c1');
    expect(mirrorPart('torso', character.skeleton)).toBeNull();
    expect(mirrorPart('head', character.skeleton)).toBeNull();
  });
});

describe('outfitBands', () => {
  it('offers ready-made outfits', () => {
    expect(OUTFITS).toEqual(['tshirt', 'sweater', 'shorts', 'trousers', 'shoes', 'hair']);
  });

  it('dresses the matching parts with the colour (a T-shirt: torso and short sleeves)', () => {
    const bands = outfitBands('tshirt', testCharacter('c1'), '#990000');
    expect(Object.keys(bands).sort()).toEqual(['torso', 'upperArmL', 'upperArmR']);
    expect(bands.torso).toEqual([{ from: 0, to: 1, color: '#990000' }]);
    expect(bands.upperArmL).toEqual([{ from: 0, to: 0.5, color: '#990000' }]);
  });

  it('puts shoes at the end of the legs and hair at the top of the head', () => {
    const character = testCharacter('c1');
    expect(outfitBands('shoes', character, '#222222').shinL).toEqual([{ from: 0.82, to: 1, color: '#222222' }]);
    expect(outfitBands('hair', character, '#552200').head).toEqual([{ from: 0.55, to: 1, color: '#552200' }]);
  });

  it('adds on top of the existing bands, dropping those the new band hides', () => {
    const character = testCharacter('c1', {
      appearance: {
        scale: 1,
        defaultColor: null,
        segmentColors: {},
        segmentBands: {
          shinL: [
            { from: 0.85, to: 1, color: '#ffffff' },
            { from: 0, to: 0.3, color: '#0000ff' },
          ],
        },
      },
    });
    // Le pantalon (0 → 0,9) cache la bande bleue (0 → 0,3), pas la chaussette blanche (0,85 → 1).
    expect(outfitBands('trousers', character, '#000000').shinL).toEqual([
      { from: 0.85, to: 1, color: '#ffffff' },
      { from: 0, to: 0.9, color: '#000000' },
    ]);
  });

  it('ignores parts the skeleton does not have', () => {
    const character = testCharacter('c1', { skeleton: testCharacter('c1').skeleton.filter((n) => !n.id.startsWith('upperArm') && !n.id.startsWith('forearm')) });
    expect(Object.keys(outfitBands('tshirt', character, '#990000'))).toEqual(['torso']);
  });
});
