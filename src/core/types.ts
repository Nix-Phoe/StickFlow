// Types partagés du projet. Aucune dépendance au DOM ni à WebGL.

/** Forme dessinée pour un nœud : un trait du parent au nœud, ou un disque plein (la tête). */
export type NodeShape = 'segment' | 'circle';

export interface SkeletonNode {
  id: string;
  parentId: string | null;
  /** Longueur du segment vers le parent (diamètre pour un cercle). */
  length: number;
  /** Angle de repos, en radians, relatif au parent. */
  angle: number;
  shape: NodeShape;
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Image clé : une frame posée par l'utilisateur. C'est la seule sorte de frame enregistrée ;
 * les frames générées sont dérivées des images clés (voir model/sequence.ts, ADR 0002).
 */
export interface Keyframe {
  id: string;
  /** Angle de chaque nœud, indexé par id de nœud ; un nœud absent garde son angle de repos. */
  pose: Record<string, number>;
  rootPosition: Vec2;
}

/** Ce qui définit la pose d'une frame (copiée / collée, modifiée en manipulant les nœuds). */
export interface FramePose {
  pose: Readonly<Record<string, number>>;
  rootPosition: Vec2;
}

export type SmoothingCurve = 'linear' | 'smooth' | 'ease-in-out';

export interface SmoothingSettings {
  enabled: boolean;
  /** Nombre de frames intermédiaires générées entre deux images clés. */
  intensity: number;
  curve: SmoothingCurve;
}

export interface LoopSettings {
  enabled: boolean;
  /** Nombre de répétitions, conservé même quand la répétition est infinie. */
  repeatCount: number;
  infinite: boolean;
  transitionFrames: number;
}

export interface AiSettings {
  smoothing: SmoothingSettings;
  loop: LoopSettings;
}

export interface Project {
  name: string;
  /** 1 à 60. */
  fps: number;
  skeleton: SkeletonNode[];
  keyframes: Keyframe[];
  ai: AiSettings;
}

/** Projet enregistré, tel que la liste « Ouvrir » l'affiche. */
export interface LibraryEntry {
  id: string;
  name: string;
  /** Date d'enregistrement, en millisecondes depuis l'époque Unix. */
  savedAt: number;
}

/** Message bref affiché après une action longue (sauvegarde, ouverture, export). */
export type NoticeCode = 'saved' | 'save-failed' | 'opened' | 'open-failed' | 'exported' | 'export-failed';

export interface Notice {
  kind: 'success' | 'error';
  code: NoticeCode;
  /** Détail technique (message d'erreur, nom de fichier exporté). */
  detail?: string;
}

export type EditorMode = 'character' | 'selection' | 'scene';

export type PlaybackSpeed = 1 | 2 | 5 | 10;

export type ExportFormat = 'gif' | 'png' | 'mp4';

export const EDITOR_MODES: readonly EditorMode[] = ['character', 'selection', 'scene'];
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [1, 2, 5, 10];
export const SMOOTHING_CURVES: readonly SmoothingCurve[] = ['linear', 'smooth', 'ease-in-out'];
export const EXPORT_FORMATS: readonly ExportFormat[] = ['gif', 'png', 'mp4'];

/** Bornes des réglages numériques, partagées entre l'état et l'interface. */
export const LIMITS = {
  fps: { min: 1, max: 60 },
  smoothingIntensity: { min: 1, max: 8 },
  loopRepeat: { min: 1, max: 99 },
  loopTransitionFrames: { min: 1, max: 12 },
  projectNameLength: 80,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
