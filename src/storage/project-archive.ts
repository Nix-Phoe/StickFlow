// Fichier « .stickflow » (v2.2) : un ou plusieurs projets et leurs images d'arrière-plan dans une
// archive ZIP, pour exporter un projet, sauvegarder toute la bibliothèque et les réimporter.
//
//   stickflow.json          manifeste : format, version, projets (nom, dates), images (taille, crédit)
//   projects/<id>.json      fichier de projet (même format que la bibliothèque, migré à la lecture)
//   assets/<id>.<ext>       image d'arrière-plan (PNG, JPEG, WebP ou GIF ; jamais de SVG)
//
// La lecture vérifie tout avant d'accepter : taille de l'archive et de chaque fichier, chemins
// attendus seulement, projets par `fromProjectFile` (migration comprise), images par leur contenu.

import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate';

import type { AssetSource, ImageCredit, Project } from '../core/types';
import { checkImageFile, SNIFF_BYTES } from '../environment/image-import';
import type { Asset } from './asset-store';
import { fromProjectFile, toProjectFile } from './project-file';
import { ArchiveError, type ArchiveErrorCode, type ArchivedAsset, type ArchivedProject, type ProjectArchive } from './archive-file';

export * from './archive-file';

export const ARCHIVE_FORMAT = 'stickflow-archive';
export const ARCHIVE_VERSION = 1;
const MANIFEST = 'stickflow.json';

/** Taille maximale d'une archive importée (une sauvegarde de toute la bibliothèque). */
export const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
/** Taille maximale d'un fichier une fois décompressé (le calque de dessin peut peser quelques Mo). */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
/** Nombre maximal de fichiers dans une archive. */
const MAX_ENTRIES = 4000;

const ID = '[A-Za-z0-9_-]{1,64}';
const PROJECT_PATH = new RegExp(`^projects/${ID}\\.json$`);
const ASSET_PATH = new RegExp(`^assets/${ID}\\.(png|jpg|webp|gif)$`);
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const THUMBNAIL_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]*$/;
const ASSET_SOURCES: readonly AssetSource[] = ['device', 'stock', 'url'];

/** Écrit l'archive ; les images déjà compressées sont stockées telles quelles, le JSON est compressé. */
export async function writeProjectArchive(
  projects: readonly ArchivedProject[],
  assets: readonly Asset[],
  { app, now = Date.now }: { app: string; now?: () => number },
): Promise<Uint8Array<ArrayBuffer>> {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const manifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    app,
    exportedAt: now(),
    projects: projects.map(({ id, name, createdAt, updatedAt, project }) => {
      const path = `projects/${safeId(id)}.json`;
      files[path] = strToU8(JSON.stringify(toProjectFile(project)));
      return { id, name, createdAt, updatedAt, path };
    }),
    assets: await Promise.all(
      assets.map(async ({ id, width, height, mimeType, source, credit, thumbnail, blob }) => {
        const path = `assets/${safeId(id)}.${IMAGE_EXTENSIONS[mimeType] ?? 'png'}`;
        files[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
        return { id, width, height, mimeType, source, ...(credit ? { credit } : {}), thumbnail, path };
      }),
    ),
  };
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2));
  return new Uint8Array(zipSync(files));
}

/** Relit et vérifie une archive. Lève `ArchiveError` au moindre contenu inattendu. */
export async function readProjectArchive(
  bytes: Uint8Array,
  { maxBytes = MAX_ARCHIVE_BYTES, maxEntryBytes = MAX_ENTRY_BYTES }: { maxBytes?: number; maxEntryBytes?: number } = {},
): Promise<ProjectArchive> {
  if (bytes.length > maxBytes) throw new ArchiveError('too-large');
  const files = unzip(bytes, maxEntryBytes);
  const manifestBytes = files[MANIFEST];
  if (!manifestBytes) throw new ArchiveError('not-archive');
  const manifest = parseJson(manifestBytes, 'not-archive');
  if (!isRecord(manifest) || manifest.format !== ARCHIVE_FORMAT) throw new ArchiveError('not-archive');
  if (typeof manifest.version !== 'number' || manifest.version > ARCHIVE_VERSION) throw new ArchiveError('too-new');
  if (!Array.isArray(manifest.projects) || !Array.isArray(manifest.assets)) throw new ArchiveError('invalid', 'manifeste');
  if (manifest.projects.length === 0) throw new ArchiveError('empty');

  const projects = manifest.projects.map((entry: unknown): ArchivedProject => {
    if (!isRecord(entry)) throw new ArchiveError('invalid', 'projet');
    const path = pathOf(entry, PROJECT_PATH);
    const content = files[path];
    if (!content) throw new ArchiveError('invalid', `${path} manquant`);
    let project: Project;
    try {
      project = fromProjectFile(parseJson(content, 'invalid'));
    } catch (error) {
      throw error instanceof ArchiveError ? error : new ArchiveError('invalid', `${path} : ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      id: idOf(entry.id),
      name: project.name,
      createdAt: timeOf(entry.createdAt),
      updatedAt: timeOf(entry.updatedAt),
      project,
    };
  });

  const assets = manifest.assets.map((entry: unknown): ArchivedAsset => {
    if (!isRecord(entry)) throw new ArchiveError('invalid', 'image');
    const path = pathOf(entry, ASSET_PATH);
    const content = files[path];
    const mimeType = typeof entry.mimeType === 'string' && entry.mimeType in IMAGE_EXTENSIONS ? entry.mimeType : null;
    if (!content || !mimeType) throw new ArchiveError('invalid', `${path} : image manquante ou de type inconnu`);
    // Le contenu doit vraiment être une image (jamais de SVG ni de script déguisé).
    if (checkImageFile({ type: mimeType, size: content.length }, content.subarray(0, SNIFF_BYTES)) !== null) {
      throw new ArchiveError('invalid', `${path} : ce n'est pas une image acceptée`);
    }
    const source = ASSET_SOURCES.find((value) => value === entry.source) ?? 'device';
    const credit = readCredit(entry.credit);
    return {
      id: idOf(entry.id),
      width: sizeOf(entry.width),
      height: sizeOf(entry.height),
      mimeType,
      source,
      ...(credit ? { credit } : {}),
      thumbnail: readThumbnail(entry.thumbnail),
      blob: new Blob([new Uint8Array(content)], { type: mimeType }),
    };
  });

  return { projects, assets };
}

// ---------- Lecture sûre ----------

/** Décompresse seulement les fichiers attendus, en refusant une archive trop lourde une fois ouverte. */
function unzip(bytes: Uint8Array, maxEntryBytes: number): Unzipped {
  let count = 0;
  let tooLarge = false;
  let files: Unzipped;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        count += 1;
        if (file.originalSize > maxEntryBytes || file.size > maxEntryBytes) tooLarge = true;
        const expected = file.name === MANIFEST || PROJECT_PATH.test(file.name) || ASSET_PATH.test(file.name);
        return expected && !tooLarge && count <= MAX_ENTRIES;
      },
    });
  } catch {
    throw new ArchiveError('not-archive');
  }
  if (tooLarge) throw new ArchiveError('too-large');
  if (count > MAX_ENTRIES) throw new ArchiveError('invalid', 'trop de fichiers');
  return files;
}

function parseJson(bytes: Uint8Array, code: ArchiveErrorCode): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    throw new ArchiveError(code, 'JSON illisible');
  }
}

function pathOf(entry: Record<string, unknown>, pattern: RegExp): string {
  if (typeof entry.path !== 'string' || !pattern.test(entry.path)) throw new ArchiveError('invalid', `chemin inattendu : ${String(entry.path)}`);
  return entry.path;
}

function idOf(value: unknown): string {
  if (typeof value !== 'string' || !new RegExp(`^${ID}$`).test(value)) throw new ArchiveError('invalid', 'identifiant');
  return value;
}

function timeOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function sizeOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 16384) throw new ArchiveError('invalid', 'taille d’image');
  return value;
}

function readCredit(value: unknown): ImageCredit | undefined {
  if (!isRecord(value)) return undefined;
  const { author, url, provider } = value;
  return typeof author === 'string' && typeof url === 'string' && typeof provider === 'string' ? { author, url, provider } : undefined;
}

/** Vignette : une data URL d'image matricielle de taille raisonnable, rien d'autre. */
function readThumbnail(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 200_000 && THUMBNAIL_PATTERN.test(value) ? value : null;
}

/** Un id de la bibliothèque devient un nom de fichier sûr (les UUID le sont déjà). */
function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'x';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
