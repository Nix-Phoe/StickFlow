// Durées, tailles de fichiers et noms des formats de vidéo, à la française.

import { ratioLabel, type VideoFormat } from '../core/formats';
import { strings } from './strings';

/** Nom du format (le même partout dans l'app). */
export function formatName(format: VideoFormat): string {
  return strings.formats.names[format.preset];
}

export function formatSubtitle(format: VideoFormat): string {
  return strings.formats.subtitles[format.preset];
}

/** Badge d'une carte de projet : « Vertical · 9:16 » (une taille libre montre son rapport réel). */
export function formatBadge(format: VideoFormat): string {
  return strings.formats.badge(formatName(format), ratioLabel(format));
}

/** « 1:16 » : minutes et secondes, la dernière seconde entamée comptant. */
export function formatDuration(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds - 1e-6));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const UNITS = ['o', 'ko', 'Mo', 'Go', 'To'] as const;
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** « 12,4 Mo » (unités de 1024 octets). */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${number.format(value)} ${UNITS[unit]}`;
}
