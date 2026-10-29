/** Couleur RGBA, composantes entre 0 et 1 (non prémultipliées). */
export type Rgba = readonly [r: number, g: number, b: number, a: number];

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/;

/** Lit une couleur `#rgb`, `#rrggbb` ou `#rrggbbaa` (format des tokens CSS). */
export function parseHexColor(value: string): Rgba {
  const match = HEX_COLOR.exec(value.trim().toLowerCase());
  const digits = match?.[1];
  if (!digits) throw new SyntaxError(`Couleur hexadécimale invalide : « ${value} »`);

  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const channel = (i: number): number => parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
  return [channel(0), channel(1), channel(2), full.length === 8 ? channel(3) : 1];
}

/**
 * Couleurs des fichiers exportés et des vignettes enregistrées : indépendantes du thème de
 * l'interface, pour que le résultat soit le même en mode clair ou sombre. Les PNG exportés
 * gardent un fond transparent (incrustation).
 */
export const EXPORT_COLORS = { background: '#ffffff', stickman: '#1c1c1e' } as const;
