import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT, FORMAT_PRESETS, presetFormat } from '../core/formats';
import type { Background, Project } from '../core/types';
import { imageBackground } from '../model/background';
import { testCharacter, testFrame, testProject, testShape } from '../test/fixtures';
import { fromProjectFile, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION, ProjectFileError, toProjectFile } from './project-file';

const project: Project = testProject({
  name: 'Saut',
  fps: 24,
  format: presetFormat('vertical'),
  characters: [
    testCharacter('c1', { name: 'Léa', appearance: {
        scale: 1.5,
        defaultColor: '#ff0000',
        segmentColors: { head: '#00ff00' },
        segmentBands: { upperArmL: [{ from: 0, to: 0.5, color: '#990000' }] },
      },
    }),
    testCharacter('c2', { visible: false, locked: true }),
  ],
  keyframes: [
    testFrame('k1', {}, { x: 0, y: 0 }, { c2: { pose: {}, rootPosition: { x: 80, y: 0 } } }),
    testFrame('k2', { torso: 1.2 }, { x: 10, y: -5 }, { c2: { pose: { head: 0.1 }, rootPosition: { x: 90, y: 0 } } }),
  ],
  environment: {
    background: { type: 'color', color: '#ffeedd' },
    shapes: [testShape('s1', { kind: 'triangle', fill: '#0000ff', rotation: 0.5 })],
    drawing: { tiles: { '0,1': 'data:image/png;base64,AAAA' } },
  },
  recentColors: ['#ff0000', '#00ff00'],
  ai: {
    smoothing: { enabled: true, intensity: 4, curve: 'ease-in-out' },
    loop: { enabled: true, repeatCount: 2, infinite: false, transitionFrames: 3 },
  },
});

/** Fichier tel qu'il serait relu depuis le disque ou IndexedDB. */
const reread = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
type Editable = { project: Record<string, unknown> & { keyframes: unknown[]; characters: Array<Record<string, unknown>> } };
const editable = (): Editable => reread(toProjectFile(project)) as Editable;

describe('toProjectFile', () => {
  it('tags the file with its format and version 4', () => {
    const file = toProjectFile(project);
    expect(file.format).toBe(PROJECT_FILE_FORMAT);
    expect(file.version).toBe(4);
    expect(PROJECT_FILE_VERSION).toBe(4);
  });

  it('only stores keyframes, never generated frames', () => {
    expect(Object.keys(toProjectFile(project).project).sort()).toEqual([
      'ai',
      'characters',
      'environment',
      'format',
      'fps',
      'keyframes',
      'name',
      'recentColors',
    ]);
  });
});

describe('fromProjectFile', () => {
  it('reads back exactly what was written', () => {
    expect(fromProjectFile(reread(toProjectFile(project)))).toEqual(project);
  });

  it('rejects something that is not a StickFlow project', () => {
    expect(() => fromProjectFile({ hello: 'world' })).toThrow(ProjectFileError);
    expect(() => fromProjectFile(null)).toThrow(ProjectFileError);
  });

  it('rejects a newer file version', () => {
    const file = { ...toProjectFile(project), version: PROJECT_FILE_VERSION + 1 };
    expect(() => fromProjectFile(reread(file))).toThrow(/version/);
  });

  it('rejects a damaged keyframe', () => {
    const file = editable();
    file.project.keyframes[1] = { id: 'k2', poses: { c1: { pose: { torso: 'beaucoup' }, rootPosition: { x: 0, y: 0 } } } };
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('rejects an invalid skeleton', () => {
    const file = editable();
    (file.project.characters[0]?.skeleton as Array<{ parentId: string | null }>).forEach((node) => (node.parentId = null));
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('rejects an unknown curve, shape kind or invalid colour', () => {
    const curve = editable() as unknown as { project: { ai: { smoothing: { curve: string } } } };
    curve.project.ai.smoothing.curve = 'zigzag';
    expect(() => fromProjectFile(curve)).toThrow(ProjectFileError);

    const shape = editable() as unknown as { project: { environment: { shapes: Array<{ kind: string }> } } };
    (shape.project.environment.shapes[0] as { kind: string }).kind = 'star';
    expect(() => fromProjectFile(shape)).toThrow(ProjectFileError);

    const color = editable();
    (color.project.characters[0] as { appearance: { defaultColor: string } }).appearance.defaultColor = 'rouge';
    expect(() => fromProjectFile(color)).toThrow(ProjectFileError);
  });

  it('rejects a damaged colour band', () => {
    const file = editable();
    const appearance = (file.project.characters[0] as { appearance: { segmentBands: Record<string, unknown> } }).appearance;
    appearance.segmentBands = { upperArmL: [{ from: 'début', to: 0.5, color: '#990000' }] };
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
    appearance.segmentBands = { upperArmL: [{ from: 0, to: 0.5, color: 'rouge' }] };
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('opens a version 2 file saved before partial colouring (no bands)', () => {
    const file = editable();
    delete (file.project.characters[0] as { appearance: { segmentBands?: unknown } }).appearance.segmentBands;
    expect(fromProjectFile(file).characters[0]?.appearance.segmentBands).toEqual({});
  });

  it('opens a version 2 file (before video formats) in YouTube 16:9', () => {
    const file = editable() as unknown as { version: number; project: Record<string, unknown> };
    file.version = 2;
    delete file.project.format;
    expect(fromProjectFile(file).format).toEqual(DEFAULT_FORMAT);
  });

  it('reads back every kind of background (v2.1)', () => {
    const backgrounds: Background[] = [
      { type: 'gradient', from: '#ff0000', to: '#0000ff', angle: 135 },
      { type: 'builtin', id: 'starry-night' },
      {
        ...imageBackground('a1', { author: 'Ana', url: 'https://www.pexels.com/photo/1', provider: 'Pexels' }),
        fit: 'tile',
        focus: { x: 0.2, y: 0.7 },
        zoom: 1.5,
        blur: 3,
        brightness: 0.8,
        opacity: 0.9,
        tint: { color: '#000000', amount: 0.3 },
      },
    ];
    for (const background of backgrounds) {
      const saved = { ...project, environment: { ...project.environment, background } };
      expect(fromProjectFile(reread(toProjectFile(saved))).environment.background).toEqual(background);
    }
  });

  it('rejects a damaged background', () => {
    for (const background of [{ type: 'image' }, { type: 'builtin', id: 7 }, { type: 'gradient', from: '#fff', to: 'x', angle: 0 }, '#ffffff']) {
      const file = editable() as unknown as { project: { environment: Record<string, unknown> } };
      file.project.environment.background = background;
      expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
    }
  });

  it('opens a version 3 file whose background was a plain colour', () => {
    const file = editable() as unknown as { version: number; project: { environment: Record<string, unknown> } };
    file.version = 3;
    file.project.environment.background = '#FFEEDD';
    expect(fromProjectFile(file).environment.background).toEqual({ type: 'color', color: '#ffeedd' });
  });

  it('reads back every preset with its own format', () => {
    for (const { id } of FORMAT_PRESETS) {
      const saved = { ...project, format: presetFormat(id) };
      expect(fromProjectFile(reread(toProjectFile(saved))).format).toEqual(saved.format);
    }
  });

  it('reads back a custom format and rejects a damaged one', () => {
    const custom = { ...project, format: { preset: 'custom' as const, width: 1000, height: 700 } };
    expect(fromProjectFile(reread(toProjectFile(custom))).format).toEqual(custom.format);
    const file = editable();
    file.project.format = { preset: 'custom', width: 'large', height: 700 };
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('keeps out-of-range numbers for the Projet module to clamp', () => {
    const file = reread(toProjectFile({ ...project, fps: 500 }));
    expect(fromProjectFile(file).fps).toBe(500);
  });

  it('opens a version 1 project (single skeleton) as a project with one character', () => {
    const v1 = {
      format: PROJECT_FILE_FORMAT,
      version: 1,
      project: {
        name: 'Ancien',
        fps: 12,
        skeleton: project.characters[0]?.skeleton,
        keyframes: [{ id: 'k1', pose: { torso: 1 }, rootPosition: { x: 3, y: 4 } }],
        ai: project.ai,
      },
    };
    const opened = fromProjectFile(reread(v1));
    expect(opened.name).toBe('Ancien');
    expect(opened.characters).toHaveLength(1);
    const [character] = opened.characters;
    expect(opened.keyframes[0]?.poses[character?.id ?? '']).toEqual({ pose: { torso: 1 }, rootPosition: { x: 3, y: 4 } });
    expect(opened.environment).toEqual({ background: null, shapes: [], drawing: { tiles: {} } });
    expect(opened.recentColors).toEqual([]);
  });
});
