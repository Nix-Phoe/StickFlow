import { describe, expect, it } from 'vitest';

import { characterBounds } from '../model/character';
import { testCharacter } from '../test/fixtures';
import { STAGE_WORLD_HEIGHT } from './camera';
import { previewFraming } from './character-preview';
import { DEFAULT_STICKMAN_STYLE } from './scene';

const boundsOf = (framing: ReturnType<typeof previewFraming>) =>
  characterBounds(framing.character, framing.pose, DEFAULT_STICKMAN_STYLE.strokeWidth);

describe('previewFraming', () => {
  it('centres the character, in its rest pose, on the preview', () => {
    const box = boundsOf(previewFraming(testCharacter('c1'), { width: 300, height: 300 }));
    expect((box.minX + box.maxX) / 2).toBeCloseTo(0);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(0);
  });

  it('makes a tall character fill the height of the preview, with a margin', () => {
    const box = boundsOf(previewFraming(testCharacter('c1'), { width: 300, height: 300 }, 0.9));
    expect(box.maxY - box.minY).toBeCloseTo(0.9 * STAGE_WORLD_HEIGHT);
  });

  it('fits the width of a narrow preview', () => {
    const box = boundsOf(previewFraming(testCharacter('c1'), { width: 40, height: 300 }, 0.9));
    const visibleWidth = (STAGE_WORLD_HEIGHT * 40) / 300;
    expect(box.maxX - box.minX).toBeCloseTo(0.9 * visibleWidth);
  });

  it('ignores the size, visibility and pose of the character on the scene', () => {
    const small = testCharacter('c1', { visible: false, appearance: { scale: 0.5, defaultColor: null, segmentColors: {}, segmentBands: {} } });
    const framing = previewFraming(small, { width: 300, height: 300 });
    expect(framing.character.visible).toBe(true);
    expect(framing.pose.pose).toEqual({});
    expect(boundsOf(framing).maxY - boundsOf(framing).minY).toBeCloseTo(0.88 * STAGE_WORLD_HEIGHT);
  });
});
