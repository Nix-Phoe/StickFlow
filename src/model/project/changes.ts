// Changements nommés du Projet et invariants. Fonctions pures : un changement sans effet
// renvoie le même objet Projet, ce qui permet de ne pas créer d'étape d'annulation.

import { createId } from '../../core/id';
import {
  clamp,
  LIMITS,
  type Frame,
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
  /** Insère `frameId` juste après `afterFrameId`, en copiant sa pose. */
  | { type: 'insertFrame'; afterFrameId: string; frameId: string }
  | { type: 'deleteFrame'; frameId: string }
  /** Pose une frame ; une frame générée devient image clé. */
  | { type: 'poseFrame'; frameId: string; pose: Record<string, number>; rootPosition: Vec2 };

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
    case 'poseFrame':
      return `${change.type}:${change.frameId}`;
    case 'insertFrame':
    case 'deleteFrame':
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
    case 'insertFrame': {
      const index = project.frames.findIndex((f) => f.id === change.afterFrameId);
      const source = project.frames[index];
      if (!source || project.frames.some((f) => f.id === change.frameId)) return project;
      const inserted: Frame = {
        id: change.frameId,
        pose: { ...source.pose },
        rootPosition: { ...source.rootPosition },
        generated: false,
      };
      return { ...project, frames: project.frames.toSpliced(index + 1, 0, inserted) };
    }
    case 'deleteFrame': {
      const index = project.frames.findIndex((f) => f.id === change.frameId);
      // Un Projet garde toujours au moins une frame.
      if (index === -1 || project.frames.length <= 1) return project;
      return { ...project, frames: project.frames.toSpliced(index, 1) };
    }
    case 'poseFrame': {
      const index = project.frames.findIndex((f) => f.id === change.frameId);
      if (index === -1) return project;
      const posed: Frame = { id: change.frameId, pose: change.pose, rootPosition: change.rootPosition, generated: false };
      return { ...project, frames: project.frames.with(index, posed) };
    }
  }
}

/** Ramène toutes les valeurs dans leurs bornes et garantit au moins une frame. */
export function normalizeProject(project: Project): Project {
  return {
    ...project,
    fps: toLimit(project.fps, LIMITS.fps, LIMITS.fps.min),
    frames: project.frames.length > 0 ? project.frames : [createRestFrame()],
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

function createRestFrame(): Frame {
  return { id: createId(), pose: {}, rootPosition: { x: 0, y: 0 }, generated: false };
}
