import { describe, expect, it } from 'vitest';

import { DRAWING_LAYER, layerToWorld, tileKey, tileRect, tilesInRect, worldToLayer } from './drawing-layer';

describe('drawing layer geometry', () => {
  it('is made of whole tiles and is exactly as tall as the stage', () => {
    expect(DRAWING_LAYER.width % DRAWING_LAYER.tileSize).toBe(0);
    expect(DRAWING_LAYER.height % DRAWING_LAYER.tileSize).toBe(0);
    expect(DRAWING_LAYER.height / DRAWING_LAYER.pixelsPerUnit).toBeCloseTo(400, 9);
  });

  it('maps the world origin to the centre of the layer, y pointing down in pixels', () => {
    expect(worldToLayer({ x: 0, y: 0 })).toEqual({ x: DRAWING_LAYER.width / 2, y: DRAWING_LAYER.height / 2 });
    const up = worldToLayer({ x: 0, y: 100 });
    expect(up.y).toBeLessThan(DRAWING_LAYER.height / 2);
  });

  it('round-trips between world and layer pixels', () => {
    const point = { x: 123.5, y: -45.25 };
    const back = layerToWorld(worldToLayer(point));
    expect(back.x).toBeCloseTo(point.x, 9);
    expect(back.y).toBeCloseTo(point.y, 9);
  });

  it('lists the tiles touched by a pixel rectangle, clipped to the layer', () => {
    expect(tilesInRect({ x: 250, y: 10, width: 20, height: 20 })).toEqual([tileKey(0, 0), tileKey(1, 0)]);
    expect(tilesInRect({ x: -50, y: -50, width: 40, height: 40 })).toEqual([]);
    expect(tilesInRect({ x: -10, y: -10, width: 20, height: 20 })).toEqual(['0,0']);
  });

  it('gives the pixel rectangle of a tile', () => {
    expect(tileRect('2,1')).toEqual({ x: 512, y: 256, width: 256, height: 256 });
  });
});
