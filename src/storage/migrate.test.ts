import { describe, expect, it } from 'vitest';

import { migrateProject, MIGRATED_CHARACTER } from './migrate';

const v1Project = {
  name: 'Ancien',
  fps: 12,
  skeleton: [{ id: 'hip', parentId: null, length: 0, angle: 0, shape: 'segment' }],
  keyframes: [
    { id: 'k1', pose: { hip: 1 }, rootPosition: { x: 3, y: 4 } },
    { id: 'k2', pose: {}, rootPosition: { x: 0, y: 0 } },
  ],
  ai: { smoothing: {}, loop: {} },
};

describe('migrateProject', () => {
  it('turns the single skeleton of version 1 into one visible, unlocked character', () => {
    const migrated = migrateProject(1, v1Project) as Record<string, unknown>;
    expect(migrated.characters).toEqual([
      {
        id: MIGRATED_CHARACTER.id,
        name: MIGRATED_CHARACTER.name,
        visible: true,
        locked: false,
        skeleton: v1Project.skeleton,
        appearance: { scale: 1, defaultColor: null, segmentColors: {} },
      },
    ]);
    expect(migrated).not.toHaveProperty('skeleton');
  });

  it('moves each keyframe pose under that character', () => {
    const migrated = migrateProject(1, v1Project) as { keyframes: unknown[] };
    expect(migrated.keyframes[0]).toEqual({
      id: 'k1',
      poses: { [MIGRATED_CHARACTER.id]: { pose: { hip: 1 }, rootPosition: { x: 3, y: 4 } } },
    });
  });

  it('adds an empty environment and no recent colours', () => {
    expect(migrateProject(1, v1Project)).toMatchObject({
      environment: { background: null, shapes: [], drawing: { tiles: {} } },
      recentColors: [],
    });
  });

  it('leaves a version 2 project as it is', () => {
    const v2 = { name: 'x' };
    expect(migrateProject(2, v2)).toBe(v2);
  });

  it('leaves malformed data for the reader to reject', () => {
    expect(migrateProject(1, 'oops')).toBe('oops');
    expect(migrateProject(1, { keyframes: 'oops' })).toMatchObject({ keyframes: 'oops' });
  });
});
