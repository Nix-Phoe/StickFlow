// Changements nommés du Projet et invariants. Fonctions pures : un changement sans effet
// renvoie le même objet Projet, ce qui permet de ne pas créer d'étape d'annulation.

import { createId } from '../../core/id';
import {
  clamp,
  LIMITS,
  type Keyframe,
  type LoopSettings,
  type Project,
  type SmoothingSettings,
  type Vec2,
} from '../../core/types';

/** Liste fermée des modifications possibles d'un Projet. */
export type ProjectChange =
  | { type: 'setFps'; fps: number }
  | { type: 'updateSmoothing'; changes: Partial<SmoothingSettings> }
  | { type: 'updateLoop'; changes: Partial<LoopSettings> }
  /**
   * Insère l'image clé `keyframeId` juste après `afterKeyframeId`, avec la pose donnée
   * (conversion d'une frame générée) ou, sans pose, une copie de la précédente.
   */
  | {
      type: 'insertKeyframe';
      afterKeyframeId: string;
      keyframeId: string;
      pose?: Record<string, number>;
      rootPosition?: Vec2;
    }
  | { type: 'deleteKeyframe'; keyframeId: string }
  | { type: 'poseKeyframe'; keyframeId: string; pose: Record<string, number>; rootPosition: Vec2 };

/** Réglages qui basculent : chaque bascule est une étape d'annulation à part. */
const TOGGLES: ReadonlySet<string> = new Set(['enabled', 'curve', 'infinite']);

/**
 * Clé de regroupement : deux changements consécutifs de même clé, assez rapprochés,
 * forment une seule étape d'annulation. `null` = jamais regroupé.
 */
export function coalesceKey(change: ProjectChange): string | null {
  switch (change.type) {
    case 'setFps':
      return change.type;
    case 'updateSmoothing':
    case 'updateLoop': {
      const fields = Object.keys(change.changes).sort();
      return fields.some((field) => TOGGLES.has(field)) ? null : `${change.type}:${fields.join(',')}`;
    }
    case 'poseKeyframe':
      return `poseKeyframe:${change.keyframeId}`;
    // Insérer avec une pose, c'est déjà poser : les poses qui suivent rejoignent la même étape.
    case 'insertKeyframe':
      return change.pose ? `poseKeyframe:${change.keyframeId}` : null;
    case 'deleteKeyframe':
      return null;
  }
}

export function applyToProject(project: Project, change: ProjectChange): Project {
  switch (change.type) {
    case 'setFps': {
      const fps = toLimit(change.fps, LIMITS.fps, project.fps);
      return fps === project.fps ? project : { ...project, fps };
    }
    case 'updateSmoothing': {
      const smoothing = normalizeSmoothing({ ...project.ai.smoothing, ...change.changes });
      return sameFields(smoothing, project.ai.smoothing)
        ? project
        : { ...project, ai: { ...project.ai, smoothing } };
    }
    case 'updateLoop': {
      const loop = normalizeLoop({ ...project.ai.loop, ...change.changes });
      return sameFields(loop, project.ai.loop) ? project : { ...project, ai: { ...project.ai, loop } };
    }
    case 'insertKeyframe': {
      const index = project.keyframes.findIndex((k) => k.id === change.afterKeyframeId);
      const source = project.keyframes[index];
      if (!source || project.keyframes.some((k) => k.id === change.keyframeId)) return project;
      const inserted: Keyframe = {
        id: change.keyframeId,
        pose: { ...(change.pose ?? source.pose) },
        rootPosition: { ...(change.rootPosition ?? source.rootPosition) },
      };
      return { ...project, keyframes: project.keyframes.toSpliced(index + 1, 0, inserted) };
    }
    case 'deleteKeyframe': {
      const index = project.keyframes.findIndex((k) => k.id === change.keyframeId);
      // Un Projet garde toujours au moins une image clé.
      if (index === -1 || project.keyframes.length <= 1) return project;
      return { ...project, keyframes: project.keyframes.toSpliced(index, 1) };
    }
    case 'poseKeyframe': {
      const index = project.keyframes.findIndex((k) => k.id === change.keyframeId);
      if (index === -1) return project;
      const posed: Keyframe = { id: change.keyframeId, pose: change.pose, rootPosition: change.rootPosition };
      return { ...project, keyframes: project.keyframes.with(index, posed) };
    }
  }
}

/** Ramène toutes les valeurs dans leurs bornes et garantit au moins une image clé. */
export function normalizeProject(project: Project): Project {
  return {
    ...project,
    fps: toLimit(project.fps, LIMITS.fps, LIMITS.fps.min),
    keyframes: project.keyframes.length > 0 ? project.keyframes : [createRestKeyframe()],
    ai: {
      smoothing: normalizeSmoothing(project.ai.smoothing),
      loop: normalizeLoop(project.ai.loop),
    },
  };
}

function normalizeSmoothing(settings: SmoothingSettings): SmoothingSettings {
  return {
    ...settings,
    intensity: toLimit(settings.intensity, LIMITS.smoothingIntensity, LIMITS.smoothingIntensity.min),
  };
}

function normalizeLoop(settings: LoopSettings): LoopSettings {
  return {
    ...settings,
    repeatCount: toLimit(settings.repeatCount, LIMITS.loopRepeat, LIMITS.loopRepeat.min),
    transitionFrames: toLimit(settings.transitionFrames, LIMITS.loopTransitionFrames, LIMITS.loopTransitionFrames.min),
  };
}

/** Entier ramené dans les bornes ; `fallback` si la valeur n'est pas un nombre. */
function toLimit(value: number, limit: { min: number; max: number }, fallback: number): number {
  return Number.isFinite(value) ? clamp(Math.round(value), limit.min, limit.max) : fallback;
}

function sameFields<T extends object>(a: T, b: T): boolean {
  return (Object.keys(a) as Array<keyof T>).every((key) => Object.is(a[key], b[key]));
}

function createRestKeyframe(): Keyframe {
  return { id: createId(), pose: {}, rootPosition: { x: 0, y: 0 } };
}
