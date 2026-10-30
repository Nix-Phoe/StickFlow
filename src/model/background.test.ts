import { describe, expect, it } from 'vitest';

import type { Background, ImageBackground } from '../core/types';
import { testProject } from '../test/fixtures';
import {
  BACKGROUND_LIMITS,
  BUILTIN_BACKGROUND_IDS,
  backgroundAssetIds,
  imageBackground,
  mergeBackground,
  normalizeBackground,
} from './background';

const image = (changes: Partial<ImageBackground> = {}): ImageBackground => ({ ...imageBackground('a1'), ...changes });

describe('imageBackground', () => {
  it('fills the frame, centred, at 100 %, without effects', () => {
    expect(imageBackground('a1')).toEqual({
      type: 'image',
      assetId: 'a1',
      fit: 'cover',
      focus: { x: 0.5, y: 0.5 },
      zoom: 1,
      blur: 0,
      brightness: 1,
      opacity: 1,
      tint: null,
    });
  });

  it('keeps the credit of a stock photo', () => {
    const credit = { author: 'Ana', url: 'https://www.pexels.com/photo/1', provider: 'Pexels' };
    expect(imageBackground('a1', credit).credit).toEqual(credit);
  });
});

describe('normalizeBackground', () => {
  it('keeps a valid background of each type', () => {
    const backgrounds: Background[] = [
      { type: 'color', color: '#112233' },
      { type: 'gradient', from: '#112233', to: '#445566', angle: 90 },
      { type: 'builtin', id: 'sunset' },
      image({ tint: { color: '#000000', amount: 0.4 } }),
    ];
    for (const background of backgrounds) expect(normalizeBackground(background)).toEqual(background);
  });

  it('normalizes colours and wraps the gradient angle', () => {
    expect(normalizeBackground({ type: 'color', color: '#ABC' })).toEqual({ type: 'color', color: '#aabbcc' });
    expect(normalizeBackground({ type: 'gradient', from: '#fff', to: '#000', angle: 450.4 })).toEqual({
      type: 'gradient',
      from: '#ffffff',
      to: '#000000',
      angle: 90,
    });
    expect(normalizeBackground({ type: 'gradient', from: '#fff', to: '#000', angle: -90 })).toMatchObject({ angle: 270 });
  });

  it('brings image settings back within their limits', () => {
    const wild = image({
      focus: { x: -1, y: 2 },
      zoom: 9,
      blur: 50,
      brightness: 0,
      opacity: 3,
      tint: { color: '#f00', amount: 2 },
    });
    expect(normalizeBackground(wild)).toEqual(
      image({
        focus: { x: 0, y: 1 },
        zoom: BACKGROUND_LIMITS.zoom.max,
        blur: BACKGROUND_LIMITS.blur.max,
        brightness: BACKGROUND_LIMITS.brightness.min,
        opacity: 1,
        tint: { color: '#ff0000', amount: 1 },
      }),
    );
  });

  it('rejects what it cannot repair', () => {
    expect(normalizeBackground({ type: 'color', color: 'red' } as Background)).toBeNull();
    expect(normalizeBackground({ type: 'builtin', id: 'beach' as never })).toBeNull();
    expect(normalizeBackground(image({ fit: 'zoom' as ImageBackground['fit'] }))).toBeNull();
    expect(normalizeBackground(image({ assetId: '' }))).toBeNull();
    expect(normalizeBackground({ type: 'video' } as unknown as Background)).toBeNull();
  });

  it('drops unknown fields and a damaged tint', () => {
    const extra = { ...image(), extra: 1, tint: { color: 'nope', amount: 0.5 } } as unknown as Background;
    expect(normalizeBackground(extra)).toEqual(image());
  });
});

describe('mergeBackground', () => {
  it('changes the settings of the current background, never its type', () => {
    expect(mergeBackground(image(), { zoom: 2, blur: 4 })).toEqual(image({ zoom: 2, blur: 4 }));
    const gradient: Background = { type: 'gradient', from: '#ffffff', to: '#000000', angle: 180 };
    expect(mergeBackground(gradient, { angle: 45 })).toEqual({ ...gradient, angle: 45 });
    expect(mergeBackground(gradient, { type: 'color' } as never)).toEqual(gradient);
  });

  it('does nothing without a background', () => {
    expect(mergeBackground(null, { zoom: 2 })).toBeNull();
  });
});

describe('backgroundAssetIds', () => {
  it('lists the image used by the project, if any', () => {
    const project = testProject();
    expect(backgroundAssetIds(project)).toEqual([]);
    expect(backgroundAssetIds({ ...project, environment: { ...project.environment, background: image() } })).toEqual(['a1']);
  });
});

describe('built-in backgrounds', () => {
  it('are drawn by code (no image file) and listed once', () => {
    expect(BUILTIN_BACKGROUND_IDS).toEqual(['day-sky', 'sunset', 'starry-night', 'horizon', 'studio-grid', 'room']);
  });
});
