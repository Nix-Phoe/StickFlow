import { describe, expect, it } from 'vitest';

import { createStroke, dabsBounds, type Dab, type StrokeSample } from './brush';

const settings = { strokeWidth: 10, opacity: 1 };
/** Échantillons le long d'une droite, espacés de `step` pixels, à `dt` ms d'intervalle. */
const line = (from: { x: number; y: number }, to: { x: number; y: number }, count: number, dt = 16, pressure = 0.5): StrokeSample[] =>
  Array.from({ length: count + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / count,
    y: from.y + ((to.y - from.y) * i) / count,
    time: i * dt,
    pressure,
  }));

function draw(tool: Parameters<typeof createStroke>[0], samples: StrokeSample[], options = settings, random?: () => number): Dab[] {
  const stroke = createStroke(tool, options, { pixelsPerUnit: 1, random });
  return samples.flatMap((sample) => stroke.add(sample));
}

const radii = (dabs: Dab[]): number[] => dabs.map((d) => d.radius);
const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

describe('createStroke', () => {
  it('lays round dabs close enough to look like a continuous line', () => {
    const dabs = draw('marker', line({ x: 0, y: 0 }, { x: 100, y: 0 }, 5));
    expect(dabs.length).toBeGreaterThan(20);
    for (let i = 1; i < dabs.length; i += 1) {
      const a = dabs[i - 1];
      const b = dabs[i];
      if (a && b) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThanOrEqual(b.radius / 2 + 1e-9);
    }
  });

  it('gives the marker a medium opaque round tip, the fine pen a thinner one', () => {
    const marker = draw('marker', line({ x: 0, y: 0 }, { x: 50, y: 0 }, 5));
    const pen = draw('pen', line({ x: 0, y: 0 }, { x: 50, y: 0 }, 5));
    expect(marker.every((d) => d.radius === 5 && d.alpha === 1)).toBe(true);
    expect(Math.max(...radii(pen))).toBeLessThan(5);
  });

  it('smooths a jittery stroke', () => {
    const jitter = line({ x: 0, y: 0 }, { x: 100, y: 0 }, 20).map((s, i) => ({ ...s, y: i % 2 === 0 ? 4 : -4 }));
    const dabs = draw('marker', jitter);
    expect(Math.max(...dabs.slice(5).map((d) => Math.abs(d.y)))).toBeLessThan(4);
  });

  it('makes the brush thinner when moving fast, and follows the pen pressure', () => {
    const slow = draw('brush', line({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, 40));
    const fast = draw('brush', line({ x: 0, y: 0 }, { x: 400, y: 0 }, 20, 4));
    expect(mean(radii(fast))).toBeLessThan(mean(radii(slow)));
    const light = draw('brush', line({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, 40, 0.2));
    const heavy = draw('brush', line({ x: 0, y: 0 }, { x: 40, y: 0 }, 20, 40, 0.9));
    expect(mean(radii(light))).toBeLessThan(mean(radii(heavy)));
  });

  it('makes the nib wide or thin depending on the direction, like a calligraphy pen', () => {
    const across = draw('nib', line({ x: 0, y: 0 }, { x: 60, y: -60 }, 10));
    const along = draw('nib', line({ x: 0, y: 0 }, { x: 60, y: 60 }, 10));
    expect(mean(radii(across.slice(3)))).toBeGreaterThan(2 * mean(radii(along.slice(3))));
  });

  it('sprays soft, see-through specks around the path with the airbrush', () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const dabs = draw('airbrush', line({ x: 0, y: 0 }, { x: 30, y: 0 }, 5), settings, random);
    expect(dabs.length).toBeGreaterThan(30);
    expect(dabs.every((d) => d.alpha < 0.3 && Math.abs(d.y) <= 10)).toBe(true);
    expect(new Set(dabs.map((d) => d.y.toFixed(2))).size).toBeGreaterThan(10);
  });

  it('erases with the eraser, and paints with the other tools', () => {
    expect(createStroke('eraser', settings).erases).toBe(true);
    expect(createStroke('pen', settings).erases).toBe(false);
  });

  it('scales world widths to layer pixels', () => {
    const dabs = createStroke('marker', settings, { pixelsPerUnit: 2 }).add({ x: 0, y: 0, time: 0, pressure: 0.5 });
    expect(dabs[0]?.radius).toBe(10);
  });
});

describe('dabsBounds', () => {
  it('encloses every dab with its radius', () => {
    expect(
      dabsBounds([
        { x: 10, y: 10, radius: 2, alpha: 1 },
        { x: 30, y: 5, radius: 4, alpha: 1 },
      ]),
    ).toEqual({ x: 8, y: 1, width: 26, height: 11 });
    expect(dabsBounds([])).toBeNull();
  });
});
