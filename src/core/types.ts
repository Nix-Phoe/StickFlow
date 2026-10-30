// Types partagés du projet. Aucune dépendance au DOM ni à WebGL.

import type { VideoFormat } from './formats';

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

/** Pose d'un personnage dans une frame (copiée / collée, modifiée en manipulant les nœuds). */
export interface FramePose {
  /** Angle de chaque nœud, indexé par id de nœud ; un nœud absent garde son angle de repos. */
  pose: Readonly<Record<string, number>>;
  rootPosition: Vec2;
}

export interface CharacterAppearance {
  /** Taille : multiplie les longueurs des segments et l'épaisseur des traits (0,5 à 2). */
  scale: number;
  /** Couleur du personnage entier ; `null` = couleur automatique (celle du thème, foncée à l'export). */
  defaultColor: string | null;
  /** Couleur propre d'une partie, indexée par l'id du nœud qui termine le segment (la tête a le sien). */
  segmentColors: Record<string, string>;
  /** Zones de couleur d'une partie (coloration partielle : manche, short, cheveux…), la dernière au-dessus. */
  segmentBands: Record<string, ColorBand[]>;
}

/**
 * Zone de couleur sur une partie, de `from` à `to` le long de la partie : 0 = l'articulation du
 * parent, 1 = le bout (pour la tête : du cou au sommet). Une zone qui touche un bout couvre son arrondi.
 */
export interface ColorBand {
  from: number;
  to: number;
  color: string;
}

/** Personnage : son squelette et son apparence sont les mêmes dans toutes les frames. */
export interface Character {
  id: string;
  name: string;
  /** Masqué : ni affiché ni exporté. */
  visible: boolean;
  /** Verrouillé : affiché, mais impossible à sélectionner sur la scène. */
  locked: boolean;
  skeleton: SkeletonNode[];
  appearance: CharacterAppearance;
}

/**
 * Image clé : une frame posée par l'utilisateur. C'est la seule sorte de frame enregistrée ;
 * les frames générées sont dérivées des images clés (voir model/sequence.ts, ADR 0002).
 * Elle contient la pose de chaque personnage (invariant du module Projet).
 */
export interface Keyframe {
  id: string;
  /** Pose de chaque personnage, indexée par id de personnage. */
  poses: Record<string, FramePose>;
}

export type ShapeKind = 'square' | 'circle' | 'rectangle' | 'triangle' | 'line';

/**
 * Forme vectorielle du décor. `x`, `y` : centre (unités du monde) ; `width` × `height` : taille
 * avant rotation ; une ligne va de son centre ± `width` / 2 le long de `rotation` (radians).
 */
export interface Shape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  stroke: string;
  /** `null` : contour seul. */
  fill: string | null;
  strokeWidth: number;
  /** 0 à 1. */
  opacity: number;
}

/** Calque de dessin matriciel, découpé en tuiles (voir model/drawing-layer.ts). */
export interface DrawingLayer {
  /** PNG en data URL de chaque tuile peinte, indexé par « colonne,ligne » ; une tuile absente est transparente. */
  tiles: Record<string, string>;
}

// ---------- Arrière-plan (v2.1) ----------

/** Arrière-plans intégrés, dessinés par le code (src/environment/backgrounds/). */
export const BUILTIN_BACKGROUND_IDS = ['day-sky', 'sunset', 'starry-night', 'horizon', 'studio-grid', 'room'] as const;
export type BuiltinBackgroundId = (typeof BUILTIN_BACKGROUND_IDS)[number];

export const IMAGE_FITS = ['cover', 'contain', 'stretch', 'tile'] as const;
/** Remplir (rogne), Ajuster (bandes), Étirer (déforme), Mosaïque (répète). */
export type ImageFit = (typeof IMAGE_FITS)[number];

/** Crédit d'une photo de banque d'images (affiché sous l'arrière-plan). */
export interface ImageCredit {
  author: string;
  /** Page de la photo chez le fournisseur. */
  url: string;
  provider: string;
}

export interface ColorBackground {
  type: 'color';
  color: string;
}

export interface GradientBackground {
  type: 'gradient';
  from: string;
  to: string;
  /** Degrés, comme en CSS : 0 = vers le haut, 90 = vers la droite, 180 = vers le bas. */
  angle: number;
}

export interface BuiltinBackground {
  type: 'builtin';
  id: BuiltinBackgroundId;
}

/** Image du magasin d'assets, cadrée dans le cadre du format, avec ses effets. */
export interface ImageBackground {
  type: 'image';
  assetId: string;
  fit: ImageFit;
  /** Point focal de l'image (0 à 1), centré dans le cadre autant que possible. */
  focus: { x: number; y: number };
  /** 1 à 3. */
  zoom: number;
  /** Flou, en pixels de la résolution du format (0 à 20). */
  blur: number;
  /** 1 = normale. */
  brightness: number;
  /** 0 à 1, sur le blanc de l'export. */
  opacity: number;
  /** Voile de couleur posé sur l'image (`amount` de 0 à 1). */
  tint: { color: string; amount: number } | null;
  credit?: ImageCredit;
}

export type Background = ColorBackground | GradientBackground | BuiltinBackground | ImageBackground;

/**
 * Décor : statique en version 1.0 (le même dans toutes les frames). Les formes ont des ids
 * stables pour qu'une image clé puisse un jour les animer.
 */
export interface Environment {
  /** Arrière-plan (v2.1) ; `null` = celui du thème (blanc à l'export). */
  background: Background | null;
  /** Dans l'ordre d'affichage : la dernière est au-dessus. */
  shapes: Shape[];
  drawing: DrawingLayer;
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
  /** Format de la vidéo : cadre de la scène et résolution de l'export (v2.0). */
  format: VideoFormat;
  /** Dans l'ordre d'affichage : le dernier est dessiné au-dessus. Au moins un. */
  characters: Character[];
  keyframes: Keyframe[];
  environment: Environment;
  /** 8 dernières couleurs utilisées, la plus récente en premier. */
  recentColors: string[];
  ai: AiSettings;
}

/**
 * Résumé d'un projet enregistré (index des projets) : de quoi afficher sa carte sur l'accueil
 * ou sa ligne dans « Ouvrir », sans charger le projet complet. Dates en millisecondes (époque Unix).
 */
export interface ProjectSummary {
  id: string;
  name: string;
  format: VideoFormat;
  fps: number;
  /** Nombre d'images de l'animation (images clés et frames générées). */
  frameCount: number;
  createdAt: number;
  updatedAt: number;
  /** Première frame, en PNG (data URL, petite taille) ; `null` si pas encore générée. */
  thumbnail: string | null;
  /** Images du magasin d'assets utilisées par le projet (arrière-plan, v2.1). */
  assetIds: string[];
}

/** Message bref affiché après une action longue (sauvegarde, ouverture, export). */
export type NoticeCode = 'saved' | 'save-failed' | 'opened' | 'open-failed' | 'exported' | 'export-failed';

export interface Notice {
  kind: 'success' | 'error';
  code: NoticeCode;
  /** Détail technique (message d'erreur, nom de fichier exporté). */
  detail?: string;
}

/** Contexte d'édition de la scène : seuls les éléments de ce contexte réagissent au pointeur. */
export type EditorMode = 'characters' | 'environment';

export type ShapeTool = 'square' | 'circle' | 'rectangle' | 'triangle' | 'line' | 'fill';
export type DrawingTool = 'pen' | 'marker' | 'brush' | 'eraser' | 'nib' | 'airbrush';
/** Outil de l'environnement ; `select` sélectionne et déplace les formes. */
export type ToolId = 'select' | ShapeTool | DrawingTool;

export interface ToolSettings {
  color: string;
  /** Épaisseur du trait, en unités du monde. */
  strokeWidth: number;
  /** 0 à 1. */
  opacity: number;
  /** Formes : remplies, ou contour seul. */
  filled: boolean;
}

export type ColorHarmony = 'none' | 'analogous' | 'complementary' | 'triadic';

export type PlaybackSpeed = 1 | 2 | 5 | 10;

export type ExportFormat = 'gif' | 'png' | 'mp4';

export const EDITOR_MODES: readonly EditorMode[] = ['characters', 'environment'];
export const SHAPE_TOOLS: readonly ShapeTool[] = ['square', 'circle', 'rectangle', 'triangle', 'line', 'fill'];
export const DRAWING_TOOLS: readonly DrawingTool[] = ['pen', 'marker', 'brush', 'eraser', 'nib', 'airbrush'];
export const SHAPE_KINDS: readonly ShapeKind[] = ['square', 'circle', 'rectangle', 'triangle', 'line'];
export const COLOR_HARMONIES: readonly ColorHarmony[] = ['none', 'analogous', 'complementary', 'triadic'];
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
  characterNameLength: 40,
  /** Taille d'un personnage : 50 % à 200 %. */
  characterScale: { min: 0.5, max: 2 },
  recentColors: 8,
  /** Zones de couleur par partie. */
  bandsPerPart: 4,
  /** Épaisseur d'un trait (formes et dessin), en unités du monde. */
  strokeWidth: { min: 1, max: 40 },
  /** Réglages d'une image d'arrière-plan (v2.1). */
  backgroundZoom: { min: 1, max: 3 },
  backgroundBlur: { min: 0, max: 20 },
  backgroundBrightness: { min: 0.5, max: 1.5 },
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
