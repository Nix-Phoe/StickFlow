import { describe, expect, it } from 'vitest';

import { presetFormat } from '../core/formats';
import { testCharacter, testFrame, testProject, testShape } from '../test/fixtures';
import { frameWorldSize, outOfFrame } from './format-fit';

describe('frameWorldSize', () => {
  it('keeps a fixed height in the world and follows the ratio across', () => {
    expect(frameWorldSize(presetFormat('youtube'))).toEqual({ width: 400 * (16 / 9), height: 400 });
    expect(frameWorldSize(presetFormat('vertical'))).toEqual({ width: 400 * (9 / 16), height: 400 });
  });
});

describe('outOfFrame', () => {
  it('finds nothing outside when everything fits', () => {
    const project = testProject({ environment: { background: null, shapes: [testShape('s1')], drawing: { tiles: {} } } });
    expect(outOfFrame(project, presetFormat('vertical'))).toEqual({ characters: [], shapes: [] });
  });

  it('lists the characters that leave the frame in at least one keyframe', () => {
    const project = testProject({
      characters: [testCharacter('c1'), testCharacter('c2')],
      keyframes: [
        testFrame('f1', {}, { x: 0, y: 0 }, { c2: { pose: {}, rootPosition: { x: 0, y: 0 } } }),
        testFrame('f2', {}, { x: 0, y: 0 }, { c2: { pose: {}, rootPosition: { x: 200, y: 0 } } }),
      ],
    });
    // 9:16 : le cadre ne fait que 225 unités de large, c2 en sort ; en 16:9, il y tient.
    expect(outOfFrame(project, presetFormat('vertical')).characters).toEqual(['c2']);
    expect(outOfFrame(project, presetFormat('youtube')).characters).toEqual([]);
  });

  it('ignores hidden characters, which are not exported', () => {
    const project = testProject({
      characters: [testCharacter('c1', { visible: false })],
      keyframes: [testFrame('f1', {}, { x: 300, y: 0 })],
    });
    expect(outOfFrame(project, presetFormat('vertical')).characters).toEqual([]);
  });

  it('lists the shapes that leave the frame, rotation included', () => {
    const wide = testShape('wide', { width: 300, height: 10 });
    const turned = testShape('turned', { width: 300, height: 10, rotation: Math.PI / 2 });
    const project = testProject({ environment: { background: null, shapes: [wide, turned], drawing: { tiles: {} } } });
    expect(outOfFrame(project, presetFormat('vertical')).shapes).toEqual(['wide']);
  });
});
