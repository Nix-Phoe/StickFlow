// Géométrie de l'arrière-plan dans le cadre du format (v2.1), en pixels du cadre, origine en haut
// à gauche : ligne d'un dégradé, place d'une image selon son ajustement, son point focal et son zoom.

import type { VideoFormat } from '../core/formats';
import type { ImageFit } from '../core/types';

interface Size {
  width: number;
  height: number;
}

/**
 * Ligne d'un dégradé linéaire, comme en CSS : `angle` en degrés (0 = vers le haut, sens horaire),
 * passant par le centre, assez longue pour que ses extrémités touchent les coins.
 */
export function gradientLine(angle: number, width: number, height: number): { x0: number; y0: number; x1: number; y1: number } {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return { x0: width / 2 - dx * half, y0: height / 2 - dy * half, x1: width / 2 + dx * half, y1: height / 2 + dy * half };
}

/**
 * Rectangle où dessiner l'image : Remplir (couvre et rogne), Ajuster (tient entière), Étirer
 * (déformée), multiplié par le zoom. Le point focal vient au centre du cadre autant que possible :
 * une image plus grande que le cadre ne laisse jamais de vide, une plus petite reste dedans.
 */
export function imageLayout(
  fit: Exclude<ImageFit, 'tile'>,
  image: Size,
  frame: Size,
  focus: { x: number; y: number },
  zoom: number,
): { x: number; y: number; width: number; height: number } {
  let width: number;
  let height: number;
  if (fit === 'stretch') {
    width = frame.width * zoom;
    height = frame.height * zoom;
  } else {
    const ratios = [frame.width / image.width, frame.height / image.height];
    const scale = (fit === 'cover' ? Math.max(...ratios) : Math.min(...ratios)) * zoom;
    width = image.width * scale;
    height = image.height * scale;
  }
  return {
    x: place(frame.width / 2 - focus.x * width, width, frame.width),
    y: place(frame.height / 2 - focus.y * height, height, frame.height),
    width,
    height,
  };
}

/** Position bornée : sans vide si l'image déborde, sans sortir du cadre sinon. */
function place(position: number, size: number, frame: number): number {
  const [min, max] = size >= frame ? [frame - size, 0] : [0, frame - size];
  return Math.min(max, Math.max(min, position));
}

/**
 * Mosaïque : l'image répétée à sa taille (× `scale`, l'échelle des pixels du cadre, × zoom), le
 * point focal d'une tuile au centre du cadre. Décalage de la première tuile, dans [0, taille).
 */
export function tileLayout(
  image: Size,
  frame: Size,
  focus: { x: number; y: number },
  scale: number,
  zoom: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const width = image.width * scale * zoom;
  const height = image.height * scale * zoom;
  const wrap = (value: number, size: number): number => ((value % size) + size) % size;
  return {
    width,
    height,
    offsetX: wrap(frame.width / 2 - focus.x * width, width),
    offsetY: wrap(frame.height / 2 - focus.y * height, height),
  };
}

/** Taille du canvas où l'arrière-plan est composé : le cadre du format, son long côté à `max` au plus. */
export function backgroundCanvasSize(format: VideoFormat, max: number): Size {
  const scale = Math.min(1, max / Math.max(format.width, format.height));
  return { width: Math.round(format.width * scale), height: Math.round(format.height * scale) };
}
