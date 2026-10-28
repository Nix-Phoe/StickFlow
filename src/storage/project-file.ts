// Format de fichier d'un Projet : JSON versionné. Seules les images clés sont enregistrées
// (ADR 0002). À la lecture, un fichier ancien est d'abord migré (migrate.ts), puis sa structure
// est vérifiée ; les bornes des réglages sont ensuite appliquées par le module Projet (`createHistory`).

import {
  SHAPE_KINDS,
  SMOOTHING_CURVES,
  type Character,
  type Environment,
  type FramePose,
  type Keyframe,
  type LoopSettings,
  type Project,
  type Shape,
  type ShapeKind,
  type SkeletonNode,
  type SmoothingCurve,
  type SmoothingSettings,
  type Vec2,
} from '../core/types';
import { normalizeHex } from '../model/color';
import { SkeletonError, sortSkeleton } from '../model/skeleton';
import { migrateProject } from './migrate';

export const PROJECT_FILE_FORMAT = 'stickflow-project';
export const PROJECT_FILE_VERSION = 2;

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  version: number;
  project: Project;
}

export class ProjectFileError extends Error {
  override name = 'ProjectFileError';
}

export function toProjectFile(project: Project): ProjectFile {
  const { name, fps, characters, keyframes, environment, recentColors, ai } = project;
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    project: { name, fps, characters, keyframes, environment, recentColors, ai },
  };
}

/** Relit un fichier de Projet (objet JSON déjà parsé). Lève `ProjectFileError` s'il est invalide. */
export function fromProjectFile(data: unknown): Project {
  const file = record(data, 'fichier');
  if (file.format !== PROJECT_FILE_FORMAT) throw new ProjectFileError("Ce n'est pas un projet StickFlow");
  const version = number(file.version, 'version');
  if (version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(`Projet enregistré par une version plus récente (version ${version})`);
  }

  const project = record(migrateProject(version, file.project), 'projet');
  const ai = record(project.ai, 'réglages IA');
  return {
    name: string(project.name, 'nom'),
    fps: number(project.fps, 'IPS'),
    characters: array(project.characters, 'personnages').map(readCharacter),
    keyframes: array(project.keyframes, 'images clés').map(readKeyframe),
    environment: readEnvironment(project.environment),
    recentColors: array(project.recentColors, 'couleurs récentes').map((c) => color(c, 'couleur récente')),
    ai: { smoothing: readSmoothing(ai.smoothing), loop: readLoop(ai.loop) },
  };
}

// ---------- Lecture des parties ----------

function readCharacter(value: unknown): Character {
  const character = record(value, 'personnage');
  const skeleton = array(character.skeleton, 'squelette').map(readNode);
  try {
    sortSkeleton(skeleton);
  } catch (error) {
    if (error instanceof SkeletonError) throw new ProjectFileError(`Squelette invalide : ${error.message}`);
    throw error;
  }
  const appearance = record(character.appearance, 'apparence');
  const segmentColors: Record<string, string> = {};
  for (const [id, value] of Object.entries(record(appearance.segmentColors, 'couleurs des parties'))) {
    segmentColors[id] = color(value, `couleur de ${id}`);
  }
  return {
    id: string(character.id, 'id de personnage'),
    name: string(character.name, 'nom de personnage'),
    visible: boolean(character.visible, 'personnage visible'),
    locked: boolean(character.locked, 'personnage verrouillé'),
    skeleton,
    appearance: {
      scale: number(appearance.scale, 'taille'),
      defaultColor: appearance.defaultColor === null ? null : color(appearance.defaultColor, 'couleur du personnage'),
      segmentColors,
    },
  };
}

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
  const poses: Record<string, FramePose> = {};
  for (const [id, pose] of Object.entries(record(keyframe.poses, 'poses'))) poses[id] = readPose(pose);
  return { id: string(keyframe.id, "id d'image clé"), poses };
}

function readPose(value: unknown): FramePose {
  const frame = record(value, 'pose');
  const pose: Record<string, number> = {};
  for (const [id, angle] of Object.entries(record(frame.pose, 'angles'))) pose[id] = number(angle, `angle de ${id}`);
  return { pose, rootPosition: readVec2(frame.rootPosition) };
}

function readVec2(value: unknown): Vec2 {
  const point = record(value, 'position');
  return { x: number(point.x, 'x'), y: number(point.y, 'y') };
}

function readEnvironment(value: unknown): Environment {
  const environment = record(value, 'décor');
  const tiles: Record<string, string> = {};
  for (const [key, tile] of Object.entries(record(record(environment.drawing, 'calque de dessin').tiles, 'tuiles'))) {
    tiles[key] = string(tile, `tuile ${key}`);
  }
  return {
    background: environment.background === null ? null : color(environment.background, 'arrière-plan'),
    shapes: array(environment.shapes, 'formes').map(readShape),
    drawing: { tiles },
  };
}

function readShape(value: unknown): Shape {
  const shape = record(value, 'forme');
  if (!SHAPE_KINDS.includes(shape.kind as ShapeKind)) throw new ProjectFileError(`Forme inconnue : ${String(shape.kind)}`);
  return {
    id: string(shape.id, 'id de forme'),
    kind: shape.kind as ShapeKind,
    x: number(shape.x, 'x de forme'),
    y: number(shape.y, 'y de forme'),
    width: number(shape.width, 'largeur de forme'),
    height: number(shape.height, 'hauteur de forme'),
    rotation: number(shape.rotation, 'rotation de forme'),
    stroke: color(shape.stroke, 'contour de forme'),
    fill: shape.fill === null ? null : color(shape.fill, 'remplissage de forme'),
    strokeWidth: number(shape.strokeWidth, 'épaisseur de forme'),
    opacity: number(shape.opacity, 'opacité de forme'),
  };
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

/** Couleur HEX, normalisée en « #rrggbb ». */
function color(value: unknown, what: string): string {
  const hex = normalizeHex(string(value, what));
  if (!hex) throw new ProjectFileError(`${what} : couleur HEX attendue`);
  return hex;
}
