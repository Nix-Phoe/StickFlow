import { describe, expect, it } from 'vitest';

import { floodFill } from './flood-fill';

/** Image `width` × `height` transparente, avec un carré opaque noir de `x0` à `x1` (exclus). */
function image(width: number, height: number, walls: Array<[x: number, y: number]> = []): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of walls) data.set([0, 0, 0, 255], (y * width + x) * 4);
  return data;
}
const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];
const RED = [255, 0, 0, 255] as const;

describe('floodFill', () => {
  it('fills the whole connected area of the same colour', () => {
    const data = image(4, 4);
    const bounds = floodFill(data, 4, 4, 1, 1, RED);
    expect(bounds).toEqual({ x: 0, y: 0, width: 4, height: 4 });
    expect(pixel(data, 4, 3, 3)).toEqual([...RED]);
  });

  it('stops at pixels of another colour', () => {
    // Un mur vertical en x = 2 coupe l'image en deux.
    const data = image(5, 3, [[2, 0], [2, 1], [2, 2]]);
    const bounds = floodFill(data, 5, 3, 0, 1, RED);
    expect(bounds).toEqual({ x: 0, y: 0, width: 2, height: 3 });
    expect(pixel(data, 5, 3, 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(data, 5, 2, 1)).toEqual([0, 0, 0, 255]);
  });

  it('does nothing when the area already has the colour, or outside the image', () => {
    const data = image(3, 3);
    floodFill(data, 3, 3, 0, 0, RED);
    expect(floodFill(data, 3, 3, 0, 0, RED)).toBeNull();
    expect(floodFill(data, 3, 3, 5, 0, RED)).toBeNull();
  });

  it('accepts nearly identical colours within the tolerance (antialiased edges)', () => {
    const data = image(3, 1);
    data.set([0, 0, 0, 10], 4);
    expect(floodFill(data, 3, 1, 0, 0, RED, 16)?.width).toBe(3);
  });
});
