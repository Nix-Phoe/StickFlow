// Fichier « .stickflow » (v2.2) : nom, erreurs et contenu, sans le code ZIP (fflate), pour que
// l'accueil puisse les connaître sans charger l'archive (project-archive.ts, chargé à la demande).

import type { AssetSource, ImageCredit, Project } from '../core/types';
import { exportFileName } from '../export/export-plan';

export const ARCHIVE_EXTENSION = 'stickflow';

export type ArchiveErrorCode = 'not-archive' | 'too-new' | 'too-large' | 'invalid' | 'empty';

export class ArchiveError extends Error {
  override name = 'ArchiveError';
  constructor(
    readonly code: ArchiveErrorCode,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

/** Un projet de l'archive, avec ses dates de la bibliothèque d'origine. */
export interface ArchivedProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  project: Project;
}

/** Une image de l'archive (sans dates d'usage : elles sont refaites à l'import). */
export interface ArchivedAsset {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  source: AssetSource;
  credit?: ImageCredit;
  /** Petite vignette des images récentes (data URL d'image, sinon `null`). */
  thumbnail: string | null;
  blob: Blob;
}

export interface ProjectArchive {
  projects: ArchivedProject[];
  assets: ArchivedAsset[];
}

/** Nom du fichier d'un projet exporté : « coup-de-poing.stickflow ». */
export function archiveFileName(projectName: string): string {
  return exportFileName(projectName, ARCHIVE_EXTENSION);
}

/** Nom d'une sauvegarde de toute la bibliothèque : « stickflow-sauvegarde-2026-11-02.stickflow ». */
export function backupFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `stickflow-sauvegarde-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${ARCHIVE_EXTENSION}`;
}
