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

export interface Frame {
  id: string;
  /** Angle de chaque nœud, indexé par id de nœud. */
  pose: Record<string, number>;
  rootPosition: Vec2;
  /** true = créée par l'IA. */
  generated: boolean;
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
  frames: Frame[];
  ai: AiSettings;
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
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
