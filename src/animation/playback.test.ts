import { describe, expect, it } from 'vitest';

import { advancePlayback, frameDuration } from './playback';

describe('frameDuration', () => {
  it('lasts 1000 / fps milliseconds at normal speed', () => {
    expect(frameDuration(10, 1)).toBeCloseTo(100, 9);
  });

  it('gets shorter with the preview speed', () => {
    expect(frameDuration(10, 5)).toBeCloseTo(20, 9);
  });
});

describe('advancePlayback', () => {
  const at = (index: number, carryMs = 0) => ({ index, carryMs, pass: 0 });

  it('stays on the same frame until a full frame duration has elapsed', () => {
    expect(advancePlayback(at(0), 99, 100, 5, Infinity)).toMatchObject({ index: 0, carryMs: 99 });
  });

  it('moves one frame per frame duration, keeping the remainder', () => {
    const next = advancePlayback(at(0, 60), 60, 100, 5, Infinity);
    expect(next.index).toBe(1);
    expect(next.carryMs).toBeCloseTo(20, 9);
  });

  it('can move several frames at once', () => {
    expect(advancePlayback(at(1), 300, 100, 5, Infinity)).toMatchObject({ index: 4, carryMs: 0 });
  });

  it('loops back to the first frame after the last one', () => {
    expect(advancePlayback(at(4), 200, 100, 5, Infinity)).toMatchObject({ index: 1, carryMs: 0 });
  });

  it('keeps a single frame in place', () => {
    expect(advancePlayback(at(0), 500, 100, 1, Infinity).index).toBe(0);
  });

  it('brings an index beyond the frames back in range', () => {
    expect(advancePlayback(at(7), 0, 100, 5, Infinity).index).toBe(2);
  });
});

describe('advancePlayback (passages)', () => {
  const start = { index: 0, carryMs: 0, pass: 0 };

  it('counts a pass each time the playhead goes past the last frame', () => {
    const next = advancePlayback({ index: 3, carryMs: 0, pass: 0 }, 300, 100, 5, Infinity);
    expect(next).toEqual({ index: 1, carryMs: 0, pass: 1, finished: false });
  });

  it('never finishes when the number of passes is infinite', () => {
    expect(advancePlayback(start, 100_000, 100, 5, Infinity).finished).toBe(false);
  });

  it('stops on the last frame once the last pass is over', () => {
    const next = advancePlayback({ index: 3, carryMs: 0, pass: 0 }, 300, 100, 5, 1);
    expect(next).toEqual({ index: 4, carryMs: 0, pass: 1, finished: true });
  });

  it('plays the requested number of passes', () => {
    // 2 passages de 5 frames : 9 pas depuis la frame 0 mènent à la dernière frame du 2e passage.
    expect(advancePlayback(start, 900, 100, 5, 2)).toEqual({ index: 4, carryMs: 0, pass: 1, finished: false });
    expect(advancePlayback(start, 1000, 100, 5, 2).finished).toBe(true);
  });
});
