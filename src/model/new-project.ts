// Nouveau projet : un stickman au repos, ou la copie d'un modèle de départ. Pur.

import type { VideoFormat } from '../core/formats';
import { createId } from '../core/id';
import { clamp, LIMITS, type Project } from '../core/types';
import { createCharacter } from './character';

export interface NewProjectOptions {
  name: string;
  format: VideoFormat;
  /** IPS choisi ; sans valeur, celui du modèle (12 sans modèle). */
  fps?: number;
  /** Nom du personnage de départ (sans modèle). */
  characterName: string;
  /** Projet de départ, copié : il n'est jamais modifié. */
  template?: Project;
}

const DEFAULT_FPS = 12;

export function createProject({ name, format, fps, characterName, template }: NewProjectOptions): Project {
  const base = template ? structuredClone(template) : blankProject(characterName);
  const chosenFps = fps ?? base.fps;
  return {
    ...base,
    name,
    format,
    fps: clamp(Math.round(chosenFps), LIMITS.fps.min, LIMITS.fps.max),
  };
}

function blankProject(characterName: string): Project {
  const character = createCharacter(createId(), characterName);
  return {
    name: '',
    fps: DEFAULT_FPS,
    format: { preset: 'youtube', width: 1920, height: 1080 },
    characters: [character],
    keyframes: [{ id: createId(), poses: { [character.id]: { pose: {}, rootPosition: { x: 0, y: 0 } } } }],
    environment: { background: null, shapes: [], drawing: { tiles: {} } },
    recentColors: [],
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
      loop: { enabled: false, repeatCount: 3, infinite: true, transitionFrames: 4 },
    },
  };
}

/**
 * Nom d'un nouveau projet : celui demandé (ou `fallback` s'il est vide), numéroté s'il est déjà
 * pris (« Projet sans titre 2 »).
 */
export function uniqueName(wanted: string, taken: readonly string[], fallback = wanted): string {
  const base = (wanted.trim() || fallback.trim()).slice(0, LIMITS.projectNameLength);
  const names = new Set(taken);
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
