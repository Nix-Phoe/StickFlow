// Vignette d'une frame (timeline) : la même scène que le rendu final de la scène (couleurs des
// parties, zones de couleur, taille, décor), sans aide d'édition, avec des membres plus épais
// pour rester lisibles en petit.

import type { Project } from '../core/types';
import type { SequenceFrame } from '../model/sequence';
import { paintScene, type DrawingImage } from './canvas2d';
import { parseHexColor, type Rgba } from './color';
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
  paintScene(context, { width, height }, thumbnailLayers(project, frame, parseHexColor(stickman)), drawing);
}
