// Données de test partagées : Projet minimal avec un personnage « c1 » et deux images clés.

import { DEFAULT_FORMAT } from '../core/formats';
import type { Character, Keyframe, Project, Shape, Vec2 } from '../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';

export const ORIGIN: Vec2 = { x: 0, y: 0 };
export const testSkeleton = sortSkeleton(createDefaultSkeleton());

export const testCharacter = (id: string, overrides: Partial<Character> = {}): Character => ({
  id,
  name: id,
  visible: true,
  locked: false,
  skeleton: testSkeleton,
  appearance: { scale: 1, defaultColor: null, segmentColors: {}, segmentBands: {} },
  ...overrides,
});

/** Image clé posant le personnage « c1 » (et d'autres personnages via `others`). */
export const testFrame = (
  id: string,
  pose: Record<string, number> = {},
  rootPosition: Vec2 = ORIGIN,
  others: Keyframe['poses'] = {},
): Keyframe => ({ id, poses: { c1: { pose, rootPosition }, ...others } });

export const testShape = (id: string, overrides: Partial<Shape> = {}): Shape => ({
  id,
  kind: 'rectangle',
  x: 0,
  y: 0,
  width: 40,
  height: 20,
  rotation: 0,
  stroke: '#000000',
  fill: null,
  strokeWidth: 4,
  opacity: 1,
  ...overrides,
});

export function testProject(overrides: Partial<Project> = {}): Project {
  return {
    name: 'Test',
    fps: 12,
    format: DEFAULT_FORMAT,
    characters: [testCharacter('c1')],
    keyframes: [testFrame('f1'), testFrame('f2')],
    environment: { background: null, shapes: [], drawing: { tiles: {} } },
    recentColors: [],
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
      loop: { enabled: false, repeatCount: 3, infinite: false, transitionFrames: 4 },
    },
    ...overrides,
  };
}
