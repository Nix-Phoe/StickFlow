// Arrière-plan de la scène (v2.1) : couleur, dégradé, arrière-plan intégré ou image du magasin
// d'assets. Fonctions pures : création, bornes, fusion des réglages, images utilisées.

import {
  BUILTIN_BACKGROUND_IDS,
  clamp,
  IMAGE_FITS,
  LIMITS,
  type Background,
  type BuiltinBackgroundId,
  type ImageBackground,
  type ImageCredit,
  type ImageFit,
  type Project,
} from '../core/types';
import { normalizeHex } from './color';

export { BUILTIN_BACKGROUND_IDS };

export const BACKGROUND_LIMITS = {
  zoom: LIMITS.backgroundZoom,
  blur: LIMITS.backgroundBlur,
  brightness: LIMITS.backgroundBrightness,
} as const;

/** Réglages d'une image modifiables après coup (ni son type ni son image). */
export type ImageSettings = Omit<ImageBackground, 'type' | 'assetId' | 'credit'>;

/** Réglages modifiables de l'arrière-plan actuel, quel que soit son type. */
export type BackgroundPatch = Partial<ImageSettings> & Partial<{ color: string; from: string; to: string; angle: number }>;

/** Image qui remplit le cadre, centrée, à 100 %, sans effet. */
export function imageBackground(assetId: string, credit?: ImageCredit): ImageBackground {
  const background: ImageBackground = {
    type: 'image',
    assetId,
    fit: 'cover',
    focus: { x: 0.5, y: 0.5 },
    zoom: 1,
    blur: 0,
    brightness: 1,
    opacity: 1,
    tint: null,
  };
  return credit ? { ...background, credit: { ...credit } } : background;
}

/**
 * Arrière-plan ramené dans ses bornes (couleurs normalisées, angle de 0 à 359°, réglages de
 * l'image bornés), sans champ inconnu ; `null` si on ne peut pas le réparer.
 */
export function normalizeBackground(background: Background): Background | null {
  switch (background.type) {
    case 'color': {
      const color = hex(background.color);
      return color ? { type: 'color', color } : null;
    }
    case 'gradient': {
      const from = hex(background.from);
      const to = hex(background.to);
      if (!from || !to) return null;
      const angle = Number.isFinite(background.angle) ? ((Math.round(background.angle) % 360) + 360) % 360 : 180;
      return { type: 'gradient', from, to, angle };
    }
    case 'builtin':
      return (BUILTIN_BACKGROUND_IDS as readonly string[]).includes(background.id)
        ? { type: 'builtin', id: background.id as BuiltinBackgroundId }
        : null;
    case 'image':
      return normalizeImage(background);
    default:
      return null;
  }
}

function normalizeImage(image: ImageBackground): ImageBackground | null {
  if (typeof image.assetId !== 'string' || image.assetId === '') return null;
  if (!(IMAGE_FITS as readonly string[]).includes(image.fit)) return null;
  const tintColor = image.tint ? hex(image.tint.color) : null;
  const normalized: ImageBackground = {
    type: 'image',
    assetId: image.assetId,
    fit: image.fit as ImageFit,
    focus: { x: bounded(image.focus?.x, 0, 1, 0.5), y: bounded(image.focus?.y, 0, 1, 0.5) },
    zoom: bounded(image.zoom, BACKGROUND_LIMITS.zoom.min, BACKGROUND_LIMITS.zoom.max, 1),
    blur: bounded(image.blur, BACKGROUND_LIMITS.blur.min, BACKGROUND_LIMITS.blur.max, 0),
    brightness: bounded(image.brightness, BACKGROUND_LIMITS.brightness.min, BACKGROUND_LIMITS.brightness.max, 1),
    opacity: bounded(image.opacity, 0, 1, 1),
    tint: image.tint && tintColor ? { color: tintColor, amount: bounded(image.tint.amount, 0, 1, 0) } : null,
  };
  const credit = image.credit;
  if (credit && typeof credit.author === 'string' && typeof credit.url === 'string' && typeof credit.provider === 'string') {
    normalized.credit = { author: credit.author, url: credit.url, provider: credit.provider };
  }
  return normalized;
}

/** Applique des réglages à l'arrière-plan actuel ; son type et son image ne changent jamais. */
export function mergeBackground(current: Background | null, patch: BackgroundPatch): Background | null {
  if (!current) return null;
  const merged = { ...current, ...patch, type: current.type } as Background;
  if (current.type === 'image') (merged as ImageBackground).assetId = current.assetId;
  return merged;
}

/** Images du magasin d'assets utilisées par le projet. */
export function backgroundAssetIds(project: Project): string[] {
  const { background } = project.environment;
  return background?.type === 'image' ? [background.assetId] : [];
}

function hex(value: unknown): string | null {
  return typeof value === 'string' ? normalizeHex(value) : null;
}

function bounded(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

/** Couleur unie de l'arrière-plan, s'il en est une (pipette de secours). */
export function solidColor(background: Background | null): string | null {
  return background?.type === 'color' ? background.color : null;
}
