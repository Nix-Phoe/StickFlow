// Couleurs : format HEX normalisé, conversions HSV (roue chromatique) et harmonies. Pur.

import type { ColorHarmony } from '../core/types';

/** Teinte en degrés [0, 360), saturation et valeur dans [0, 1]. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** « #ABC », « abc », « #aabbcc » → « #aabbcc » ; `null` si ce n'est pas une couleur HEX. */
export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const digits = match[1].toLowerCase();
  return `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Couleur invalide : ${hex}`);
  const n = Number.parseInt(normalized.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const byte = (c: number): string => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = (((h % 360) + 360) % 360) / 60;
  const sat = Math.min(1, Math.max(0, s));
  const val = Math.min(1, Math.max(0, v));
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] =
    hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = val - chroma;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

/** Décalage des teintes harmoniques, en degrés, autour de la teinte principale. */
const HARMONY_OFFSETS: Record<ColorHarmony, readonly number[]> = {
  none: [],
  analogous: [-30, 30],
  complementary: [180],
  triadic: [120, 240],
};

/** Teintes qui accompagnent `hue` selon l'harmonie (sans la teinte principale). */
export function harmonyHues(hue: number, harmony: ColorHarmony): number[] {
  return HARMONY_OFFSETS[harmony].map((offset) => (((hue + offset) % 360) + 360) % 360);
}

/**
 * Point de la roue chromatique (rayon 1, y vers le haut) d'une teinte et d'une saturation :
 * la teinte est l'angle (rouge à droite, sens antihoraire), la saturation la distance au centre.
 */
export function wheelPoint(hue: number, saturation: number): { x: number; y: number } {
  const angle = (hue * Math.PI) / 180;
  const x = saturation * Math.cos(angle);
  const y = saturation * Math.sin(angle);
  // Évite les « -0 » et les poussières d'arrondi aux angles droits.
  const tidy = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);
  return { x: tidy(x), y: tidy(y) };
}

/** Teinte et saturation d'un point de la roue ; un point hors de la roue est ramené sur son bord. */
export function wheelHueSaturation({ x, y }: { x: number; y: number }): { h: number; s: number } {
  const s = Math.min(1, Math.hypot(x, y));
  if (s === 0) return { h: 0, s: 0 };
  const h = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { h, s };
}

/** Pastilles prédéfinies : blanc, gris, noir, puis les couleurs vives du système. */
export const PRESET_COLORS: readonly string[] = [
  '#ffffff',
  '#8e8e93',
  '#1c1c1e',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#007aff',
  '#af52de',
];
