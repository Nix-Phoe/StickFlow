import { describe, expect, it } from 'vitest';

import type { LoopSettings, Project } from '../core/types';
import type { SequenceFrame } from '../model/sequence';
import { testProject } from '../test/fixtures';
import { presetFormat } from '../core/formats';
import { exportFileName, exportSize, pickVideoFormat, planDuration, planExport } from './export-plan';

const frame = (id: string): SequenceFrame => ({ kind: 'keyframe', id, poses: {} });
const sequence = [frame('a'), frame('b'), frame('c')];

const project = (loop: Partial<LoopSettings> = {}, fps = 10): Project => testProject({
  name: 'Saut',
  fps,
  ai: {
    smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
    loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4, ...loop },
  },
});

describe('exportSize', () => {
  it('uses the resolution of the video format of the project', () => {
    expect(exportSize(testProject({ format: presetFormat('vertical') }))).toEqual({ width: 1080, height: 1920 });
    expect(exportSize(testProject({ format: presetFormat('custom', { width: 640, height: 480 }) }))).toEqual({ width: 640, height: 480 });
    expect(planExport(testProject({ format: presetFormat('square') }), sequence, 'gif').size).toEqual({ width: 1080, height: 1080 });
  });
});

describe('planDuration', () => {
  it('is the time the exported frames last, in seconds', () => {
    expect(planDuration(planExport(project({}, 10), sequence, 'gif'))).toBeCloseTo(0.3);
    expect(planDuration(planExport(project({ enabled: true, repeatCount: 2 }, 10), sequence, 'mp4'))).toBeCloseTo(0.6);
  });
});

describe('planExport', () => {
  it('shows each frame for 1000 / fps milliseconds', () => {
    expect(planExport(project({}, 25), sequence, 'gif').delayMs).toBe(40);
  });

  it('plays the sequence once without Répétition', () => {
    const gif = planExport(project(), sequence, 'gif');
    expect(gif.frames).toEqual(sequence);
    expect(gif.gifRepeat).toBe(-1);
    expect(planExport(project(), sequence, 'mp4').frames).toHaveLength(3);
  });

  it('loops the GIF forever with an infinite Répétition, and records one pass of video', () => {
    expect(planExport(project({ enabled: true, infinite: true }), sequence, 'gif').gifRepeat).toBe(0);
    expect(planExport(project({ enabled: true, infinite: true }), sequence, 'mp4').frames).toHaveLength(3);
  });

  it('repeats N times: GIF loop count, video passes', () => {
    const loop = { enabled: true, infinite: false, repeatCount: 3 };
    const gif = planExport(project(loop), sequence, 'gif');
    expect(gif.frames).toHaveLength(3);
    expect(gif.gifRepeat).toBe(2);
    expect(planExport(project(loop), sequence, 'mp4').frames.map((f) => f.id)).toEqual([
      'a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c',
    ]);
  });

  it('plays a GIF repeated once a single time', () => {
    expect(planExport(project({ enabled: true, infinite: false, repeatCount: 1 }), sequence, 'gif').gifRepeat).toBe(-1);
  });

  it('exports each frame of one pass as an image sequence', () => {
    const loop = { enabled: true, infinite: false, repeatCount: 3 };
    expect(planExport(project(loop), sequence, 'png').frames).toHaveLength(3);
  });
});

describe('exportFileName', () => {
  it('turns the project name into a safe file name', () => {
    expect(exportFileName('Saut périlleux !', 'gif')).toBe('saut-perilleux.gif');
  });

  it('falls back to a default name', () => {
    expect(exportFileName('  ***  ', 'zip')).toBe('stickflow.zip');
  });
});

describe('pickVideoFormat', () => {
  it('prefers MP4 when the browser can record it', () => {
    expect(pickVideoFormat(() => true)).toEqual({ mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' });
  });

  it('falls back to WebM', () => {
    expect(pickVideoFormat((type) => type.startsWith('video/webm'))).toEqual({
      mimeType: 'video/webm;codecs=vp9',
      extension: 'webm',
    });
  });

  it('returns null when no video format can be recorded', () => {
    expect(pickVideoFormat(() => false)).toBeNull();
  });
});
