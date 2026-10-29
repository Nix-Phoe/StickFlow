// Coloration partielle : zones de couleur le long d'une partie (manches, short, chaussures,
// cheveux…), tenues toutes faites et symétrie gauche / droite. Pur.

import { LIMITS, type Character, type ColorBand, type SkeletonNode } from '../core/types';
import { normalizeHex } from './color';

/** Tenues toutes faites : chacune pose une zone de la couleur choisie sur ses parties. */
export const OUTFITS = ['tshirt', 'sweater', 'shorts', 'trousers', 'shoes', 'hair'] as const;
export type Outfit = (typeof OUTFITS)[number];

type Range = { from: number; to: number };
const WHOLE: Range = { from: 0, to: 1 };

/** Parties de chaque tenue (ids du squelette par défaut) et la zone qu'elle y couvre. */
const OUTFIT_RANGES: Record<Outfit, Record<string, Range>> = {
  tshirt: { torso: WHOLE, upperArmL: { from: 0, to: 0.5 }, upperArmR: { from: 0, to: 0.5 } },
  sweater: { torso: WHOLE, upperArmL: WHOLE, upperArmR: WHOLE, forearmL: { from: 0, to: 0.85 }, forearmR: { from: 0, to: 0.85 } },
  shorts: { thighL: { from: 0, to: 0.7 }, thighR: { from: 0, to: 0.7 } },
  trousers: { thighL: WHOLE, thighR: WHOLE, shinL: { from: 0, to: 0.9 }, shinR: { from: 0, to: 0.9 } },
  shoes: { shinL: { from: 0.82, to: 1 }, shinR: { from: 0.82, to: 1 } },
  hair: { head: { from: 0.55, to: 1 } },
};

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Zones valides : bornes ramenées dans [0, 1], remises dans l'ordre et arrondies au centième,
 * couleur en #rrggbb. Les zones vides, sans couleur valide ou non numériques disparaissent ;
 * au-delà de `LIMITS.bandsPerPart`, seules les plus récentes (au-dessus) restent.
 */
export function normalizeBands(bands: readonly ColorBand[]): ColorBand[] {
  const valid = bands.flatMap((band) => {
    const color = normalizeHex(band.color);
    if (!color || !Number.isFinite(band.from) || !Number.isFinite(band.to)) return [];
    const a = round(Math.min(1, Math.max(0, band.from)));
    const b = round(Math.min(1, Math.max(0, band.to)));
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    return to > from ? [{ from, to, color }] : [];
  });
  return valid.slice(-LIMITS.bandsPerPart);
}

/**
 * Tronçons visibles d'une partie, du départ au bout : la couleur de base, recouverte par les
 * zones dans l'ordre (la dernière au-dessus). Deux tronçons voisins de même couleur fusionnent.
 */
export function bandStops(base: string, bands: readonly ColorBand[]): ColorBand[] {
  const cuts = [...new Set([0, 1, ...bands.flatMap((b) => [b.from, b.to])])].sort((x, y) => x - y);
  const stops: ColorBand[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const from = cuts[i] ?? 0;
    const to = cuts[i + 1] ?? 1;
    const middle = (from + to) / 2;
    const top = bands.findLast((b) => b.from <= middle && middle <= b.to);
    const color = top?.color ?? base;
    const previous = stops.at(-1);
    if (previous && previous.color === color) previous.to = to;
    else stops.push({ from, to, color });
  }
  return stops;
}

/** La même partie de l'autre côté (gauche ⇄ droite, d'après la fin de l'id), ou `null`. */
export function mirrorPart(nodeId: string, skeleton: readonly SkeletonNode[]): string | null {
  const side = nodeId.at(-1);
  if (side !== 'L' && side !== 'R') return null;
  const twin = `${nodeId.slice(0, -1)}${side === 'L' ? 'R' : 'L'}`;
  return skeleton.some((node) => node.id === twin) ? twin : null;
}

/**
 * Zones des parties après avoir enfilé `outfit` de la couleur `color` : la nouvelle zone passe
 * au-dessus des zones existantes, et celles qu'elle cache entièrement disparaissent.
 * Ne renvoie que les parties touchées (celles que le squelette possède).
 */
export function outfitBands(outfit: Outfit, character: Character, color: string): Record<string, ColorBand[]> {
  const result: Record<string, ColorBand[]> = {};
  for (const [nodeId, range] of Object.entries(OUTFIT_RANGES[outfit])) {
    if (!character.skeleton.some((node) => node.id === nodeId)) continue;
    const kept = (character.appearance.segmentBands[nodeId] ?? []).filter((b) => b.from < range.from || b.to > range.to);
    result[nodeId] = normalizeBands([...kept, { ...range, color }]);
  }
  return result;
}
