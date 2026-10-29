import { describe, expect, it } from 'vitest';

import type { Project } from '../core/types';
import type { SequenceFrame } from '../model/sequence';
import { ORIGIN, testCharacter, testFrame, testProject, testShape } from '../test/fixtures';
import type { Rgba } from './color';
import { DEFAULT_STICKMAN_STYLE } from './scene';
import { buildSceneLayers } from './scene-layers';
import { THUMBNAIL_STYLE, thumbnailLayers } from './thumbnail';

const AUTO: Rgba = [0.9, 0.9, 0.9, 1];

const project: Project = testProject({
  characters: [
    testCharacter('c1', {
      appearance: {
        scale: 1,
        defaultColor: '#f1c27d',
        segmentColors: { head: '#e39400' },
        segmentBands: { upperArmL: [{ from: 0, to: 0.5, color: '#9b1b30' }] },
      },
    }),
    testCharacter('hidden', { visible: false }),
  ],
  keyframes: [testFrame('f1', { upperArmL: 0.4 }, ORIGIN, { hidden: { pose: {}, rootPosition: ORIGIN } })],
  environment: { background: null, shapes: [testShape('s1', { fill: '#00ff00' })], drawing: { tiles: {} } },
});
const frame: SequenceFrame = { kind: 'keyframe', id: 'f1', poses: project.keyframes[0]?.poses ?? {} };
const generated: SequenceFrame = { kind: 'generated', id: 'g1', poses: frame.poses, from: 'f1', to: 'f2', step: 1 };

const characterCapsules = (layers: ReturnType<typeof thumbnailLayers>) =>
  layers.flatMap((l) => (l.kind === 'capsules' && l.role === 'characters' ? l.capsules : []));

describe('thumbnailLayers', () => {
  it('shows each frame like the final rendering of the scene: same colours, zones and positions', () => {
    const scene = characterCapsules(buildSceneLayers({ project, frame, onion: null, mode: null, selection: { selectedCharacterId: null, selectedNodeId: null, selectedParts: [], selectedShapeId: null }, palette: { stickman: AUTO, accent: AUTO } }));
    const thumbnail = characterCapsules(thumbnailLayers(project, frame, AUTO));
    expect(thumbnail.map((c) => c.color)).toEqual(scene.map((c) => c.color));
    expect(thumbnail.map((c) => c.a)).toEqual(scene.map((c) => c.a));
    expect(thumbnail.map((c) => c.clip)).toEqual(scene.map((c) => c.clip));
  });

  it('keeps the colours of the character for a generated frame too', () => {
    const colors = characterCapsules(thumbnailLayers(project, generated, AUTO)).map((c) => c.color);
    expect(colors).toContainEqual([241 / 255, 194 / 255, 125 / 255, 1]);
    expect(colors).not.toContainEqual(AUTO);
  });

  it('draws the décor shapes and no editing aid', () => {
    const layers = thumbnailLayers(project, frame, AUTO);
    expect(layers.some((l) => l.kind === 'shapes' && l.shapes.length === 1)).toBe(true);
    expect(layers.every((l) => l.kind !== 'capsules' || l.role === 'characters' || l.capsules.length === 0)).toBe(true);
  });

  it('draws thicker limbs than the scene, to stay readable when small', () => {
    expect(THUMBNAIL_STYLE.strokeWidth).toBeGreaterThan(DEFAULT_STICKMAN_STYLE.strokeWidth);
    const torso = characterCapsules(thumbnailLayers(project, frame, AUTO))[0];
    expect(torso?.radius).toBe(THUMBNAIL_STYLE.strokeWidth / 2);
  });
});
