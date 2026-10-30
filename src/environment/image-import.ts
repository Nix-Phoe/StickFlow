// Import d'une image d'arrière-plan (v2.1) : vérification (PNG, JPEG, WebP, première image d'un
// GIF ; jamais de SVG, qui peut contenir des scripts ; 20 Mo au plus), puis traitement avant stockage :
// décodage hors du fil principal, réduction à 2 fois la résolution du format (3840 px au plus),
// compression en WebP (ou JPEG), et petite vignette pour les images récentes.

import type { VideoFormat } from '../core/formats';
import type { AssetErrorCode } from '../core/types';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
/** Plus long côté d'une image importée, quel que soit le format. */
export const MAX_IMPORT_SIDE = 3840;
/** Plus long côté de la vignette d'une image récente. */
export const THUMBNAIL_SIDE = 160;
/** Octets lus au début du fichier pour reconnaître son type. */
export const SNIFF_BYTES = 64;
const WEBP_QUALITY = 0.85;

type ImageKind = 'png' | 'jpeg' | 'webp' | 'gif';

/**
 * Erreur d'un fichier à importer, ou `null` s'il est accepté. Le type est reconnu à son contenu
 * (`head` : ses premiers octets), pas à son nom ni à son type annoncé.
 */
export function checkImageFile(file: { type: string; size: number }, head: Uint8Array): AssetErrorCode | null {
  if (file.size === 0 || head.length === 0) return 'unreadable';
  if (file.size > MAX_IMPORT_BYTES) return 'too-large';
  if (file.type.includes('svg') || looksLikeMarkup(head)) return 'svg';
  return sniffImage(head) ? null : 'unsupported';
}

function sniffImage(head: Uint8Array): ImageKind | null {
  const starts = (...bytes: number[]): boolean => bytes.every((byte, i) => head[i] === byte);
  const ascii = (from: number, text: string): boolean => [...text].every((char, i) => head[from + i] === char.charCodeAt(0));
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (starts(0xff, 0xd8, 0xff)) return 'jpeg';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return 'gif';
  return null;
}

/** Texte qui commence par « < » (SVG, XML, HTML), après d'éventuels espaces ou BOM. */
function looksLikeMarkup(head: Uint8Array): boolean {
  const text = new TextDecoder().decode(head).replace(/^﻿/, '').trimStart();
  return text.startsWith('<');
}

/** Taille gardée : long côté ramené à 2 fois celui du format (3840 px au plus), jamais agrandi. */
export function importSize(image: { width: number; height: number }, format: VideoFormat): { width: number; height: number } {
  const limit = Math.min(MAX_IMPORT_SIDE, 2 * Math.max(format.width, format.height));
  const scale = Math.min(1, limit / Math.max(image.width, image.height));
  return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
}

/** Image prête à rejoindre le magasin d'assets. */
export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  thumbnail: string | null;
}

/**
 * Décode (`createImageBitmap`, sans bloquer l'interface ; un GIF donne sa première image), réduit
 * et compresse une image vérifiée. Navigateur uniquement ; rejette si l'image est illisible.
 */
export async function processImage(file: Blob, format: VideoFormat): Promise<ProcessedImage> {
  const probe = await createImageBitmap(file);
  const size = importSize(probe, format);
  probe.close();
  const bitmap = await createImageBitmap(file, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' });
  try {
    const blob = await encode(bitmap, size, 'image/webp');
    return { blob, width: size.width, height: size.height, mimeType: blob.type, thumbnail: await thumbnailOf(bitmap) };
  } finally {
    bitmap.close();
  }
}

/**
 * `processImage` dans un Worker (le redimensionnement de `createImageBitmap` bloque le fil
 * principal de Chrome une demi-seconde pour 12 mégapixels) ; sur place si les Workers manquent.
 */
export function processImageOffThread(file: Blob, format: VideoFormat): Promise<ProcessedImage> {
  if (typeof Worker !== 'function' || typeof OffscreenCanvas !== 'function') return processImage(file, format);
  const worker = new Worker(new URL('./image-worker.ts', import.meta.url), { type: 'module' });
  return new Promise<ProcessedImage>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<{ image?: ProcessedImage; error?: string }>) => {
      if (data.image) resolve(data.image);
      else reject(new Error(data.error ?? 'Image illisible'));
    };
    worker.onerror = () => reject(new Error('Image illisible'));
    worker.postMessage({ id: 1, file, format });
  }).finally(() => worker.terminate());
}

/** Encode en WebP ; un navigateur qui ne sait pas (Safari) rend du PNG : on passe alors en JPEG. */
async function encode(bitmap: ImageBitmap, size: { width: number; height: number }, type: string): Promise<Blob> {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponible');
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await canvas.convertToBlob({ type, quality: WEBP_QUALITY });
  return blob.type === type || type === 'image/jpeg' ? blob : encode(bitmap, size, 'image/jpeg');
}

async function thumbnailOf(bitmap: ImageBitmap): Promise<string | null> {
  try {
    const scale = THUMBNAIL_SIDE / Math.max(bitmap.width, bitmap.height);
    const size = { width: Math.max(1, Math.round(bitmap.width * scale)), height: Math.max(1, Math.round(bitmap.height * scale)) };
    const blob = await encode(bitmap, size, 'image/jpeg');
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
