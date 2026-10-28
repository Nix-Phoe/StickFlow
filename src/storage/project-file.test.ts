import { describe, expect, it } from 'vitest';

import type { Project } from '../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { fromProjectFile, PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION, ProjectFileError, toProjectFile } from './project-file';

const project: Project = {
  name: 'Saut',
  fps: 24,
  skeleton: sortSkeleton(createDefaultSkeleton()),
  keyframes: [
    { id: 'k1', pose: {}, rootPosition: { x: 0, y: 0 } },
    { id: 'k2', pose: { torso: 1.2 }, rootPosition: { x: 10, y: -5 } },
  ],
  ai: {
    smoothing: { enabled: true, intensity: 4, curve: 'ease-in-out' },
    loop: { enabled: true, repeatCount: 2, infinite: false, transitionFrames: 3 },
  },
};

/** Fichier tel qu'il serait relu depuis le disque ou IndexedDB. */
const reread = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('toProjectFile', () => {
  it('tags the file with its format and version', () => {
    const file = toProjectFile(project);
    expect(file.format).toBe(PROJECT_FILE_FORMAT);
    expect(file.version).toBe(PROJECT_FILE_VERSION);
  });

  it('only stores keyframes, never generated frames', () => {
    expect(Object.keys(toProjectFile(project).project).sort()).toEqual(['ai', 'fps', 'keyframes', 'name', 'skeleton']);
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
    const file = reread(toProjectFile(project)) as { project: { keyframes: unknown[] } };
    file.project.keyframes[1] = { id: 'k2', pose: { torso: 'beaucoup' }, rootPosition: { x: 0, y: 0 } };
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('rejects an invalid skeleton', () => {
    const file = reread(toProjectFile(project)) as { project: { skeleton: Array<{ parentId: string | null }> } };
    file.project.skeleton.forEach((node) => (node.parentId = null));
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('rejects an unknown curve', () => {
    const file = reread(toProjectFile(project)) as { project: { ai: { smoothing: { curve: string } } } };
    file.project.ai.smoothing.curve = 'zigzag';
    expect(() => fromProjectFile(file)).toThrow(ProjectFileError);
  });

  it('keeps out-of-range numbers for the Projet module to clamp', () => {
    const file = reread(toProjectFile({ ...project, fps: 500 }));
    expect(fromProjectFile(file).fps).toBe(500);
  });
});
