import { describe, expect, it } from 'vitest';

import { advancePlayhead, frameDuration } from './playback';

describe('frameDuration', () => {
  it('lasts 1000 / fps milliseconds at normal speed', () => {
    expect(frameDuration(10, 1)).toBeCloseTo(100, 9);
  });

  it('gets shorter with the preview speed', () => {
    expect(frameDuration(10, 5)).toBeCloseTo(20, 9);
  });
});

describe('advancePlayhead', () => {
  it('stays on the same frame until a full frame duration has elapsed', () => {
    expect(advancePlayhead({ index: 0, carryMs: 0 }, 99, 100, 5)).toEqual({ index: 0, carryMs: 99 });
  });

  it('moves one frame per frame duration, keeping the remainder', () => {
    const next = advancePlayhead({ index: 0, carryMs: 60 }, 60, 100, 5);
    expect(next.index).toBe(1);
    expect(next.carryMs).toBeCloseTo(20, 9);
  });

  it('can move several frames at once', () => {
    expect(advancePlayhead({ index: 1, carryMs: 0 }, 300, 100, 5)).toEqual({ index: 4, carryMs: 0 });
  });

  it('loops back to the first frame after the last one', () => {
    expect(advancePlayhead({ index: 4, carryMs: 0 }, 200, 100, 5)).toEqual({ index: 1, carryMs: 0 });
  });

  it('keeps a single frame in place', () => {
    expect(advancePlayhead({ index: 0, carryMs: 0 }, 500, 100, 1).index).toBe(0);
  });

  it('brings an index beyond the frames back in range', () => {
    expect(advancePlayhead({ index: 7, carryMs: 0 }, 0, 100, 5).index).toBe(2);
  });
});
