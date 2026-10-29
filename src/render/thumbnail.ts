// Vignette d'une frame (timeline) : la même scène que le rendu final de la scène (couleurs des
// parties, zones de couleur, taille, décor), sans aide d'édition, avec des membres plus épais
// pour rester lisibles en petit.

import type { Project } from '../core/types';
import { deriveSequence, type SequenceFrame } from '../model/sequence';
import { aspectRatio, type VideoFormat } from '../core/formats';
import { fitWorldHeight } from './camera';
import { paintScene, type DrawingImage } from './canvas2d';
import { EXPORT_COLORS, parseHexColor, type Rgba } from './color';
import type { StickmanStyle } from './scene';
import { buildSceneLayers, type SceneLayer } from './scene-layers';

export const THUMBNAIL_STYLE: StickmanStyle = { strokeWidth: 16 };

const NO_SELECTION = { selectedCharacterId: null, selectedNodeId: null, selectedParts: [], selectedShapeId: null };

/** Couches d'une vignette ; `stickman` : couleur automatique (personnage sans couleur). */
export function thumbnailLayers(project: Project, frame: SequenceFrame, stickman: Rgba): SceneLayer[] {
  return buildSceneLayers({
    project,
    frame,
    onion: null,
    mode: null,
    selection: NO_SELECTION,
    palette: { stickman, accent: stickman },
    style: THUMBNAIL_STYLE,
  });
}

/** Dessine la frame dans `canvas`, à sa taille affichée (pixels physiques). `stickman` : couleur HEX automatique. */
export function paintThumbnail(
  canvas: HTMLCanvasElement,
  project: Project,
  frame: SequenceFrame,
  stickman: string,
  drawing: DrawingImage | null,
): void {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  const context = canvas.getContext('2d');
  if (!context || width === 0 || height === 0) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  context.clearRect(0, 0, width, height);
  const { background } = project.environment;
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  // Tout le cadre du format tient dans la vignette.
  const worldHeight = fitWorldHeight({ width, height }, aspectRatio(project.format));
  paintScene(context, { width, height, worldHeight }, thumbnailLayers(project, frame, parseHexColor(stickman)), drawing);
}

/** Côté le plus long d'une vignette de projet enregistrée, en pixels. */
export const PROJECT_THUMBNAIL_SIZE = 320;

/** Taille d'une vignette de projet : le cadre du format, son plus long côté à `max` pixels. */
export function thumbnailSize(format: VideoFormat, max = PROJECT_THUMBNAIL_SIZE): { width: number; height: number } {
  const ratio = aspectRatio(format);
  return ratio >= 1 ? { width: max, height: Math.round(max / ratio) } : { width: Math.round(max * ratio), height: max };
}

/**
 * Vignette d'un projet (accueil, index des projets) : sa première frame, aux couleurs de l'export,
 * en PNG (data URL). `null` si le navigateur ne sait pas dessiner.
 */
export function projectThumbnail(project: Project, drawing: DrawingImage | null): string | null {
  const frame = deriveSequence(project)[0];
  const canvas = document.createElement('canvas');
  const { width, height } = thumbnailSize(project.format);
  canvas.width = width;
  canvas.height = height;
  if (!frame || !paintProjectFrame(canvas, project, frame, drawing)) return null;
  return canvas.toDataURL('image/png');
}

/**
 * Dessine une frame d'un projet dans tout le canvas (à sa taille en pixels), aux couleurs de
 * l'export : vignettes enregistrées et aperçu animé des cartes de l'accueil. `false` sans Canvas 2D.
 */
export function paintProjectFrame(canvas: HTMLCanvasElement, project: Project, frame: SequenceFrame, drawing: DrawingImage | null): boolean {
  const context = canvas.getContext('2d');
  const { width, height } = canvas;
  if (!context || width === 0 || height === 0) return false;
  context.fillStyle = project.environment.background ?? EXPORT_COLORS.background;
  context.fillRect(0, 0, width, height);
  const layers = thumbnailLayers(project, frame, parseHexColor(EXPORT_COLORS.stickman));
  paintScene(context, { width, height, worldHeight: fitWorldHeight({ width, height }, aspectRatio(project.format)) }, layers, drawing);
  return true;
}
