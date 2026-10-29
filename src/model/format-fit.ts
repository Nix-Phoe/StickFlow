// Cadre de la vidéo dans le monde, et éléments qui en sortent (avertissement au changement de format). Pur.

import { aspectRatio, type VideoFormat } from '../core/formats';
import type { Project } from '../core/types';
import { characterBounds } from './character';
import { shapeOutline } from './shape';

/** Hauteur du cadre dans le monde, quel que soit le format : seule sa largeur suit le rapport. */
export const FRAME_WORLD_HEIGHT = 400;
/** Épaisseur des traits d'un personnage à la taille 1 (celle du rendu). */
const STROKE_WIDTH = 9;

/** Taille du cadre de la vidéo, en unités du monde, centré sur l'origine. */
export function frameWorldSize(format: VideoFormat): { width: number; height: number } {
  return { width: FRAME_WORLD_HEIGHT * aspectRatio(format), height: FRAME_WORLD_HEIGHT };
}

/** Personnages visibles (dans au moins une image clé) et formes qui dépassent du cadre du format. */
export function outOfFrame(project: Project, format: VideoFormat): { characters: string[]; shapes: string[] } {
  const { width, height } = frameWorldSize(format);
  const inside = (x: number, y: number): boolean => Math.abs(x) <= width / 2 && Math.abs(y) <= height / 2;
  const characters = project.characters
    .filter((character) => character.visible)
    .filter((character) =>
      project.keyframes.some((keyframe) => {
        const pose = keyframe.poses[character.id];
        if (!pose) return false;
        const b = characterBounds(character, pose, STROKE_WIDTH);
        return !inside(b.minX, b.minY) || !inside(b.maxX, b.maxY);
      }),
    )
    .map((character) => character.id);
  const shapes = project.environment.shapes
    .filter((shape) => shapeOutline(shape).some((corner) => !inside(corner.x, corner.y)))
    .map((shape) => shape.id);
  return { characters, shapes };
}
