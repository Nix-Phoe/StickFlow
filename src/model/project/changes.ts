// Changements nommés du Projet et invariants. Fonctions pures : un changement sans effet
// renvoie le même objet Projet, ce qui permet de ne pas créer d'étape d'annulation.

import { createId } from '../../core/id';
import {
  clamp,
  LIMITS,
  type Character,
  type FramePose,
  type LoopSettings,
  type Project,
  type Shape,
  type SmoothingSettings,
} from '../../core/types';
import { createCharacter, DUPLICATE_OFFSET, placeNewCharacter } from '../character';
import { normalizeHex } from '../color';

/** Liste fermée des modifications possibles d'un Projet. */
export type ProjectChange =
  | { type: 'rename'; name: string }
  | { type: 'setFps'; fps: number }
  | { type: 'updateSmoothing'; changes: Partial<SmoothingSettings> }
  | { type: 'updateLoop'; changes: Partial<LoopSettings> }
  /**
   * Insère l'image clé `keyframeId` juste après `afterKeyframeId`, avec les poses données
   * (conversion d'une frame générée) ; les personnages sans pose donnée copient la précédente.
   */
  | { type: 'insertKeyframe'; afterKeyframeId: string; keyframeId: string; poses?: Record<string, FramePose> }
  | { type: 'deleteKeyframe'; keyframeId: string }
  /** Change la pose des personnages donnés dans une image clé ; les autres ne bougent pas. */
  | { type: 'poseKeyframe'; keyframeId: string; poses: Record<string, FramePose> }
  // ---------- Personnages ----------
  /** Ajoute un stickman de base au-dessus des autres, dans sa pose de repos, à une place libre. */
  | { type: 'addCharacter'; characterId: string; name: string }
  /** Copie un personnage juste au-dessus de lui, avec son apparence et ses poses, légèrement décalé. */
  | { type: 'duplicateCharacter'; sourceId: string; characterId: string; name: string }
  | { type: 'removeCharacter'; characterId: string }
  | { type: 'renameCharacter'; characterId: string; name: string }
  /** Monte (1) ou descend (-1) un personnage dans l'ordre d'affichage. */
  | { type: 'moveCharacter'; characterId: string; direction: 1 | -1 }
  | { type: 'setCharacterVisibility'; characterId: string; visible: boolean }
  | { type: 'setCharacterLock'; characterId: string; locked: boolean }
  /** Colore les parties données, ou tout le personnage sans partie (`null` = couleur automatique). */
  | { type: 'setCharacterColor'; characterId: string; parts: readonly string[]; color: string | null }
  | { type: 'setCharacterScale'; characterId: string; scale: number }
  // ---------- Décor ----------
  /** `gesture` : jeton d'un geste sur la scène, pour qu'un geste forme une étape d'annulation, et pas plus. */
  | { type: 'addShape'; shape: Shape; gesture?: string }
  | { type: 'updateShape'; shapeId: string; changes: Partial<Omit<Shape, 'id'>>; gesture?: string }
  | { type: 'removeShape'; shapeId: string }
  /** Remplace les tuiles peintes par un trait ; `null` = tuile redevenue transparente. */
  | { type: 'paintDrawing'; tiles: Record<string, string | null> };

/** Réglages qui basculent : chaque bascule est une étape d'annulation à part. */
const TOGGLES: ReadonlySet<string> = new Set(['enabled', 'curve', 'infinite']);

/**
 * Clé de regroupement : deux changements consécutifs de même clé, assez rapprochés,
 * forment une seule étape d'annulation. `null` = jamais regroupé.
 */
export function coalesceKey(change: ProjectChange): string | null {
  switch (change.type) {
    case 'rename':
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
      return change.poses ? `poseKeyframe:${change.keyframeId}` : null;
    case 'renameCharacter':
    case 'setCharacterScale':
      return `${change.type}:${change.characterId}`;
    case 'setCharacterColor':
      return `setCharacterColor:${change.characterId}:${[...change.parts].sort().join(',')}`;
    // Une forme tracée par glisser (créée, puis agrandie) ou déplacée forme une seule étape.
    case 'addShape':
      return `shape:${change.shape.id}:${change.gesture ?? ''}`;
    case 'updateShape':
      return `shape:${change.shapeId}:${change.gesture ?? ''}`;
    case 'deleteKeyframe':
    case 'addCharacter':
    case 'duplicateCharacter':
    case 'removeCharacter':
    case 'moveCharacter':
    case 'setCharacterVisibility':
    case 'setCharacterLock':
    case 'removeShape':
    case 'paintDrawing':
      return null;
  }
}

export function applyToProject(project: Project, change: ProjectChange): Project {
  switch (change.type) {
    case 'rename': {
      const name = cleanName(change.name, LIMITS.projectNameLength);
      return name === null || name === project.name ? project : { ...project, name };
    }
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
      const poses: Record<string, FramePose> = {};
      for (const { id } of project.characters) {
        const pose = change.poses?.[id] ?? source.poses[id];
        if (pose) poses[id] = copyPose(pose);
      }
      return { ...project, keyframes: project.keyframes.toSpliced(index + 1, 0, { id: change.keyframeId, poses }) };
    }
    case 'deleteKeyframe': {
      const index = project.keyframes.findIndex((k) => k.id === change.keyframeId);
      // Un Projet garde toujours au moins une image clé.
      if (index === -1 || project.keyframes.length <= 1) return project;
      return { ...project, keyframes: project.keyframes.toSpliced(index, 1) };
    }
    case 'poseKeyframe': {
      const index = project.keyframes.findIndex((k) => k.id === change.keyframeId);
      const keyframe = project.keyframes[index];
      const known = Object.entries(change.poses).filter(([id]) => hasCharacter(project, id));
      if (!keyframe || known.length === 0) return project;
      const poses = { ...keyframe.poses };
      for (const [id, pose] of known) poses[id] = copyPose(pose);
      return { ...project, keyframes: project.keyframes.with(index, { ...keyframe, poses }) };
    }

    case 'addCharacter': {
      if (hasCharacter(project, change.characterId)) return project;
      const character = createCharacter(change.characterId, cleanName(change.name, LIMITS.characterNameLength) ?? '');
      const occupied = Object.values(project.keyframes[0]?.poses ?? {}).map((p) => p.rootPosition);
      const rootPosition = placeNewCharacter(occupied);
      return {
        ...project,
        characters: [...project.characters, character],
        keyframes: project.keyframes.map((k) => ({ ...k, poses: { ...k.poses, [character.id]: { pose: {}, rootPosition } } })),
      };
    }
    case 'duplicateCharacter': {
      const index = project.characters.findIndex((c) => c.id === change.sourceId);
      const source = project.characters[index];
      if (!source || hasCharacter(project, change.characterId)) return project;
      const copy: Character = {
        ...source,
        id: change.characterId,
        name: cleanName(change.name, LIMITS.characterNameLength) ?? source.name,
        appearance: { ...source.appearance, segmentColors: { ...source.appearance.segmentColors } },
      };
      return {
        ...project,
        characters: project.characters.toSpliced(index + 1, 0, copy),
        keyframes: project.keyframes.map((k) => {
          const pose = k.poses[source.id];
          if (!pose) return k;
          const rootPosition = { x: pose.rootPosition.x + DUPLICATE_OFFSET.x, y: pose.rootPosition.y + DUPLICATE_OFFSET.y };
          return { ...k, poses: { ...k.poses, [copy.id]: { pose: { ...pose.pose }, rootPosition } } };
        }),
      };
    }
    case 'removeCharacter': {
      // Un Projet garde toujours au moins un personnage.
      if (!hasCharacter(project, change.characterId) || project.characters.length <= 1) return project;
      return {
        ...project,
        characters: project.characters.filter((c) => c.id !== change.characterId),
        keyframes: project.keyframes.map((k) => {
          const { [change.characterId]: _removed, ...poses } = k.poses;
          return { ...k, poses };
        }),
      };
    }
    case 'renameCharacter': {
      const name = cleanName(change.name, LIMITS.characterNameLength);
      return name === null ? project : updateCharacter(project, change.characterId, (c) => (c.name === name ? c : { ...c, name }));
    }
    case 'moveCharacter': {
      const index = project.characters.findIndex((c) => c.id === change.characterId);
      const target = index + change.direction;
      const character = project.characters[index];
      const other = project.characters[target];
      if (!character || !other) return project;
      return { ...project, characters: project.characters.with(index, other).with(target, character) };
    }
    case 'setCharacterVisibility':
      return updateCharacter(project, change.characterId, (c) =>
        c.visible === change.visible ? c : { ...c, visible: change.visible },
      );
    case 'setCharacterLock':
      return updateCharacter(project, change.characterId, (c) => (c.locked === change.locked ? c : { ...c, locked: change.locked }));
    case 'setCharacterColor': {
      const color = change.color === null ? null : normalizeHex(change.color);
      if (change.color !== null && color === null) return project;
      return updateCharacter(project, change.characterId, (c) => {
        if (change.parts.length === 0) {
          // Tout le personnage : sa couleur, sans couleur propre de partie.
          if (c.appearance.defaultColor === color && Object.keys(c.appearance.segmentColors).length === 0) return c;
          return { ...c, appearance: { ...c.appearance, defaultColor: color, segmentColors: {} } };
        }
        const parts = change.parts.filter((id) => c.skeleton.some((n) => n.id === id));
        if (parts.length === 0) return c;
        const segmentColors = { ...c.appearance.segmentColors };
        for (const id of parts) {
          if (color === null) delete segmentColors[id];
          else segmentColors[id] = color;
        }
        return sameFields(segmentColors, c.appearance.segmentColors)
          ? c
          : { ...c, appearance: { ...c.appearance, segmentColors } };
      });
    }
    case 'setCharacterScale': {
      const scale = toScale(change.scale, Number.NaN);
      if (Number.isNaN(scale)) return project;
      return updateCharacter(project, change.characterId, (c) =>
        c.appearance.scale === scale ? c : { ...c, appearance: { ...c.appearance, scale } },
      );
    }

    case 'addShape': {
      if (project.environment.shapes.some((s) => s.id === change.shape.id)) return project;
      const shape = normalizeShape(change.shape);
      return shape ? withShapes(project, [...project.environment.shapes, shape]) : project;
    }
    case 'updateShape': {
      const index = project.environment.shapes.findIndex((s) => s.id === change.shapeId);
      const current = project.environment.shapes[index];
      if (!current) return project;
      const shape = normalizeShape({ ...current, ...change.changes, id: current.id });
      if (!shape || sameFields(shape, current)) return project;
      return withShapes(project, project.environment.shapes.with(index, shape));
    }
    case 'removeShape': {
      const shapes = project.environment.shapes.filter((s) => s.id !== change.shapeId);
      return shapes.length === project.environment.shapes.length ? project : withShapes(project, shapes);
    }
    case 'paintDrawing': {
      const entries = Object.entries(change.tiles);
      if (entries.length === 0) return project;
      const tiles = { ...project.environment.drawing.tiles };
      for (const [key, tile] of entries) {
        if (tile === null) delete tiles[key];
        else tiles[key] = tile;
      }
      return { ...project, environment: { ...project.environment, drawing: { tiles } } };
    }
  }
}

/**
 * Ramène toutes les valeurs dans leurs bornes et garantit au moins un personnage, au moins
 * une image clé, et une pose de chaque personnage (et d'eux seuls) dans chaque image clé.
 */
export function normalizeProject(project: Project): Project {
  const characters = (project.characters.length > 0 ? project.characters : [createCharacter(createId(), '')]).map(
    (c) => ({ ...c, appearance: { ...c.appearance, scale: toScale(c.appearance.scale, 1) } }),
  );
  const keyframes = project.keyframes.length > 0 ? project.keyframes : [{ id: createId(), poses: {} }];
  return {
    ...project,
    fps: toLimit(project.fps, LIMITS.fps, LIMITS.fps.min),
    characters,
    keyframes: keyframes.map((k) => {
      const poses: Record<string, FramePose> = {};
      for (const { id } of characters) poses[id] = k.poses[id] ?? { pose: {}, rootPosition: { x: 0, y: 0 } };
      return { ...k, poses };
    }),
    environment: {
      ...project.environment,
      shapes: project.environment.shapes.flatMap((s) => normalizeShape(s) ?? []),
    },
    recentColors: project.recentColors.slice(0, LIMITS.recentColors),
    ai: {
      smoothing: normalizeSmoothing(project.ai.smoothing),
      loop: normalizeLoop(project.ai.loop),
    },
  };
}

/** Ajoute `color` en tête des couleurs récentes, sans doublon ; même Projet si rien ne change. */
export function withRecentColor(project: Project, color: string): Project {
  const hex = normalizeHex(color);
  if (!hex || project.recentColors[0] === hex) return project;
  const recentColors = [hex, ...project.recentColors.filter((c) => c !== hex)].slice(0, LIMITS.recentColors);
  return { ...project, recentColors };
}

// ---------- Aides ----------

function hasCharacter(project: Project, id: string): boolean {
  return project.characters.some((c) => c.id === id);
}

function updateCharacter(project: Project, id: string, update: (character: Character) => Character): Project {
  const index = project.characters.findIndex((c) => c.id === id);
  const current = project.characters[index];
  if (!current) return project;
  const next = update(current);
  return next === current ? project : { ...project, characters: project.characters.with(index, next) };
}

function withShapes(project: Project, shapes: Shape[]): Project {
  return { ...project, environment: { ...project.environment, shapes } };
}

/** Forme ramenée dans ses bornes (couleurs normalisées) ; `null` si une couleur est invalide. */
function normalizeShape(shape: Shape): Shape | null {
  const stroke = normalizeHex(shape.stroke);
  const fill = shape.fill === null ? null : normalizeHex(shape.fill);
  if (!stroke || (shape.fill !== null && !fill)) return null;
  const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);
  return {
    ...shape,
    x: finite(shape.x),
    y: finite(shape.y),
    width: Math.max(0, finite(shape.width)),
    height: Math.max(0, finite(shape.height)),
    rotation: finite(shape.rotation),
    stroke,
    fill,
    strokeWidth: clamp(finite(shape.strokeWidth, LIMITS.strokeWidth.min), LIMITS.strokeWidth.min, LIMITS.strokeWidth.max),
    opacity: clamp(finite(shape.opacity, 1), 0, 1),
  };
}

function copyPose({ pose, rootPosition }: FramePose): FramePose {
  return { pose: { ...pose }, rootPosition: { ...rootPosition } };
}

/** Nom sans espaces autour, coupé à `maxLength` ; `null` s'il est vide (on garde alors l'ancien). */
function cleanName(name: string, maxLength: number): string | null {
  const trimmed = name.trim().slice(0, maxLength);
  return trimmed === '' ? null : trimmed;
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

/** Taille ramenée entre 50 et 200 %, au centième. */
function toScale(value: number, fallback: number): number {
  const { min, max } = LIMITS.characterScale;
  return Number.isFinite(value) ? clamp(Math.round(value * 100) / 100, min, max) : fallback;
}

/** Mêmes clés et mêmes valeurs (comparaison superficielle). */
function sameFields<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}
