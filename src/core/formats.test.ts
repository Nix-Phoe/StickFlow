import { describe, expect, it } from 'vitest';

import {
  aspectRatio,
  CUSTOM_FORMAT_LIMITS,
  DEFAULT_FORMAT,
  FORMAT_PRESETS,
  normalizeFormat,
  presetFormat,
  ratioLabel,
  sameFormat,
} from './formats';

describe('video format presets', () => {
  it('match the usual platforms', () => {
    expect(presetFormat('youtube')).toEqual({ preset: 'youtube', width: 1920, height: 1080 });
    expect(presetFormat('vertical')).toEqual({ preset: 'vertical', width: 1080, height: 1920 });
    expect(presetFormat('square')).toEqual({ preset: 'square', width: 1080, height: 1080 });
    expect(presetFormat('portrait')).toEqual({ preset: 'portrait', width: 1080, height: 1350 });
    expect(FORMAT_PRESETS.map((p) => p.id)).toEqual(['youtube', 'vertical', 'square', 'portrait', 'custom']);
  });

  it('defaults to YouTube 16:9', () => {
    expect(DEFAULT_FORMAT).toEqual(presetFormat('youtube'));
  });

  it('gives a custom format the size typed in, within its limits', () => {
    expect(presetFormat('custom', { width: 800, height: 600 })).toEqual({ preset: 'custom', width: 800, height: 600 });
    expect(presetFormat('custom', { width: 10, height: 9000 })).toEqual({
      preset: 'custom',
      width: CUSTOM_FORMAT_LIMITS.min,
      height: CUSTOM_FORMAT_LIMITS.max,
    });
  });
});

describe('normalizeFormat', () => {
  it('forces the size of a preset', () => {
    expect(normalizeFormat({ preset: 'square', width: 12, height: 34 })).toEqual(presetFormat('square'));
  });

  it('rounds a custom size to even pixels (required by video encoders) and clamps it', () => {
    expect(normalizeFormat({ preset: 'custom', width: 1001.2, height: 100 })).toEqual({ preset: 'custom', width: 1002, height: 256 });
    expect(normalizeFormat({ preset: 'custom', width: 999, height: 3841 })).toEqual({ preset: 'custom', width: 1000, height: 3840 });
  });

  it('treats an unknown preset as a custom size, and a broken one as the default', () => {
    expect(normalizeFormat({ preset: 'cinema', width: 2048, height: 858 })).toEqual({ preset: 'custom', width: 2048, height: 858 });
    expect(normalizeFormat({ preset: 'custom', width: Number.NaN, height: 600 })).toEqual(DEFAULT_FORMAT);
  });
});

describe('aspectRatio and ratioLabel', () => {
  it('give the shape of the frame', () => {
    expect(aspectRatio(presetFormat('youtube'))).toBeCloseTo(16 / 9);
    expect(ratioLabel(presetFormat('youtube'))).toBe('16:9');
    expect(ratioLabel(presetFormat('vertical'))).toBe('9:16');
    expect(ratioLabel(presetFormat('square'))).toBe('1:1');
    expect(ratioLabel(presetFormat('portrait'))).toBe('4:5');
  });

  it('shows an irregular custom ratio as a decimal', () => {
    expect(ratioLabel(presetFormat('custom', { width: 1000, height: 700 }))).toBe('10:7');
    expect(ratioLabel(presetFormat('custom', { width: 1234, height: 566 }))).toBe('2,18:1');
  });

  it('compares two formats by value', () => {
    expect(sameFormat(presetFormat('square'), { preset: 'square', width: 1080, height: 1080 })).toBe(true);
    expect(sameFormat(presetFormat('square'), presetFormat('custom', { width: 1080, height: 1080 }))).toBe(false);
  });
});
