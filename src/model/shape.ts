// Géométrie des formes du décor : création par glisser, test de toucher, poignées,
// déplacement, redimensionnement et rotation. Pur, en unités du monde (y vers le haut).

import type { Shape, ShapeKind, Vec2 } from '../core/types';

/** Distance entre le bord haut d'une forme et sa poignée de rotation. */
export const ROTATE_HANDLE_OFFSET = 28;
/** Pas de rotation avec Maj, et pas d'orientation d'une ligne avec Maj. */
const ROTATION_SNAP = Math.PI / 12;
const LINE_SNAP = Math.PI / 4;

export type ShapeGeometry = Pick<Shape, 'x' | 'y' | 'width' | 'height' | 'rotation'>;
export type ShapeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'rotate' | 'start' | 'end';

/** Carré et cercle gardent toujours leurs proportions. */
const isProportional = (kind: ShapeKind): boolean => kind === 'square' || kind === 'circle';

const snap = (angle: number, step: number): number => Math.round(angle / step) * step;

/**
 * Forme tracée en glissant de `start` à `end`. Une ligne relie les deux points (Maj : par pas
 * de 45°) ; les autres formes remplissent la boîte du glisser (Maj, ou carré et cercle : boîte carrée).
 */
export function shapeFromDrag(kind: ShapeKind, start: Vec2, end: Vec2, constrain: boolean): ShapeGeometry {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (kind === 'line') {
    const length = Math.hypot(dx, dy);
    const rotation = constrain ? snap(Math.atan2(dy, dx), LINE_SNAP) : Math.atan2(dy, dx);
    const to = constrain ? { x: start.x + length * Math.cos(rotation), y: start.y + length * Math.sin(rotation) } : end;
    return { x: (start.x + to.x) / 2, y: (start.y + to.y) / 2, width: length, height: 0, rotation };
  }
  let width = Math.abs(dx);
  let height = Math.abs(dy);
  if (constrain || isProportional(kind)) width = height = Math.max(width, height);
  return {
    x: start.x + (Math.sign(dx) || 1) * (width / 2),
    y: start.y + (Math.sign(dy) || 1) * (height / 2),
    width,
    height,
    rotation: 0,
  };
}

// ---------- Repère de la forme ----------

/** Point du monde → repère de la forme (centre à l'origine, sans rotation). */
export function toLocal(shape: ShapeGeometry, point: Vec2): Vec2 {
  const cos = Math.cos(shape.rotation);
  const sin = Math.sin(shape.rotation);
  const dx = point.x - shape.x;
  const dy = point.y - shape.y;
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** Repère de la forme → monde. */
export function toWorld(shape: ShapeGeometry, local: Vec2): Vec2 {
  const cos = Math.cos(shape.rotation);
  const sin = Math.sin(shape.rotation);
  return { x: shape.x + local.x * cos - local.y * sin, y: shape.y + local.x * sin + local.y * cos };
}

/** Sommets du triangle (isocèle, pointe en haut), dans le repère de la forme. */
export function triangleVertices({ width, height }: ShapeGeometry): [Vec2, Vec2, Vec2] {
  return [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: 0, y: height / 2 },
  ];
}

// ---------- Test de toucher ----------

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** Distance signée au bord de la forme (négative à l'intérieur), dans son repère. */
function signedDistance(shape: Shape, p: Vec2): number {
  const hw = shape.width / 2;
  const hh = shape.height / 2;
  switch (shape.kind) {
    case 'line':
      return distanceToSegment(p, { x: -hw, y: 0 }, { x: hw, y: 0 });
    case 'square':
    case 'rectangle': {
      const qx = Math.abs(p.x) - hw;
      const qy = Math.abs(p.y) - hh;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
    }
    case 'circle': {
      // Ellipse : distance approchée, exacte pour un cercle.
      const radius = Math.min(hw, hh) || 1;
      return (Math.hypot(p.x / (hw || 1), p.y / (hh || 1)) - 1) * radius;
    }
    case 'triangle': {
      const [a, b, c] = triangleVertices(shape);
      const edge = Math.min(distanceToSegment(p, a, b), distanceToSegment(p, b, c), distanceToSegment(p, c, a));
      const cross = (u: Vec2, v: Vec2): number => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
      const inside = cross(a, b) >= 0 && cross(b, c) >= 0 && cross(c, a) >= 0;
      return inside ? -edge : edge;
    }
  }
}

/**
 * La forme est-elle sous `point` ? Son intérieur compte (même sans remplissage, pour la saisir
 * facilement), et son trait aussi, à `tolerance` près.
 */
export function hitShape(shape: Shape, point: Vec2, tolerance: number): boolean {
  return signedDistance(shape, toLocal(shape, point)) <= shape.strokeWidth / 2 + tolerance;
}

/** Forme la plus au-dessus (la dernière) sous `point` ; `null` si aucune. */
export function pickShape(shapes: readonly Shape[], point: Vec2, tolerance: number): string | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const shape = shapes[i];
    if (shape && hitShape(shape, point, tolerance)) return shape.id;
  }
  return null;
}

// ---------- Poignées ----------

const CORNERS: ReadonlyArray<readonly [ShapeHandle, number, number]> = [
  ['nw', -1, 1],
  ['ne', 1, 1],
  ['se', 1, -1],
  ['sw', -1, -1],
];

/** Poignées de la forme sélectionnée : les deux bouts d'une ligne, ou 4 coins et la rotation. */
export function shapeHandles(shape: Shape): Array<{ handle: ShapeHandle; position: Vec2 }> {
  const hw = shape.width / 2;
  const hh = shape.height / 2;
  if (shape.kind === 'line') {
    return [
      { handle: 'start', position: toWorld(shape, { x: -hw, y: 0 }) },
      { handle: 'end', position: toWorld(shape, { x: hw, y: 0 }) },
    ];
  }
  return [
    ...CORNERS.map(([handle, sx, sy]) => ({ handle, position: toWorld(shape, { x: sx * hw, y: sy * hh }) })),
    { handle: 'rotate', position: toWorld(shape, { x: 0, y: hh + ROTATE_HANDLE_OFFSET }) },
  ];
}

export function pickShapeHandle(shape: Shape, point: Vec2, tolerance: number): ShapeHandle | null {
  let best: ShapeHandle | null = null;
  let bestDistance = tolerance;
  for (const { handle, position } of shapeHandles(shape)) {
    const distance = Math.hypot(position.x - point.x, position.y - point.y);
    if (distance <= bestDistance) {
      best = handle;
      bestDistance = distance;
    }
  }
  return best;
}

/** Coins de la boîte tournée de la forme (sud-ouest, sud-est, nord-est, nord-ouest), dans le monde. */
export function shapeOutline(shape: ShapeGeometry): Vec2[] {
  const hw = shape.width / 2;
  const hh = shape.height / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((corner) => toWorld(shape, corner));
}

// ---------- Transformations ----------

export function moveShape(shape: ShapeGeometry, delta: Vec2): Pick<Shape, 'x' | 'y'> {
  return { x: shape.x + delta.x, y: shape.y + delta.y };
}

/**
 * Tire une poignée jusqu'à `point` : le coin opposé (ou l'autre bout d'une ligne) reste en place.
 * Carré, cercle et Maj gardent les proportions.
 */
export function resizeShape(shape: Shape, handle: ShapeHandle, point: Vec2, constrain: boolean): Partial<ShapeGeometry> {
  if (shape.kind === 'line') {
    const [start, end] = shapeHandles(shape).map((h) => h.position) as [Vec2, Vec2];
    const fixed = handle === 'start' ? end : start;
    const moved = { x: point.x, y: point.y };
    const from = handle === 'start' ? moved : fixed;
    const to = handle === 'start' ? fixed : moved;
    return shapeFromDrag('line', from, to, constrain);
  }
  const corner = CORNERS.find(([name]) => name === handle);
  if (!corner) return {};
  const [, sx, sy] = corner;
  const anchor = { x: (-sx * shape.width) / 2, y: (-sy * shape.height) / 2 };
  const local = toLocal(shape, point);
  let width = Math.max(0, (local.x - anchor.x) * sx);
  let height = Math.max(0, (local.y - anchor.y) * sy);
  if (constrain || isProportional(shape.kind)) {
    const ratio = shape.height > 0 ? shape.width / shape.height : 1;
    const scale = Math.max(width / (shape.width || 1), height / (shape.height || 1));
    width = shape.width > 0 ? shape.width * scale : height * ratio;
    height = shape.height > 0 ? shape.height * scale : width / ratio;
  }
  const center = toWorld(shape, { x: anchor.x + (sx * width) / 2, y: anchor.y + (sy * height) / 2 });
  return { x: center.x, y: center.y, width, height };
}

/** Rotation qui oriente la poignée (au-dessus de la forme) vers `point` ; Maj : par pas de 15°. */
export function rotateShape(shape: ShapeGeometry, point: Vec2, constrain: boolean): number {
  const angle = Math.atan2(point.y - shape.y, point.x - shape.x) - Math.PI / 2;
  return constrain ? snap(angle, ROTATION_SNAP) : angle;
}
