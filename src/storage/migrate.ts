// Migration des fichiers de Projet vers la version actuelle (3), avant validation.
// Ne valide rien : des données abîmées sont laissées telles quelles pour que la lecture les refuse.

import { DEFAULT_FORMAT } from '../core/formats';

/** Personnage créé à partir du squelette unique d'un projet de version 1. */
export const MIGRATED_CHARACTER = { id: 'character-1', name: 'Personnage 1' } as const;

/** Convertit le contenu `project` d'un fichier de `version` donnée au format de la version 3. */
export function migrateProject(version: number, project: unknown): unknown {
  if (version >= 3 || !isRecord(project)) return project;
  return fromVersion2(version < 2 ? fromVersion1(project) : project);
}

/** Version 2 : pas de format de vidéo ; l'export était en 16:9, comme YouTube. */
function fromVersion2(project: Record<string, unknown>): Record<string, unknown> {
  return { ...project, format: DEFAULT_FORMAT };
}

/** Version 1 : un seul squelette, une pose par image clé, pas de décor. */
function fromVersion1({ skeleton, keyframes, ...rest }: Record<string, unknown>): Record<string, unknown> {
  return {
    ...rest,
    characters: [
      {
        ...MIGRATED_CHARACTER,
        visible: true,
        locked: false,
        skeleton,
        appearance: { scale: 1, defaultColor: null, segmentColors: {}, segmentBands: {} },
      },
    ],
    keyframes: Array.isArray(keyframes)
      ? keyframes.map((keyframe: unknown) => {
          if (!isRecord(keyframe)) return keyframe;
          const { pose, rootPosition, ...other } = keyframe;
          return { ...other, poses: { [MIGRATED_CHARACTER.id]: { pose, rootPosition } } };
        })
      : keyframes,
    environment: { background: null, shapes: [], drawing: { tiles: {} } },
    recentColors: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
