import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT, presetFormat } from '../../core/formats';
import { ORIGIN, testFrame, testProject } from '../../test/fixtures';
import { imageBackground } from '../background';
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

const frame = testFrame;
const project = testProject;

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
    expect(present.keyframes[0]?.poses.c1?.pose).toEqual({});
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
      { type: 'poseKeyframe', keyframeId: 'f1', poses: { c1: { pose: { torso: 1 }, rootPosition: { x: 5, y: 5 } } } },
    ]);
    expect(original).toEqual(snapshot);
  });
});

describe('applyChange: format de la vidéo', () => {
  it('changes the video format as an undoable step', () => {
    const history = apply(createHistory(project()), [{ type: 'setFormat', format: presetFormat('vertical') }]);
    expect(history.present.format).toEqual(presetFormat('vertical'));
    expect(undo(history).present.format).toEqual(DEFAULT_FORMAT);
  });

  it('normalizes the format and ignores a format that does not change anything', () => {
    const start = createHistory(project());
    expect(apply(start, [{ type: 'setFormat', format: { preset: 'square', width: 1, height: 1 } }]).present.format).toEqual(
      presetFormat('square'),
    );
    expect(apply(start, [{ type: 'setFormat', format: DEFAULT_FORMAT }])).toBe(start);
  });

  it('gives a project without a format the default one', () => {
    const { format: _ignored, ...withoutFormat } = project();
    expect(createHistory(withoutFormat as ReturnType<typeof project>).present.format).toEqual(DEFAULT_FORMAT);
  });
});

describe('applyChange: keyframes', () => {
  it('inserts a keyframe right after the given one, copying its pose', () => {
    const start = createHistory(project({ keyframes: [frame('f1', { torso: 1 }), frame('f2')] }));
    const history = apply(start, [{ type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new' }]);
    expect(ids(history)).toEqual(['f1', 'new', 'f2']);
    expect(history.present.keyframes[1]?.poses.c1?.pose).toEqual({ torso: 1 });
  });

  it('inserts a keyframe with its own pose when one is given', () => {
    const history = apply(createHistory(project()), [
      { type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new', poses: { c1: { pose: { torso: 2 }, rootPosition: { x: 3, y: 0 } } } },
    ]);
    expect(history.present.keyframes[1]).toEqual(frame('new', { torso: 2 }, { x: 3, y: 0 }));
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
      { type: 'poseKeyframe', keyframeId: 'f1', poses: { c1: { pose: { torso: 1 }, rootPosition: { x: 5, y: 0 } } } },
    ]);
    expect(posed.present.keyframes[0]).toEqual(frame('f1', { torso: 1 }, { x: 5, y: 0 }));
  });

  it('ignores a pose for an unknown keyframe', () => {
    const start = createHistory(project());
    expect(apply(start, [{ type: 'poseKeyframe', keyframeId: 'ghost', poses: { c1: { pose: {}, rootPosition: { x: 0, y: 0 } } } }])).toBe(start);
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
      poses: { c1: { pose: { torso }, rootPosition: ORIGIN } },
    }));
    const history = apply(createHistory(project()), poses, 0, near);
    expect(undo(history).present.keyframes[0]?.poses.c1?.pose).toEqual({});
  });

  it('groups a keyframe inserted with a pose with the poses that follow (converting a generated frame by dragging)', () => {
    const history = apply(
      createHistory(project()),
      [
        { type: 'insertKeyframe', afterKeyframeId: 'f1', keyframeId: 'new', poses: { c1: { pose: { torso: 0.1 }, rootPosition: { x: 0, y: 0 } } } },
        { type: 'poseKeyframe', keyframeId: 'new', poses: { c1: { pose: { torso: 0.2 }, rootPosition: { x: 0, y: 0 } } } },
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
        { type: 'poseKeyframe', keyframeId: 'new', poses: { c1: { pose: { torso: 0.2 }, rootPosition: { x: 0, y: 0 } } } },
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

describe('applyChange: rename', () => {
  it('renames the project, trimming spaces', () => {
    const history = apply(createHistory(project()), [{ type: 'rename', name: '  Saut périlleux  ' }]);
    expect(history.present.name).toBe('Saut périlleux');
  });

  it('keeps the old name when the new one is empty', () => {
    const start = createHistory(project());
    expect(apply(start, [{ type: 'rename', name: '   ' }])).toBe(start);
  });

  it('cuts names that are too long', () => {
    const history = apply(createHistory(project()), [{ type: 'rename', name: 'x'.repeat(500) }]);
    expect(history.present.name).toHaveLength(80);
  });

  it('is undoable, typing included in one step', () => {
    const history = apply(
      createHistory(project()),
      ['S', 'Sa', 'Sau', 'Saut'].map((name): ProjectChange => ({ type: 'rename', name })),
      0,
      COALESCE_WINDOW_MS / 4,
    );
    expect(undo(history).present.name).toBe('Test');
  });
});

describe('applyChange: arrière-plan (v2.1)', () => {
  const photo = { ...imageBackground('a1'), zoom: 1 };

  it('sets, changes and removes the background, each step undoable', () => {
    const steps = apply(createHistory(project()), [
      { type: 'setBackground', background: { type: 'color', color: '#112233' } },
      { type: 'setBackground', background: photo },
      { type: 'updateBackground', changes: { zoom: 2 } },
      { type: 'setBackground', background: null },
    ]);
    expect(steps.present.environment.background).toBeNull();
    const back = undo(steps);
    expect(back.present.environment.background).toEqual({ ...photo, zoom: 2 });
    expect(undo(undo(back)).present.environment.background).toEqual({ type: 'color', color: '#112233' });
  });

  it('ignores an invalid background and a setting for another type', () => {
    const history = createHistory(project());
    expect(applyChange(history, { type: 'setBackground', background: { type: 'builtin', id: 'beach' as never } }, 0)).toBe(history);
    expect(applyChange(history, { type: 'updateBackground', changes: { zoom: 2 } }, 0)).toBe(history);
  });

  it('makes one undo step of a slider drag (same gesture), but two of two drags', () => {
    const start = apply(createHistory(project()), [{ type: 'setBackground', background: photo }]);
    const drag = (gesture: string, from: number): ProjectChange[] =>
      [1.2, 1.5, 1.8].map((zoom) => ({ type: 'updateBackground', changes: { zoom: zoom + from }, gesture }));
    const once = apply(start, drag('g1', 0), 100_000, 50);
    expect(undo(once).present.environment.background).toEqual(photo);
    const twice = apply(once, drag('g2', 1), 100_200, 50);
    expect(twice.present.environment.background).toMatchObject({ zoom: 2.8 });
    expect(undo(twice).present.environment.background).toMatchObject({ zoom: 1.8 });
  });
});
