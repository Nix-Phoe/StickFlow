import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT, presetFormat } from '../core/formats';
import { testProject } from '../test/fixtures';
import { createProject, uniqueName } from './new-project';

describe('createProject', () => {
  it('makes a project with one stickman in its rest pose, in the chosen format and fps', () => {
    const project = createProject({ name: 'Saut', format: presetFormat('vertical'), fps: 24, characterName: 'Personnage 1' });
    expect(project).toMatchObject({ name: 'Saut', fps: 24, format: presetFormat('vertical') });
    expect(project.characters).toHaveLength(1);
    expect(project.characters[0]?.name).toBe('Personnage 1');
    expect(project.keyframes).toHaveLength(1);
    expect(project.environment).toEqual({ background: null, shapes: [], drawing: { tiles: {} } });
  });

  it('copies a template, which is never changed, with the chosen name, format and fps', () => {
    const template = testProject({ name: 'Marche', fps: 8 });
    const frozen = structuredClone(template);
    const project = createProject({ name: 'Ma marche', format: presetFormat('square'), fps: 10, characterName: 'P', template });
    expect(project).toMatchObject({ name: 'Ma marche', fps: 10, format: presetFormat('square') });
    expect(project.keyframes).toEqual(template.keyframes);
    expect(project.keyframes).not.toBe(template.keyframes);
    expect(template).toEqual(frozen);
  });

  it('keeps the fps of the template when none is chosen, and clamps a chosen one', () => {
    const template = testProject({ fps: 8 });
    expect(createProject({ name: 'x', format: DEFAULT_FORMAT, characterName: 'P', template }).fps).toBe(8);
    expect(createProject({ name: 'x', format: DEFAULT_FORMAT, fps: 999, characterName: 'P' }).fps).toBe(60);
  });
});

describe('uniqueName', () => {
  it('numbers a name already taken', () => {
    expect(uniqueName('Projet sans titre', [])).toBe('Projet sans titre');
    expect(uniqueName('Projet sans titre', ['Projet sans titre'])).toBe('Projet sans titre 2');
    expect(uniqueName('Projet sans titre', ['Projet sans titre', 'Projet sans titre 2'])).toBe('Projet sans titre 3');
  });

  it('falls back to the default when the name is empty', () => {
    expect(uniqueName('   ', [], 'Projet sans titre')).toBe('Projet sans titre');
  });
});
