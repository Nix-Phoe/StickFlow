// Format de fichier d'un Projet : JSON versionné. Seules les images clés sont enregistrées
// (ADR 0002). À la lecture, la structure est vérifiée ; les bornes des réglages sont ensuite
// appliquées par le module Projet (`createHistory`).

import {
  SMOOTHING_CURVES,
  type Keyframe,
  type LoopSettings,
  type Project,
  type SkeletonNode,
  type SmoothingCurve,
  type SmoothingSettings,
  type Vec2,
} from '../core/types';
import { SkeletonError, sortSkeleton } from '../model/skeleton';

export const PROJECT_FILE_FORMAT = 'stickflow-project';
export const PROJECT_FILE_VERSION = 1;

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  version: number;
  project: Project;
}

export class ProjectFileError extends Error {
  override name = 'ProjectFileError';
}

export function toProjectFile(project: Project): ProjectFile {
  const { name, fps, skeleton, keyframes, ai } = project;
  return { format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION, project: { name, fps, skeleton, keyframes, ai } };
}

/** Relit un fichier de Projet (objet JSON déjà parsé). Lève `ProjectFileError` s'il est invalide. */
export function fromProjectFile(data: unknown): Project {
  const file = record(data, 'fichier');
  if (file.format !== PROJECT_FILE_FORMAT) throw new ProjectFileError("Ce n'est pas un projet StickFlow");
  const version = number(file.version, 'version');
  if (version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(`Projet enregistré par une version plus récente (version ${version})`);
  }

  const project = record(file.project, 'projet');
  const skeleton = array(project.skeleton, 'squelette').map(readNode);
  try {
    sortSkeleton(skeleton);
  } catch (error) {
    if (error instanceof SkeletonError) throw new ProjectFileError(`Squelette invalide : ${error.message}`);
    throw error;
  }

  const ai = record(project.ai, 'réglages IA');
  return {
    name: string(project.name, 'nom'),
    fps: number(project.fps, 'IPS'),
    skeleton,
    keyframes: array(project.keyframes, 'images clés').map(readKeyframe),
    ai: { smoothing: readSmoothing(ai.smoothing), loop: readLoop(ai.loop) },
  };
}

// ---------- Lecture des parties ----------

function readNode(value: unknown): SkeletonNode {
  const node = record(value, 'nœud');
  const shape = node.shape;
  if (shape !== 'segment' && shape !== 'circle') throw new ProjectFileError(`Forme de nœud inconnue : ${String(shape)}`);
  return {
    id: string(node.id, 'id de nœud'),
    parentId: node.parentId === null ? null : string(node.parentId, 'parent de nœud'),
    length: number(node.length, 'longueur de nœud'),
    angle: number(node.angle, 'angle de nœud'),
    shape,
  };
}

function readKeyframe(value: unknown): Keyframe {
  const keyframe = record(value, 'image clé');
  const pose: Record<string, number> = {};
  for (const [id, angle] of Object.entries(record(keyframe.pose, 'pose'))) pose[id] = number(angle, `angle de ${id}`);
  return { id: string(keyframe.id, "id d'image clé"), pose, rootPosition: readVec2(keyframe.rootPosition) };
}

function readVec2(value: unknown): Vec2 {
  const point = record(value, 'position');
  return { x: number(point.x, 'x'), y: number(point.y, 'y') };
}

function readSmoothing(value: unknown): SmoothingSettings {
  const smoothing = record(value, 'Fluidité');
  if (!SMOOTHING_CURVES.includes(smoothing.curve as SmoothingCurve)) {
    throw new ProjectFileError(`Courbe inconnue : ${String(smoothing.curve)}`);
  }
  return {
    enabled: boolean(smoothing.enabled, 'Fluidité activée'),
    intensity: number(smoothing.intensity, 'intensité'),
    curve: smoothing.curve as SmoothingCurve,
  };
}

function readLoop(value: unknown): LoopSettings {
  const loop = record(value, 'Répétition');
  return {
    enabled: boolean(loop.enabled, 'Répétition activée'),
    repeatCount: number(loop.repeatCount, 'nombre de répétitions'),
    infinite: boolean(loop.infinite, 'répétition infinie'),
    transitionFrames: number(loop.transitionFrames, 'transition'),
  };
}

// ---------- Vérifications élémentaires ----------

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ProjectFileError(`${what} manquant ou invalide`);
  return value as Record<string, unknown>;
}

function array(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new ProjectFileError(`${what} : liste attendue`);
  return value;
}

function string(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new ProjectFileError(`${what} : texte attendu`);
  return value;
}

function number(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ProjectFileError(`${what} : nombre attendu`);
  return value;
}

function boolean(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw new ProjectFileError(`${what} : vrai / faux attendu`);
  return value;
}
