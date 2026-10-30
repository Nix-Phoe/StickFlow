import { describe, expect, it } from 'vitest';

import { presetFormat } from '../core/formats';
import { formatBadge, formatBytes, formatDuration, formatName, formatSubtitle } from './format';
import { strings } from './strings';

/** Intl sépare par des espaces insécables (typographie française) : on les compare comme des espaces. */
const plain = (text: string): string => text.replace(/[  ]/g, ' ');

describe('formatDuration', () => {
  it('shows minutes and seconds, rounded up to the second', () => {
    expect(formatDuration(0.4)).toBe('0:01');
    expect(formatDuration(4)).toBe('0:04');
    expect(formatDuration(75.2)).toBe('1:16');
  });
});

describe('formatBytes', () => {
  it('uses the French units (o, ko, Mo, Go)', () => {
    expect(plain(formatBytes(512))).toBe('512 o');
    expect(plain(formatBytes(1536))).toBe('1,5 ko');
    expect(plain(formatBytes(12.4 * 1024 * 1024))).toBe('12,4 Mo');
    expect(plain(formatBytes(2 * 1024 ** 3))).toBe('2 Go');
  });
});

describe('format names', () => {
  // Une seule table de noms (v2.0.1) : bannière, feuille de création, cartes, éditeur et réglages.
  it('are the same everywhere, with their subtitle', () => {
    expect(strings.formats.names).toEqual({
      youtube: 'YouTube',
      vertical: 'Vertical',
      square: 'Carré',
      portrait: 'Portrait',
      custom: 'Personnalisé',
    });
    expect(strings.formats.subtitles).toEqual({
      youtube: 'Vidéo horizontale',
      vertical: 'Shorts · TikTok · Reels',
      square: 'Publication Instagram',
      portrait: 'Publication Instagram',
      custom: 'Largeur et hauteur au choix',
    });
    expect(strings.formats).not.toHaveProperty('shortNames');
  });

  it('name a format by its preset', () => {
    expect(formatName(presetFormat('vertical'))).toBe('Vertical');
    expect(formatName(presetFormat('custom', { width: 800, height: 600 }))).toBe('Personnalisé');
    expect(formatSubtitle(presetFormat('youtube'))).toBe('Vidéo horizontale');
  });

  it('label a project card badge with the name and the ratio', () => {
    expect(formatBadge(presetFormat('youtube'))).toBe('YouTube · 16:9');
    expect(formatBadge(presetFormat('portrait'))).toBe('Portrait · 4:5');
    expect(formatBadge(presetFormat('custom', { width: 800, height: 600 }))).toBe('Personnalisé · 4:3');
  });
});
