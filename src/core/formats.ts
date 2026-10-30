// Formats de la vidéo : préréglages (YouTube, Vertical, Carré, Portrait) ou taille libre (Personnalisé).
// Le format est enregistré dans le Projet ; il fixe le cadre de la scène et la résolution de l'export.
// Ce module est la seule liste des formats ; leurs noms et sous-titres sont dans `strings.formats`.

export type FormatPreset = 'youtube' | 'vertical' | 'square' | 'portrait' | 'custom';

export interface VideoFormat {
  preset: FormatPreset;
  /** Résolution de l'export, en pixels. */
  width: number;
  height: number;
}

/** Taille d'un format personnalisé, en pixels (de chaque côté). */
export const CUSTOM_FORMAT_LIMITS = { min: 256, max: 3840 } as const;

/** Préréglages dans l'ordre d'affichage ; « custom » prend la taille saisie. */
export const FORMAT_PRESETS: ReadonlyArray<{ id: FormatPreset; width: number; height: number }> = [
  { id: 'youtube', width: 1920, height: 1080 },
  { id: 'vertical', width: 1080, height: 1920 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'portrait', width: 1080, height: 1350 },
  { id: 'custom', width: 1280, height: 720 },
];

export function presetFormat(preset: FormatPreset, custom?: { width: number; height: number }): VideoFormat {
  const base = FORMAT_PRESETS.find((p) => p.id === preset) ?? FORMAT_PRESETS[0];
  if (preset !== 'custom' || !custom) return { preset: base?.id ?? 'youtube', width: base?.width ?? 1920, height: base?.height ?? 1080 };
  return { preset: 'custom', width: customSide(custom.width), height: customSide(custom.height) };
}

export const DEFAULT_FORMAT: VideoFormat = presetFormat('youtube');

/**
 * Format valide : un préréglage garde sa taille ; une taille libre est ramenée dans ses bornes, en
 * nombre pair de pixels (les encodeurs vidéo l'exigent). Préréglage inconnu = taille libre.
 */
export function normalizeFormat(format: { preset: string; width: number; height: number }): VideoFormat {
  const known = FORMAT_PRESETS.find((p) => p.id === format.preset);
  if (known && known.id !== 'custom') return presetFormat(known.id);
  if (!Number.isFinite(format.width) || !Number.isFinite(format.height)) return DEFAULT_FORMAT;
  return presetFormat('custom', format);
}

function customSide(value: number): number {
  const even = Math.round(value / 2) * 2;
  return Math.min(CUSTOM_FORMAT_LIMITS.max, Math.max(CUSTOM_FORMAT_LIMITS.min, even));
}

/** Largeur / hauteur. */
export function aspectRatio(format: VideoFormat): number {
  return format.width / format.height;
}

/** Rapport lisible : « 16:9 », ou « 2,18:1 » quand les nombres réduits sont trop grands. */
export function ratioLabel({ width, height }: VideoFormat): string {
  const divisor = gcd(width, height);
  const [w, h] = [width / divisor, height / divisor];
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  return `${(width / height).toFixed(2).replace('.', ',')}:1`;
}

export function sameFormat(a: VideoFormat, b: VideoFormat): boolean {
  return a.preset === b.preset && a.width === b.width && a.height === b.height;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
