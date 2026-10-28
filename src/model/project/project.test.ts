import { describe, expect, it } from 'vitest';

import type { Keyframe, Project } from '../../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../skeleton';
import {
  applyChange,
  canRedo,
  canUndo,
  COALESCE_WINDOW_MS,
  createHistory,
  HISTORY_LIMIT,
  redo,
  undo,
  type ProjectChange,
  type ProjectHistory,
} from '.';

const skeleton = sortSkeleton(createDefaultSkeleton());

const frame = (id: string, pose: Record<string, number> = {}): Keyframe => ({
  id,
  pose,
  rootPosition: { x: 0, y: 0 },
});

function project(overrides: Partial<Project> = {}): Project {
  return {
    name: 'Test',
    fps: 12,
    skeleton,
    keyframes: [frame('f1'), frame('f2')],
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
      loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4 },
    },
    ...overrides,
  };
}

/** Applique une suite de changements, à des heures croissantes et bien séparées par défaut. */
function apply(history: ProjectHistory, changes: ProjectChange[], start = 0, step = 10 * COALESCE_WINDOW_MS) {
  return changes.reduce((h, change, i) => applyChange(h, change, start + i * step), history);
}

const ids = (h: ProjectHistory): string[] => h.present.keyframes.map((f) => f.id);

describe('createHistory', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createHistory(project());
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('brings out-of-range settings back within their limits', () => {
    const { present } = createHistory(
      project({
        fps: 0,
        ai: {
          smoothing: { enabled: true, intensity: 50, curve: 'linear' },
          loop: { enabled: true, repeatCount: 0, infinite: false, transitionFrames: 99 },
        },
      }),
    );
    expect(present.fps).toBe(1);
    expect(present.ai.smoothing.intensity).toBe(8);
    expect(present.ai.loop.repeatCount).toBe(1);
    expect(present.ai.loop.transitionFrames).toBe(12);
  });

  it('rounds the fps to a whole number', () => {
    expect(createHistory(project({ fps: 12.6 })).present.fps).toBe(13);
  });

  it('gives a project without keyframes one keyframe in the rest pose', () => {
    const { present } = createHistory(project({ keyframes: [] }));
    expect(present.keyframes).toHaveLength(1);
    expect(present.keyframes[0]?.pose).toEqual({});
  });
});

describe('applyChange: settings', () => {
  it('sets the fps, clamped and rounded', () => {
    expect(apply(createHistory(project()), [{ type: 'setFps', fps: 99 }]).present.fps).toBe(60);
    expect(apply(createHistory(project()), [{ type: 'setFps', fps: 7.4 }]).present.fps).toBe(7);
  });

  it('adds no step when a change leaves the project as it was', () => {
    const history = apply(createHistory(project()), [{ type: 'setFps', fps: 12 }]);
    expect(canUndo(history)).toBe(false);
  });

  it('merges smoothing settings and clamps the intensity', () => {
    const { smoothing } = apply(createHistory(project()), [
      { type: 'updateSmoothing', changes: { intensity: 50 } },
      { type: 'updateSmoothing', changes: { curve: 'linear' } },
    ]).present.ai;
    expect(smoothing).toEqual({ enabled: true, intensity: 8, curve: 'linear' });
  });

  it('keeps the repeat count while the loop is infinite', () => {
    const history = apply(createHistory(project()), [
      { type: 'updateLoop', changes: { repeatCount: 5 } },
      { type: 'updateLoop', changes: { infinite: true } },
      { type: 'updateLoop', changes: { infinite: false } },
    ]);
    expect(history.present.ai.loop.repeatCount).toBe(5);
    expect(history.present.ai.loop.infinite).toBe(false);
  });

  it('clamps loop settings', () => {
    const { loop } = apply(createHistory(project()), [
      { type: 'updateLoop', changes: { repeatCount: 500, transitionFrames: 0 } },
    ]).present.ai;
    expect(loop.repeatCount).toBe(99);
    expect(loop.transitionFrames).toBe(1);
  });

  it('never mutates the previous project', () => {
    const original = project();
    const snapshot = structuredClone(original);
    apply(createHistory(original), [
      { type: 'setFps', fps: 30 },
      { type: 'updateLoop', changes: { infinite: true } },
      { type: 'poseKeyframe', keyframeId: 'f1', pose: { torso: 1 }, rootPosition: { x: 5, y: 5 } },
    ]);
    expect(original).toEqual(snapshot);
  });
});

describe('applyChange: keyframes', () => {
  it('inserts a keyframe right after the given one, copying its pose', () => {
    const start = createHistory(project({ keyframes: [frame('f1', { torso: 1 }), frame('f2')] }));
    const history = apply(start, [{ type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new' }]);
    expect(ids(history)).toEqual(['f1', 'new', 'f2']);
    expect(history.present.keyframes[1]?.pose).toEqual({ torso: 1 });
  });

  it('inserts a keyframe with its own pose when one is given', () => {
    const history = apply(createHistory(project()), [
      { type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new', pose: { torso: 2 }, rootPosition: { x: 3, y: 0 } },
    ]);
    expect(history.present.keyframes[1]).toEqual({ id: 'new', pose: { torso: 2 }, rootPosition: { x: 3, y: 0 } });
  });

  it('ignores an insertion after an unknown keyframe, or with an id already used', () => {
    const start = createHistory(project());
    expect(apply(start, [{ type: 'insertKeyframe', afterKeyframeId: 'ghost', keyframeId: 'new' }])).toBe(start);
    expect(apply(start, [{ type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'f2' }])).toBe(start);
  });

  it('deletes a keyframe', () => {
    const history = apply(createHistory(project()), [{ type: 'deleteKeyframe', keyframeId: 'f1' }]);
    expect(ids(history)).toEqual(['f2']);
  });

  it('refuses to delete the last keyframe', () => {
    const start = createHistory(project({ keyframes: [frame('only')] }));
    expect(apply(start, [{ type: 'deleteKeyframe', keyframeId: 'only' }])).toBe(start);
  });

  it('poses a keyframe', () => {
    const posed = apply(createHistory(project()), [
      { type: 'poseKeyframe', keyframeId: 'f1', pose: { torso: 1 }, rootPosition: { x: 5, y: 0 } },
    ]);
    expect(posed.present.keyframes[0]).toEqual({ id: 'f1', pose: { torso: 1 }, rootPosition: { x: 5, y: 0 } });
  });

  it('ignores a pose for an unknown keyframe', () => {
    const start = createHistory(project());
    expect(apply(start, [{ type: 'poseKeyframe', keyframeId: 'ghost', pose: {}, rootPosition: { x: 0, y: 0 } }])).toBe(start);
  });
});

describe('undo / redo', () => {
  it('undoes and redoes a change', () => {
    const changed = apply(createHistory(project()), [{ type: 'setFps', fps: 30 }]);
    const undone = undo(changed);
    expect(undone.present.fps).toBe(12);
    expect(canRedo(undone)).toBe(true);
    expect(redo(undone).present.fps).toBe(30);
  });

  it('undoes a frame insertion', () => {
    const changed = apply(createHistory(project()), [{ type: 'insertKeyframe', afterKeyframeId: 'f2', keyframeId: 'new' }]);
    expect(ids(undo(changed))).toEqual(['f1', 'f2']);
  });

  it('returns the same history when there is nothing to undo or redo', () => {
    const history = createHistory(project());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('forgets the redo steps when a new change is made', () => {
    const history = apply(undo(apply(createHistory(project()), [{ type: 'setFps', fps: 30 }])), [
      { type: 'setFps', fps: 24 },
    ]);
    expect(canRedo(history)).toBe(false);
  });

  it(`keeps at most ${HISTORY_LIMIT} steps`, () => {
    const changes: ProjectChange[] = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({
      type: 'updateLoop',
      changes: { enabled: i % 2 === 0 },
    }));
    let history = apply(createHistory(project()), changes);
    let steps = 0;
    while (canUndo(history)) {
      history = undo(history);
      steps += 1;
    }
    expect(steps).toBe(HISTORY_LIMIT);
  });
});

describe('grouping quick changes into one step', () => {
  const near = COALESCE_WINDOW_MS / 4;

  it('groups consecutive changes of the same setting made in quick succession', () => {
    const history = apply(
      createHistory(project()),
      [13, 14, 15].map((fps): ProjectChange => ({ type: 'setFps', fps })),
      0,
      near,
    );
    expect(history.present.fps).toBe(15);
    expect(undo(history).present.fps).toBe(12);
    expect(canUndo(undo(history))).toBe(false);
  });

  it('keeps changes apart when there is a pause between them', () => {
    const history = apply(
      createHistory(project()),
      [13, 14].map((fps): ProjectChange => ({ type: 'setFps', fps })),
      0,
      COALESCE_WINDOW_MS + 1,
    );
    expect(undo(history).present.fps).toBe(13);
  });

  it('keeps changes of different settings apart', () => {
    const history = apply(
      createHistory(project()),
      [
        { type: 'updateSmoothing', changes: { intensity: 5 } },
        { type: 'updateLoop', changes: { transitionFrames: 6 } },
      ],
      0,
      near,
    );
    expect(undo(history).present.ai.smoothing.intensity).toBe(5);
  });

  it('never groups on/off toggles', () => {
    const history = apply(
      createHistory(project()),
      [
        { type: 'updateLoop', changes: { enabled: true } },
        { type: 'updateLoop', changes: { enabled: false } },
      ],
      0,
      near,
    );
    expect(undo(history).present.ai.loop.enabled).toBe(true);
  });

  it('groups a drag (successive poses of the same frame) into one step', () => {
    const poses: ProjectChange[] = [0.1, 0.2, 0.3].map((torso) => ({
      type: 'poseKeyframe',
      keyframeId: 'f1',
      pose: { torso },
      rootPosition: { x: 0, y: 0 },
    }));
    const history = apply(createHistory(project()), poses, 0, near);
    expect(undo(history).present.keyframes[0]?.pose).toEqual({});
  });

  it('groups a keyframe inserted with a pose with the poses that follow (converting a generated frame by dragging)', () => {
    const history = apply(
      createHistory(project()),
      [
        { type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new', pose: { torso: 0.1 }, rootPosition: { x: 0, y: 0 } },
        { type: 'poseKeyframe', keyframeId: 'new', pose: { torso: 0.2 }, rootPosition: { x: 0, y: 0 } },
      ],
      0,
      near,
    );
    expect(ids(undo(history))).toEqual(['f1', 'f2']);
  });

  it('never groups a plain insertion (copy) with what follows', () => {
    const history = apply(
      createHistory(project()),
      [
        { type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new' },
        { type: 'poseKeyframe', keyframeId: 'new', pose: { torso: 0.2 }, rootPosition: { x: 0, y: 0 } },
      ],
      0,
      near,
    );
    expect(ids(undo(history))).toEqual(['f1', 'new', 'f2']);
  });

  it('starts a new step after an undo', () => {
    let history = apply(createHistory(project()), [{ type: 'setFps', fps: 13 }], 0);
    history = undo(history);
    history = applyChange(history, { type: 'setFps', fps: 14 }, near);
    expect(undo(history).present.fps).toBe(12);
  });
});
