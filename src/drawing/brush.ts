// Outils de dessin à main levée : chaque trait devient une suite de « tampons » ronds, espacés
// assez finement pour former une ligne continue. Le tracé est lissé (moyenne glissante), et la
// largeur dépend de l'outil : fixe (stylo fin, feutre, gomme), selon la vitesse ou la pression
// (pinceau), selon la direction (plume) ; l'aérographe pulvérise de fines gouttes. Pur.

import type { DrawingTool, ToolSettings } from '../core/types';
import { DRAWING_LAYER, type PixelRect } from '../model/drawing-layer';

/** Échantillon du pointeur, en pixels du calque (y vers le bas). */
export interface StrokeSample {
  x: number;
  y: number;
  /** Millisecondes. */
  time: number;
  /** 0 à 1 ; 0,5 quand l'appareil ne mesure pas la pression (souris). */
  pressure: number;
}

/** Tampon rond, en pixels du calque. */
export interface Dab {
  x: number;
  y: number;
  radius: number;
  /** Opacité propre du tampon (l'opacité du trait est appliquée à l'ensemble, sauf pour l'aérographe). */
  alpha: number;
}

export interface Stroke {
  /** Gomme : les tampons effacent le calque. */
  erases: boolean;
  /** Aérographe : les gouttes s'accumulent, chacune avec sa propre opacité. */
  accumulates: boolean;
  /** Ajoute un échantillon ; renvoie les tampons à peindre depuis le précédent. */
  add(sample: StrokeSample): Dab[];
}

export interface StrokeOptions {
  pixelsPerUnit?: number;
  /** Hasard de l'aérographe (injectable pour les tests). */
  random?: () => number;
}

/** Poids du nouveau point dans la moyenne glissante (1 = aucun lissage). */
const SMOOTHING = 0.5;
/** Pression rapportée par une souris : elle ne veut rien dire. */
const NEUTRAL_PRESSURE = 0.5;
/** Angle de la plume (45°, comme une plume tenue de la main droite). */
const NIB_ANGLE = Math.PI / 4;
const AIRBRUSH_SPECKS = 8;
const AIRBRUSH_ALPHA = 0.12;

/** Largeur relative de chaque outil. */
const TIP_SCALE: Record<DrawingTool, number> = { pen: 0.4, marker: 1, brush: 1, eraser: 1, nib: 1, airbrush: 1 };

export function createStroke(
  tool: DrawingTool,
  settings: Pick<ToolSettings, 'strokeWidth' | 'opacity'>,
  { pixelsPerUnit = DRAWING_LAYER.pixelsPerUnit, random = Math.random }: StrokeOptions = {},
): Stroke {
  const baseRadius = (settings.strokeWidth * pixelsPerUnit * TIP_SCALE[tool]) / 2;
  let last: StrokeSample | null = null;
  let factor = 1;
  let direction: number | null = null;
  /** Distance parcourue depuis le dernier tampon. */
  let carry = 0;

  /** Facteur de largeur de l'outil pour un déplacement (`dx`, `dy`) en `dt` ms. */
  function widthFactor(sample: StrokeSample, dx: number, dy: number, dt: number): number {
    switch (tool) {
      case 'brush': {
        // La pression d'un stylet, sinon la vitesse : plus on va vite, plus le trait s'affine.
        const target =
          sample.pressure !== NEUTRAL_PRESSURE
            ? 0.2 + 1.2 * sample.pressure
            : Math.min(1.25, Math.max(0.3, 1.25 - (Math.hypot(dx, dy) / Math.max(dt, 1)) * 0.35));
        return factor + (target - factor) * 0.5;
      }
      case 'nib': {
        if (dx === 0 && dy === 0) return factor;
        const angle = Math.atan2(dy, dx);
        direction = direction === null ? angle : direction + angleDelta(direction, angle) * 0.5;
        return 0.15 + 0.85 * Math.abs(Math.sin(direction - NIB_ANGLE));
      }
      default:
        return 1;
    }
  }

  function dabsAt(x: number, y: number, radius: number): Dab[] {
    if (tool !== 'airbrush') return [{ x, y, radius, alpha: 1 }];
    const speck = Math.max(0.6, radius * 0.08);
    return Array.from({ length: AIRBRUSH_SPECKS }, () => {
      const angle = random() * 2 * Math.PI;
      const distance = radius * Math.sqrt(random());
      return { x: x + distance * Math.cos(angle), y: y + distance * Math.sin(angle), radius: speck, alpha: AIRBRUSH_ALPHA * settings.opacity };
    });
  }

  return {
    erases: tool === 'eraser',
    accumulates: tool === 'airbrush',
    add(sample) {
      if (!last) {
        last = sample;
        if (tool === 'nib') factor = 0.5;
        return dabsAt(sample.x, sample.y, Math.max(0.5, baseRadius * factor));
      }
      const from = last;
      const to = { ...sample, x: from.x + (sample.x - from.x) * SMOOTHING, y: from.y + (sample.y - from.y) * SMOOTHING };
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      const previousFactor = factor;
      factor = widthFactor(sample, sample.x - from.x, sample.y - from.y, sample.time - from.time);
      last = to;

      const dabs: Dab[] = [];
      let travelled = -carry;
      for (;;) {
        const radius = Math.max(0.5, baseRadius * factor);
        const spacing = Math.max(0.5, radius / 2);
        if (travelled + spacing > length) {
          carry = length - travelled;
          break;
        }
        travelled += spacing;
        const t = length === 0 ? 1 : travelled / length;
        const r = Math.max(0.5, baseRadius * (previousFactor + (factor - previousFactor) * t));
        dabs.push(...dabsAt(from.x + dx * t, from.y + dy * t, Math.min(r, radius)));
      }
      return dabs;
    },
  };
}

/** Rectangle de pixels qui contient tous les tampons ; `null` sans tampon. */
export function dabsBounds(dabs: readonly Dab[]): PixelRect | null {
  if (dabs.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y, radius } of dabs) {
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + radius);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Plus petit écart signé de `from` à `to`, dans (-π, π]. */
function angleDelta(from: number, to: number): number {
  const delta = (to - from) % (2 * Math.PI);
  return delta > Math.PI ? delta - 2 * Math.PI : delta <= -Math.PI ? delta + 2 * Math.PI : delta;
}
