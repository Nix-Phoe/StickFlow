import { describe, expect, it } from 'vitest';

import type { SequenceFrame } from '../model/sequence';
import { onionSkinFrame } from './onion-skin';

const frame = (id: string): SequenceFrame => ({ kind: 'keyframe', id, poses: {} });
const frames = [frame('a'), frame('b'), frame('c')];

describe('onionSkinFrame', () => {
  it('shows the frame just before the active one', () => {
    expect(onionSkinFrame(frames, 2, { enabled: true, isPlaying: false })?.id).toBe('b');
  });

  it('shows nothing on the first frame', () => {
    expect(onionSkinFrame(frames, 0, { enabled: true, isPlaying: false })).toBeNull();
  });

  it('shows nothing when switched off', () => {
    expect(onionSkinFrame(frames, 2, { enabled: false, isPlaying: false })).toBeNull();
  });

  it('shows nothing during playback', () => {
    expect(onionSkinFrame(frames, 2, { enabled: true, isPlaying: true })).toBeNull();
  });
});
