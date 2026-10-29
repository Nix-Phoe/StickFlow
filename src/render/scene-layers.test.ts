import { describe, expect, it } from 'vitest';

import { createSession } from '../core/session';
import type { Project } from '../core/types';
import type { SequenceFrame } from '../model/sequence';
import { ORIGIN, testCharacter, testFrame, testProject, testShape } from '../test/fixtures';
import type { Rgba } from './color';
import { buildSceneLayers, DIMMED_OPACITY, type SceneLayer, type SceneLayersInput } from './scene-layers';

const BLACK: Rgba = [0, 0, 0, 1];
const BLUE: Rgba = [0, 0, 1, 1];
/** Capsules dessinées par personnage du squelette par défaut (la racine ne dessine rien). */
const PARTS = 10;

const project: Project = testProject({
  characters: [
    testCharacter('c1', {
      appearance: {
        scale: 1,
        defaultColor: null,
        segmentColors: { head: '#ff0000' },
        segmentBands: { torso: [{ from: 0, to: 0.5, color: '#0000ff' }] },
      },
    }),
    testCharacter('c2'),
    testCharacter('hidden', { visible: false }),
  ],
  keyframes: [testFrame('f1', {}, ORIGIN, { c2: { pose: {}, rootPosition: { x: 100, y: 0 } } })],
  environment: { background: null, shapes: [testShape('s1', { fill: '#00ff00' })], drawing: { tiles: {} } },
});
const frame: SequenceFrame = { kind: 'keyframe', id: 'f1', poses: project.keyframes[0]?.poses ?? {} };

function layers(overrides: Partial<SceneLayersInput> = {}): SceneLayer[] {
  return buildSceneLayers({
    project,
    frame,
    onion: null,
    mode: 'characters',
    selection: createSession(),
    palette: { stickman: BLACK, accent: BLUE },
    ...overrides,
  });
}

const capsuleLayers = (all: SceneLayer[]) => all.flatMap((l) => (l.kind === 'capsules' ? [l] : []));
const characterLayer = (all: SceneLayer[]) => capsuleLayers(all).find((l) => l.role === 'characters');

describe('buildSceneLayers', () => {
  it('draws the drawing layer, then the shapes, then the characters', () => {
    expect(layers().map((l) => (l.kind === 'capsules' ? l.role : l.kind)).slice(0, 4)).toEqual([
      'drawing',
      'shapes',
      'onion',
      'highlight',
    ]);
  });

  it('draws the visible characters only, in their order', () => {
    const capsules = characterLayer(layers())?.capsules ?? [];
    // c1 a une zone de couleur sur le torse : une capsule de plus.
    expect(capsules).toHaveLength(2 * PARTS + 1);
    // Le second personnage est dessiné après (au-dessus) le premier, plus à droite.
    expect(capsules[PARTS + 1]?.a.x).toBeGreaterThan(50);
  });

  it('paints the colour bands of a part right after it, clipped along the part', () => {
    const capsules = characterLayer(layers({ mode: null }))?.capsules ?? [];
    const [torso, band, next] = capsules;
    expect(torso?.color).toEqual(BLACK);
    expect(band?.color).toEqual([0, 0, 1, 1]);
    expect(band).toMatchObject({ a: torso?.a, b: torso?.b, radius: torso?.radius });
    expect(band?.clip).toEqual({ start: torso?.a, end: torso?.b, from: 0, to: 0.5 });
    expect(next?.clip).toBeUndefined();
  });

  it('clips the bands of the head from the neck to the top', () => {
    const hair = testCharacter('c1', {
      appearance: { scale: 1, defaultColor: null, segmentColors: {}, segmentBands: { head: [{ from: 0.55, to: 1, color: '#552200' }] } },
    });
    const capsules = characterLayer(layers({ project: { ...project, characters: [hair] }, mode: null }))?.capsules ?? [];
    const band = capsules.find((c) => c.clip);
    const head = capsules.find((c) => c.a.x === c.b.x && c.a.y === c.b.y && !c.clip);
    expect(band?.clip?.from).toBe(0.55);
    // Du cou (bas de la tête) au sommet : l'axe passe par le centre de la tête et mesure son diamètre.
    expect(band?.clip?.start.y).toBeCloseTo((head?.a.y ?? 0) - (head?.radius ?? 0));
    expect(band?.clip?.end.y).toBeCloseTo((head?.a.y ?? 0) + (head?.radius ?? 0));
  });

  it('dims the colour bands with their character, and leaves them out of the onion skin', () => {
    const dimmed = characterLayer(layers({ mode: 'environment' }))?.capsules.find((c) => c.clip);
    expect(dimmed?.color[3]).toBeCloseTo(DIMMED_OPACITY);
    const onion = capsuleLayers(layers({ onion: frame })).find((l) => l.role === 'onion');
    expect(onion?.capsules.some((c) => c.clip)).toBe(false);
  });

  it('paints each part in its own colour, the others in the automatic colour', () => {
    const capsules = characterLayer(layers({ mode: null }))?.capsules ?? [];
    const head = capsules.find((c) => c.a.x === c.b.x && c.a.y === c.b.y);
    expect(head?.color).toEqual([1, 0, 0, 1]);
    expect(capsules[0]?.color).toEqual(BLACK);
  });

  it('dims the décor in the Personnages mode, and the characters in the Environnement mode', () => {
    const inCharacters = layers({ mode: 'characters' });
    expect(inCharacters[0]).toEqual({ kind: 'drawing', opacity: DIMMED_OPACITY });
    expect(characterLayer(inCharacters)?.capsules[0]?.color[3]).toBe(1);

    const inEnvironment = layers({ mode: 'environment' });
    expect(inEnvironment[0]).toEqual({ kind: 'drawing', opacity: 1 });
    expect(characterLayer(inEnvironment)?.capsules[0]?.color[3]).toBe(DIMMED_OPACITY);
    const shapes = inEnvironment[1];
    expect(shapes?.kind === 'shapes' && shapes.shapes[0]?.fill).toEqual([0, 1, 0, 1]);
  });

  it('draws no editing aid and dims nothing for the final rendering', () => {
    const final = layers({ mode: null, selection: { ...createSession(), selectedCharacterId: 'c1', selectedShapeId: 's1' } });
    expect(capsuleLayers(final).map((l) => l.role)).toEqual(['onion', 'characters']);
    expect(final[0]).toEqual({ kind: 'drawing', opacity: 1 });
  });

  it('shows the handles and a selection frame for the selected character only', () => {
    const selected = layers({ selection: { ...createSession(), selectedCharacterId: 'c2', selectedNodeId: 'torso' } });
    const handles = capsuleLayers(selected).find((l) => l.role === 'handles')?.capsules ?? [];
    expect(handles.length).toBeGreaterThan(0);
    expect(handles.every((c) => c.a.x > 50)).toBe(true);
    expect(capsuleLayers(selected).find((l) => l.role === 'frame')?.capsules).toHaveLength(4);
  });

  it('outlines the selected parts in the accent colour', () => {
    const selected = layers({ selection: { ...createSession(), selectedCharacterId: 'c1', selectedParts: ['head', 'torso'] } });
    const highlight = capsuleLayers(selected).find((l) => l.role === 'highlight')?.capsules ?? [];
    expect(highlight).toHaveLength(2);
    expect(highlight.every((c) => c.color[2] === 1)).toBe(true);
  });

  it('frames the selected shape with its handles in the Environnement mode', () => {
    const selected = layers({ mode: 'environment', selection: { ...createSession(), selectedShapeId: 's1' } });
    expect(capsuleLayers(selected).find((l) => l.role === 'frame')?.capsules.length).toBeGreaterThan(4);
  });

  it('shows the onion skin of every visible character', () => {
    const onion = capsuleLayers(layers({ onion: frame })).find((l) => l.role === 'onion')?.capsules ?? [];
    expect(onion).toHaveLength(2 * PARTS);
    expect(onion[0]?.color[3]).toBeLessThan(0.5);
  });
});
