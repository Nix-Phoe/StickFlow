import { describe, expect, it } from 'vitest';

import { presetFormat } from '../core/formats';
import { backgroundCanvasSize, gradientLine, imageLayout, tileLayout } from './background-layout';

const FRAME = { width: 1600, height: 900 };
const close = (value: { [key: string]: number }, expected: { [key: string]: number }): void => {
  for (const key of Object.keys(expected)) expect(value[key]).toBeCloseTo(expected[key] ?? NaN, 6);
};

describe('gradientLine', () => {
  // Même convention que CSS : 0° vers le haut, 90° vers la droite, la ligne touche les coins.
  it('goes from top to bottom at 180°, and from left to right at 90°', () => {
    close(gradientLine(180, 1600, 900), { x0: 800, y0: 0, x1: 800, y1: 900 });
    close(gradientLine(90, 1600, 900), { x0: 0, y0: 450, x1: 1600, y1: 450 });
    close(gradientLine(0, 1600, 900), { x0: 800, y0: 900, x1: 800, y1: 0 });
  });

  it('reaches the corners on a diagonal', () => {
    const line = gradientLine(45, 100, 100);
    // Longueur CSS : |w sin a| + |h cos a| = 100 √2.
    expect(Math.hypot(line.x1 - line.x0, line.y1 - line.y0)).toBeCloseTo(100 * Math.SQRT2, 6);
    expect(line.x1).toBeGreaterThan(line.x0);
    expect(line.y1).toBeLessThan(line.y0);
  });
});

describe('imageLayout', () => {
  const centred = { x: 0.5, y: 0.5 };

  it('covers the frame (Remplir), cropping what sticks out', () => {
    // Image carrée dans un cadre 16:9 : elle prend la largeur et dépasse en haut et en bas.
    close(imageLayout('cover', { width: 1000, height: 1000 }, FRAME, centred, 1), { x: 0, y: -350, width: 1600, height: 1600 });
  });

  it('fits inside the frame (Ajuster), with bands', () => {
    close(imageLayout('contain', { width: 1000, height: 1000 }, FRAME, centred, 1), { x: 350, y: 0, width: 900, height: 900 });
  });

  it('stretches to the frame (Étirer)', () => {
    close(imageLayout('stretch', { width: 1000, height: 1000 }, FRAME, centred, 1), { x: 0, y: 0, width: 1600, height: 900 });
  });

  it('zooms around the focus point, and never uncovers the frame', () => {
    const zoomed = imageLayout('cover', { width: 1600, height: 900 }, FRAME, centred, 2);
    close(zoomed, { x: -800, y: -450, width: 3200, height: 1800 });
    // Point focal en haut à gauche : l'image se cale sur ce coin, sans laisser de vide.
    close(imageLayout('cover', { width: 1600, height: 900 }, FRAME, { x: 0, y: 0 }, 2), { x: 0, y: 0 });
    close(imageLayout('cover', { width: 1600, height: 900 }, FRAME, { x: 1, y: 1 }, 2), { x: -1600, y: -900 });
  });

  it('moves a smaller image inside its bands with the focus point', () => {
    close(imageLayout('contain', { width: 1000, height: 1000 }, FRAME, { x: 0, y: 0.5 }, 1), { x: 700 });
    close(imageLayout('contain', { width: 1000, height: 1000 }, FRAME, { x: 1, y: 0.5 }, 1), { x: 0 });
  });
});

describe('tileLayout', () => {
  it('repeats the image at its own size (times the scale and zoom), the focus point in the middle', () => {
    const tile = tileLayout({ width: 200, height: 100 }, FRAME, { x: 0.5, y: 0.5 }, 1, 2);
    close(tile, { width: 400, height: 200, offsetX: 200, offsetY: 150 });
  });
});

describe('backgroundCanvasSize', () => {
  it('keeps the frame ratio, the long side at most `max` pixels', () => {
    expect(backgroundCanvasSize(presetFormat('youtube'), 1024)).toEqual({ width: 1024, height: 576 });
    expect(backgroundCanvasSize(presetFormat('vertical'), 1024)).toEqual({ width: 576, height: 1024 });
    expect(backgroundCanvasSize(presetFormat('square'), 4096)).toEqual({ width: 1080, height: 1080 });
  });
});
