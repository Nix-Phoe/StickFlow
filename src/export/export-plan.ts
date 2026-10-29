// Ce qu'un export doit contenir, selon le format et la Répétition. Pur.

import type { ExportFormat, Project } from '../core/types';
import type { SequenceFrame } from '../model/sequence';

export interface ExportPlan {
  /** Taille des images, en pixels : la résolution du format de la vidéo. */
  size: { width: number; height: number };
  frames: readonly SequenceFrame[];
  delayMs: number;
  /** Compteur de boucle du GIF : -1 une lecture, 0 en boucle, n répétitions en plus. */
  gifRepeat: number;
}

/**
 * - Répétition coupée : une lecture.
 * - Répétition infinie : le GIF boucle ; la vidéo et les PNG contiennent un passage.
 * - N répétitions : le GIF le dit dans son compteur ; la vidéo contient N passages ; les PNG un seul.
 */
export function planExport(project: Project, sequence: readonly SequenceFrame[], format: ExportFormat): ExportPlan {
  const { loop } = project.ai;
  const repeats = !loop.enabled ? 1 : loop.infinite ? Infinity : loop.repeatCount;
  const passes = format === 'mp4' && Number.isFinite(repeats) ? repeats : 1;
  return {
    size: exportSize(project),
    frames: Array.from({ length: passes }, () => sequence).flat(),
    delayMs: 1000 / project.fps,
    gifRepeat: repeats === Infinity ? 0 : repeats - 1 > 0 ? repeats - 1 : -1,
  };
}

/** Nom de fichier sûr tiré du nom du projet (« Saut périlleux ! » → « saut-perilleux.gif »). */
export function exportFileName(projectName: string, extension: string): string {
  const base = projectName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'stickflow'}.${extension}`;
}

/** Formats vidéo essayés dans l'ordre ; le navigateur n'enregistre pas toujours le MP4. */
const VIDEO_FORMATS = [
  { mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
] as const;

export function pickVideoFormat(isTypeSupported: (mimeType: string) => boolean): { mimeType: string; extension: string } | null {
  const format = VIDEO_FORMATS.find(({ mimeType }) => isTypeSupported(mimeType));
  return format ? { mimeType: format.mimeType, extension: format.extension } : null;
}

/** Résolution des images exportées : celle du format de la vidéo du projet. */
export function exportSize(project: Project): { width: number; height: number } {
  return { width: project.format.width, height: project.format.height };
}
