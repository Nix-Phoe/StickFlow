import { describe, expect, it } from 'vitest';

import { BUILTIN_BACKGROUND_IDS } from '../core/types';
import { imageBackground } from '../model/background';
import { EXPORT_COLORS } from '../render/color';
import { recordingContext } from '../test/recording-context';
import { BUILTIN_BACKGROUNDS } from './backgrounds';
import { paintBackground } from './paint-background';

const SIZE = { width: 800, height: 450 };
const IMAGE = { width: 1000, height: 1000 } as unknown as CanvasImageSource & { width: number; height: number };

describe('paintBackground', () => {
  it('fills the frame with a plain colour', () => {
    const rec = recordingContext(800, 450);
    paintBackground(rec.context, { type: 'color', color: '#112233' }, SIZE, { image: null, scale: 1 });
    expect(rec.values('fillStyle')).toEqual(['#112233']);
    expect(rec.log).toContainEqual({ kind: 'call', name: 'fillRect', args: [0, 0, 800, 450] });
  });

  it('draws a gradient along the CSS gradient line', () => {
    const rec = recordingContext(800, 450);
    paintBackground(rec.context, { type: 'gradient', from: '#ff0000', to: '#0000ff', angle: 180 }, SIZE, { image: null, scale: 1 });
    expect(rec.log).toContainEqual({ kind: 'call', name: 'createLinearGradient', args: [400, 0, 400, 450] });
    expect(rec.log).toContainEqual({ kind: 'call', name: 'linearGradient.addColorStop', args: [0, '#ff0000'] });
    expect(rec.log).toContainEqual({ kind: 'call', name: 'linearGradient.addColorStop', args: [1, '#0000ff'] });
  });

  it('draws an image over white, with its effects, then the tint', () => {
    const rec = recordingContext(800, 450);
    const background = { ...imageBackground('a1'), blur: 4, brightness: 1.2, opacity: 0.5, tint: { color: '#000000', amount: 0.25 } };
    paintBackground(rec.context, background, SIZE, { image: IMAGE, scale: 0.5 });
    expect(rec.values('fillStyle')[0]).toBe(EXPORT_COLORS.background);
    // Le flou est donné en pixels du format : réduit avec l'image (échelle 0,5).
    expect(rec.values('filter')).toContain('blur(2px) brightness(1.2)');
    expect(rec.values('globalAlpha')).toEqual(expect.arrayContaining([0.5, 0.25]));
    const calls = rec.calls();
    expect(calls.indexOf('drawImage')).toBeLessThan(calls.lastIndexOf('fillRect'));
    expect(rec.values('fillStyle').at(-1)).toBe('#000000');
  });

  it('blurs an image a little larger than the frame, so its edges do not fade', () => {
    const rec = recordingContext(800, 450);
    paintBackground(rec.context, { ...imageBackground('a1'), fit: 'stretch', blur: 10 }, SIZE, { image: IMAGE, scale: 1 });
    const draw = rec.log.find((entry) => entry.kind === 'call' && entry.name === 'drawImage');
    expect(draw?.kind === 'call' && draw.args.slice(1)).toEqual([-20, -20, 840, 490]);
  });

  it('repeats a tiled image with a pattern', () => {
    const rec = recordingContext(800, 450);
    paintBackground(rec.context, { ...imageBackground('a1'), fit: 'tile' }, SIZE, { image: IMAGE, scale: 0.1 });
    expect(rec.calls()).toContain('createPattern');
    expect(rec.calls()).toContain('pattern.setTransform');
  });

  it('paints only white while the image is not loaded yet', () => {
    const rec = recordingContext(800, 450);
    paintBackground(rec.context, imageBackground('a1'), SIZE, { image: null, scale: 1 });
    expect(rec.calls()).not.toContain('drawImage');
    expect(rec.values('fillStyle')).toEqual([EXPORT_COLORS.background]);
  });
});

describe('built-in backgrounds', () => {
  it('have a drawing function each, which covers the whole frame first', () => {
    expect(Object.keys(BUILTIN_BACKGROUNDS).sort()).toEqual([...BUILTIN_BACKGROUND_IDS].sort());
    for (const id of BUILTIN_BACKGROUND_IDS) {
      const rec = recordingContext(800, 450);
      paintBackground(rec.context, { type: 'builtin', id }, SIZE, { image: null, scale: 1 });
      expect(rec.log.find((entry) => entry.kind === 'call' && entry.name === 'fillRect')).toEqual({
        kind: 'call',
        name: 'fillRect',
        args: [0, 0, 800, 450],
      });
    }
  });

  it('are the same every time (random details are seeded)', () => {
    const draw = (): unknown[] => {
      const rec = recordingContext(800, 450);
      paintBackground(rec.context, { type: 'builtin', id: 'starry-night' }, SIZE, { image: null, scale: 1 });
      return rec.log;
    };
    expect(draw()).toEqual(draw());
  });
});
