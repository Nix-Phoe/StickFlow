// Module Projet, version 1.0 : plusieurs personnages, apparence, décor, couleurs récentes.

import { describe, expect, it } from 'vitest';

import { LIMITS } from '../../core/types';
import { ORIGIN, testCharacter, testFrame, testProject, testShape } from '../../test/fixtures';
import {
  applyChange,
  canUndo,
  COALESCE_WINDOW_MS,
  createHistory,
  recordRecentColor,
  undo,
  type ProjectChange,
  type ProjectHistory,
} from '.';

const apart = 10 * COALESCE_WINDOW_MS;
const near = COALESCE_WINDOW_MS / 10;

function apply(history: ProjectHistory, changes: ProjectChange[], step = apart): ProjectHistory {
  return changes.reduce((h, change, i) => applyChange(h, change, i * step), history);
}

const start = (overrides = {}) => createHistory(testProject(overrides));
const characterIds = (h: ProjectHistory): string[] => h.present.characters.map((c) => c.id);

/** Deux personnages : c1 à l'origine, c2 décalé. */
const twoCharacters = () =>
  start({
    characters: [testCharacter('c1'), testCharacter('c2')],
    keyframes: [
      testFrame('f1', {}, ORIGIN, { c2: { pose: { torso: 1 }, rootPosition: { x: 100, y: 0 } } }),
      testFrame('f2', {}, ORIGIN, { c2: { pose: {}, rootPosition: { x: 120, y: 0 } } }),
    ],
  });

describe('invariants (createHistory)', () => {
  it('gives every keyframe a pose for every character, in the rest pose when missing', () => {
    const { present } = start({ characters: [testCharacter('c1'), testCharacter('c2')] });
    for (const keyframe of present.keyframes) expect(keyframe.poses.c2).toEqual({ pose: {}, rootPosition: ORIGIN });
  });

  it('drops the poses of characters that no longer exist', () => {
    const { present } = start({ keyframes: [testFrame('f1', {}, ORIGIN, { ghost: { pose: {}, rootPosition: ORIGIN } })] });
    expect(Object.keys(present.keyframes[0]?.poses ?? {})).toEqual(['c1']);
  });

  it('always keeps at least one character', () => {
    const { present } = start({ characters: [] });
    expect(present.characters).toHaveLength(1);
    expect(present.keyframes.every((k) => Object.keys(k.poses).length === 1)).toBe(true);
  });

  it('clamps the scale and keeps at most 8 recent colours', () => {
    const { present } = start({
      characters: [testCharacter('c1', { appearance: { scale: 9, defaultColor: null, segmentColors: {} } })],
      recentColors: Array.from({ length: 12 }, (_, i) => `#00000${i % 10}`),
    });
    expect(present.characters[0]?.appearance.scale).toBe(LIMITS.characterScale.max);
    expect(present.recentColors).toHaveLength(LIMITS.recentColors);
  });
});

describe('characters', () => {
  it('adds a character in its rest pose to every keyframe, offset from the others', () => {
    const history = apply(start(), [{ type: 'addCharacter', characterId: 'c2', name: 'Personnage 2' }]);
    expect(characterIds(history)).toEqual(['c1', 'c2']);
    for (const keyframe of history.present.keyframes) {
      expect(keyframe.poses.c2?.pose).toEqual({});
      expect(keyframe.poses.c2?.rootPosition).not.toEqual(ORIGIN);
    }
    expect(undo(history).present.characters).toHaveLength(1);
  });

  it('ignores an added character whose id is already used', () => {
    const history = start();
    expect(apply(history, [{ type: 'addCharacter', characterId: 'c1', name: 'x' }])).toBe(history);
  });

  it('duplicates a character right after it, with its appearance and offset poses', () => {
    const base = apply(twoCharacters(), [{ type: 'setCharacterScale', characterId: 'c2', scale: 1.5 }]);
    const history = apply(base, [{ type: 'duplicateCharacter', sourceId: 'c1', characterId: 'c3', name: 'Copie' }]);
    expect(characterIds(history)).toEqual(['c1', 'c3', 'c2']);
    const copy = history.present.characters[1];
    expect(copy?.name).toBe('Copie');
    expect(copy?.skeleton).toBe(history.present.characters[0]?.skeleton);
    const f1 = history.present.keyframes[0];
    expect(f1?.poses.c3?.pose).toEqual(f1?.poses.c1?.pose);
    expect(f1?.poses.c3?.rootPosition.x).toBeGreaterThan(f1?.poses.c1?.rootPosition.x ?? 0);
  });

  it('removes a character and its poses, but never the last one', () => {
    const history = apply(twoCharacters(), [{ type: 'removeCharacter', characterId: 'c1' }]);
    expect(characterIds(history)).toEqual(['c2']);
    expect(history.present.keyframes.every((k) => !('c1' in k.poses))).toBe(true);
    expect(apply(history, [{ type: 'removeCharacter', characterId: 'c2' }])).toBe(history);
  });

  it('renames a character, trimmed, keeping the old name when empty, typing in one step', () => {
    const history = apply(
      start(),
      [
        { type: 'renameCharacter', characterId: 'c1', name: ' A' },
        { type: 'renameCharacter', characterId: 'c1', name: ' Ali ' },
        { type: 'renameCharacter', characterId: 'c1', name: '   ' },
      ],
      near,
    );
    expect(history.present.characters[0]?.name).toBe('Ali');
    expect(undo(history).present.characters[0]?.name).toBe('c1');
  });

  it('moves a character up and down in the drawing order, within bounds', () => {
    const history = twoCharacters();
    const moved = apply(history, [{ type: 'moveCharacter', characterId: 'c1', direction: 1 }]);
    expect(characterIds(moved)).toEqual(['c2', 'c1']);
    expect(apply(moved, [{ type: 'moveCharacter', characterId: 'c1', direction: 1 }])).toBe(moved);
  });

  it('hides and locks a character, each toggle being its own step', () => {
    const history = apply(
      start(),
      [
        { type: 'setCharacterVisibility', characterId: 'c1', visible: false },
        { type: 'setCharacterLock', characterId: 'c1', locked: true },
      ],
      near,
    );
    expect(history.present.characters[0]).toMatchObject({ visible: false, locked: true });
    expect(undo(history).present.characters[0]).toMatchObject({ visible: false, locked: false });
  });
});

describe('appearance', () => {
  it('colours the selected parts only', () => {
    const history = apply(start(), [
      { type: 'setCharacterColor', characterId: 'c1', parts: ['forearmL', 'head'], color: '#ff0000' },
    ]);
    expect(history.present.characters[0]?.appearance).toEqual({
      scale: 1,
      defaultColor: null,
      segmentColors: { forearmL: '#ff0000', head: '#ff0000' },
    });
  });

  it('colours the whole character when no part is given, clearing the part colours', () => {
    const history = apply(start(), [
      { type: 'setCharacterColor', characterId: 'c1', parts: ['head'], color: '#ff0000' },
      { type: 'setCharacterColor', characterId: 'c1', parts: [], color: '#00ff00' },
    ]);
    expect(history.present.characters[0]?.appearance).toMatchObject({ defaultColor: '#00ff00', segmentColors: {} });
  });

  it('normalises colours to lower-case #rrggbb and ignores invalid ones', () => {
    const history = apply(start(), [{ type: 'setCharacterColor', characterId: 'c1', parts: [], color: '#ABC' }]);
    expect(history.present.characters[0]?.appearance.defaultColor).toBe('#aabbcc');
    expect(apply(history, [{ type: 'setCharacterColor', characterId: 'c1', parts: [], color: 'red' }])).toBe(history);
  });

  it('ignores parts that are not in the skeleton', () => {
    const history = start();
    expect(apply(history, [{ type: 'setCharacterColor', characterId: 'c1', parts: ['wing'], color: '#ff0000' }])).toBe(history);
  });

  it('groups a colour drag into one step', () => {
    const changes: ProjectChange[] = ['#100000', '#200000', '#300000'].map((color) => ({
      type: 'setCharacterColor',
      characterId: 'c1',
      parts: ['head'],
      color,
    }));
    const history = apply(start(), changes, near);
    expect(undo(history).present.characters[0]?.appearance.segmentColors).toEqual({});
  });

  it('scales a character between 50 % and 200 %', () => {
    const history = apply(start(), [{ type: 'setCharacterScale', characterId: 'c1', scale: 0.1 }]);
    expect(history.present.characters[0]?.appearance.scale).toBe(LIMITS.characterScale.min);
    const big = apply(history, [{ type: 'setCharacterScale', characterId: 'c1', scale: 1.25 }]);
    expect(big.present.characters[0]?.appearance.scale).toBe(1.25);
  });
});

describe('poses of several characters', () => {
  it('poses one character of a keyframe and leaves the others alone', () => {
    const history = apply(twoCharacters(), [
      { type: 'poseKeyframe', keyframeId: 'f1', poses: { c1: { pose: { torso: 2 }, rootPosition: ORIGIN } } },
    ]);
    const f1 = history.present.keyframes[0];
    expect(f1?.poses.c1?.pose).toEqual({ torso: 2 });
    expect(f1?.poses.c2?.pose).toEqual({ torso: 1 });
  });

  it('ignores poses of unknown characters', () => {
    const history = start();
    expect(
      apply(history, [{ type: 'poseKeyframe', keyframeId: 'f1', poses: { ghost: { pose: {}, rootPosition: ORIGIN } } }]),
    ).toBe(history);
  });

  it('inserts a keyframe with every character posed, completing missing ones from the previous keyframe', () => {
    const history = apply(twoCharacters(), [
      {
        type: 'insertKeyframe',
        afterKeyframeId: 'f1',
        keyframeId: 'new',
        poses: { c1: { pose: { torso: 3 }, rootPosition: ORIGIN } },
      },
    ]);
    const inserted = history.present.keyframes[1];
    expect(inserted?.poses.c1?.pose).toEqual({ torso: 3 });
    expect(inserted?.poses.c2).toEqual({ pose: { torso: 1 }, rootPosition: { x: 100, y: 0 } });
  });
});

describe('environment: shapes', () => {
  it('adds, updates and removes shapes, all undoable', () => {
    const added = apply(start(), [{ type: 'addShape', shape: testShape('s1') }]);
    expect(added.present.environment.shapes).toHaveLength(1);
    const updated = apply(added, [{ type: 'updateShape', shapeId: 's1', changes: { x: 10, fill: '#FF0000' } }]);
    expect(updated.present.environment.shapes[0]).toMatchObject({ x: 10, fill: '#ff0000' });
    const removed = apply(updated, [{ type: 'removeShape', shapeId: 's1' }]);
    expect(removed.present.environment.shapes).toEqual([]);
    expect(undo(removed).present.environment.shapes[0]?.x).toBe(10);
  });

  it('groups a shape drawn by dragging (created, then resized) into one step', () => {
    const history = apply(
      start(),
      [
        { type: 'addShape', shape: testShape('s1', { width: 0, height: 0 }) },
        { type: 'updateShape', shapeId: 's1', changes: { width: 20, height: 10 } },
        { type: 'updateShape', shapeId: 's1', changes: { width: 40, height: 20 } },
      ],
      near,
    );
    expect(undo(history).present.environment.shapes).toEqual([]);
  });

  it('keeps two quick gestures on the same shape apart when they carry different gesture tokens', () => {
    const history = apply(
      start(),
      [
        { type: 'addShape', shape: testShape('s1'), gesture: 'g1' },
        { type: 'updateShape', shapeId: 's1', changes: { width: 50 }, gesture: 'g1' },
        { type: 'updateShape', shapeId: 's1', changes: { x: 30 }, gesture: 'g2' },
      ],
      near,
    );
    expect(undo(history).present.environment.shapes[0]).toMatchObject({ x: 0, width: 50 });
  });

  it('clamps the stroke width and opacity of a shape, and keeps sizes positive', () => {
    const history = apply(start(), [
      { type: 'addShape', shape: testShape('s1', { strokeWidth: 999, opacity: 3, width: -5 }) },
    ]);
    expect(history.present.environment.shapes[0]).toMatchObject({
      strokeWidth: LIMITS.strokeWidth.max,
      opacity: 1,
      width: 0,
    });
  });

  it('ignores updates of an unknown shape and shapes added twice', () => {
    const history = apply(start(), [{ type: 'addShape', shape: testShape('s1') }]);
    expect(apply(history, [{ type: 'updateShape', shapeId: 'ghost', changes: { x: 1 } }])).toBe(history);
    expect(apply(history, [{ type: 'addShape', shape: testShape('s1') }])).toBe(history);
  });
});

describe('environment: drawing layer', () => {
  it('replaces the painted tiles of a stroke, a transparent tile being removed', () => {
    const first = apply(start(), [{ type: 'paintDrawing', tiles: { '0,0': 'data:a', '1,0': 'data:b' } }]);
    const second = apply(first, [{ type: 'paintDrawing', tiles: { '1,0': null, '2,0': 'data:c' } }]);
    expect(second.present.environment.drawing.tiles).toEqual({ '0,0': 'data:a', '2,0': 'data:c' });
  });

  it('makes each stroke its own undo step', () => {
    const history = apply(
      start(),
      [
        { type: 'paintDrawing', tiles: { '0,0': 'data:a' } },
        { type: 'paintDrawing', tiles: { '0,0': 'data:b' } },
      ],
      near,
    );
    expect(undo(history).present.environment.drawing.tiles).toEqual({ '0,0': 'data:a' });
  });
});

describe('recordRecentColor', () => {
  it('puts the colour first, without duplicates, at most 8', () => {
    let history = start();
    for (let i = 0; i < 10; i += 1) history = recordRecentColor(history, `#00000${i}`);
    history = recordRecentColor(history, '#000005');
    expect(history.present.recentColors[0]).toBe('#000005');
    expect(history.present.recentColors).toHaveLength(LIMITS.recentColors);
    expect(new Set(history.present.recentColors).size).toBe(LIMITS.recentColors);
  });

  it('is not an undo step, and survives undo and redo', () => {
    const changed = apply(start(), [{ type: 'setFps', fps: 30 }]);
    const recorded = recordRecentColor(changed, '#ff0000');
    expect(recorded.past).toHaveLength(changed.past.length);
    expect(undo(recorded).present.recentColors).toEqual(['#ff0000']);
    expect(canUndo(undo(recorded))).toBe(false);
  });

  it('ignores invalid colours', () => {
    const history = start();
    expect(recordRecentColor(history, 'nope')).toBe(history);
  });
});
