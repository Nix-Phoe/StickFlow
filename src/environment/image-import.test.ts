import { describe, expect, it } from 'vitest';

import { presetFormat } from '../core/formats';
import { checkImageFile, importSize, MAX_IMPORT_BYTES, THUMBNAIL_SIDE } from './image-import';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = text('RIFF\x00\x00\x00\x00WEBPVP8 ');
const GIF = text('GIF89a');

describe('checkImageFile', () => {
  it('accepts PNG, JPEG, WebP and GIF (by their content, not their name)', () => {
    expect(checkImageFile({ type: 'image/png', size: 1000 }, PNG)).toBeNull();
    expect(checkImageFile({ type: 'image/jpeg', size: 1000 }, JPEG)).toBeNull();
    expect(checkImageFile({ type: 'image/webp', size: 1000 }, WEBP)).toBeNull();
    // Un GIF animé est accepté : seule sa première image sera gardée.
    expect(checkImageFile({ type: 'image/gif', size: 1000 }, GIF)).toBeNull();
    // Une image collée n'a parfois pas de type : c'est le contenu qui compte.
    expect(checkImageFile({ type: '', size: 1000 }, PNG)).toBeNull();
  });

  it('refuses SVG (it can carry scripts), even disguised', () => {
    expect(checkImageFile({ type: 'image/svg+xml', size: 1000 }, text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('svg');
    expect(checkImageFile({ type: 'image/png', size: 1000 }, text('  <?xml version="1.0"?><svg'))).toBe('svg');
  });

  it('refuses a file over 20 MB', () => {
    expect(MAX_IMPORT_BYTES).toBe(20 * 1024 * 1024);
    expect(checkImageFile({ type: 'image/png', size: MAX_IMPORT_BYTES + 1 }, PNG)).toBe('too-large');
  });

  it('refuses what is not a supported image', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 1000 }, text('%PDF-1.7'))).toBe('unsupported');
    expect(checkImageFile({ type: 'image/png', size: 0 }, bytes())).toBe('unreadable');
  });
});

describe('importSize', () => {
  it('keeps at most twice the resolution of the format', () => {
    // 12 mégapixels (4000 × 3000) pour un format 1920 × 1080 : long côté ramené à 3840.
    expect(importSize({ width: 4000, height: 3000 }, presetFormat('youtube'))).toEqual({ width: 3840, height: 2880 });
    expect(importSize({ width: 4000, height: 3000 }, presetFormat('custom', { width: 640, height: 360 }))).toEqual({ width: 1280, height: 960 });
  });

  it('never goes over 3840 pixels, and never enlarges', () => {
    expect(importSize({ width: 9000, height: 3000 }, presetFormat('custom', { width: 3840, height: 3840 }))).toEqual({ width: 3840, height: 1280 });
    expect(importSize({ width: 800, height: 600 }, presetFormat('youtube'))).toEqual({ width: 800, height: 600 });
  });

  it('makes small thumbnails for the recent images', () => {
    expect(THUMBNAIL_SIDE).toBe(160);
  });
});
