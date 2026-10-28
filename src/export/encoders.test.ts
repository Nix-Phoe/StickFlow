import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { encodeGif } from './gif';
import { zipFiles } from './zip';

const WIDTH = 4;
const HEIGHT = 2;

/** Image RGBA unie. */
const solid = (r: number, g: number, b: number): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  return data;
};

const ascii = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

describe('encodeGif', () => {
  const frames = [solid(255, 255, 255), solid(0, 0, 0)];

  it('produces a GIF89a file with its trailer', () => {
    const gif = encodeGif(frames, WIDTH, HEIGHT, { delayMs: 100, repeat: 0 });
    expect(ascii(gif.slice(0, 6))).toBe('GIF89a');
    expect(gif.at(-1)).toBe(0x3b);
  });

  it('writes the loop extension only when the GIF repeats', () => {
    expect(ascii(encodeGif(frames, WIDTH, HEIGHT, { delayMs: 100, repeat: 0 }))).toContain('NETSCAPE2.0');
    expect(ascii(encodeGif(frames, WIDTH, HEIGHT, { delayMs: 100, repeat: -1 }))).not.toContain('NETSCAPE2.0');
  });

  it('rejects a frame of the wrong size', () => {
    expect(() => encodeGif([new Uint8ClampedArray(4)], WIDTH, HEIGHT, { delayMs: 100, repeat: 0 })).toThrow(RangeError);
  });

  it('rejects an empty animation', () => {
    expect(() => encodeGif([], WIDTH, HEIGHT, { delayMs: 100, repeat: 0 })).toThrow(RangeError);
  });
});

describe('zipFiles', () => {
  it('packs files that unzip back to the same bytes', () => {
    const files = [
      { name: 'frame-001.png', data: new Uint8Array([1, 2, 3]) },
      { name: 'frame-002.png', data: new Uint8Array([4, 5]) },
    ];
    const unzipped = unzipSync(zipFiles(files));
    expect(Object.keys(unzipped)).toEqual(['frame-001.png', 'frame-002.png']);
    expect(Array.from(unzipped['frame-002.png'] ?? [])).toEqual([4, 5]);
  });
});
