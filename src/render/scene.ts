// Géométrie de la scène : des nœuds posés aux capsules, et des formes aux instances, envoyées au GPU.

import type { ShapeKind, SkeletonNode, Vec2 } from '../core/types';
import type { PosedNode } from '../model/kinematics';
import type { Rgba } from './color';

/** Segment épais à bouts ronds ; `a === b` donne un disque. */
export interface Capsule {
  a: Vec2;
  b: Vec2;
  radius: number;
}

/** Capsule d'une partie du personnage (`nodeId` : le nœud qui termine le segment). */
export interface PartCapsule extends Capsule {
  nodeId: string;
}

export interface ColoredCapsule extends Capsule {
  /** RGBA non prémultiplié. */
  color: Rgba;
}

/** Forme prête à dessiner : géométrie, couleurs déjà multipliées par l'opacité (`fill` `null` : contour seul). */
export interface ShapeInstance {
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  strokeWidth: number;
  fill: Rgba | null;
  stroke: Rgba;
}

export interface StickmanStyle {
  /** Épaisseur des membres, en unités du monde. */
  strokeWidth: number;
}

export const DEFAULT_STICKMAN_STYLE: StickmanStyle = { strokeWidth: 9 };

/** Une capsule = départ (x, y), arrivée (x, y), rayon, couleur RGBA. Doit correspondre aux attributs du shader. */
export const FLOATS_PER_CAPSULE = 9;

/**
 * Une capsule par nœud de longueur non nulle, dans l'ordre du squelette
 * (les nœuds suivants sont dessinés par-dessus). `scale` (taille du personnage) épaissit les
 * traits et la tête ; les positions viennent de `posed`, déjà à la bonne taille.
 */
export function buildCapsules(
  skeleton: readonly SkeletonNode[],
  posed: readonly PosedNode[],
  style: StickmanStyle,
  scale = 1,
): PartCapsule[] {
  const byId = new Map(posed.map((p) => [p.id, p]));
  const capsules: PartCapsule[] = [];

  for (const node of skeleton) {
    const placed = byId.get(node.id);
    if (!placed) throw new Error(`Nœud non posé : ${node.id}`);
    if (node.length === 0) continue;

    if (node.shape === 'circle') {
      const center = { x: (placed.start.x + placed.end.x) / 2, y: (placed.start.y + placed.end.y) / 2 };
      capsules.push({ nodeId: node.id, a: center, b: center, radius: (node.length * scale) / 2 });
    } else {
      capsules.push({ nodeId: node.id, a: placed.start, b: placed.end, radius: (style.strokeWidth * scale) / 2 });
    }
  }
  return capsules;
}

export function packCapsules(capsules: readonly ColoredCapsule[]): Float32Array {
  const data = new Float32Array(capsules.length * FLOATS_PER_CAPSULE);
  capsules.forEach((c, i) => {
    data.set([c.a.x, c.a.y, c.b.x, c.b.y, c.radius, ...c.color], i * FLOATS_PER_CAPSULE);
  });
  return data;
}

/** Numéro de chaque sorte de forme dans le shader (`shape.frag.glsl`). */
export const SHAPE_KIND_INDEX: Record<ShapeKind, number> = { square: 0, circle: 1, rectangle: 2, triangle: 3, line: 4 };

/**
 * Une forme = centre (x, y), demi-taille (x, y), rotation, sorte, épaisseur, remplissage RGBA,
 * contour RGBA. Doit correspondre aux attributs de `shape.vert.glsl`.
 */
export const FLOATS_PER_SHAPE = 15;

const TRANSPARENT: Rgba = [0, 0, 0, 0];

export function packShapes(shapes: readonly ShapeInstance[]): Float32Array {
  const data = new Float32Array(shapes.length * FLOATS_PER_SHAPE);
  shapes.forEach((s, i) => {
    data.set(
      [s.x, s.y, s.width / 2, s.height / 2, s.rotation, SHAPE_KIND_INDEX[s.kind], s.strokeWidth, ...(s.fill ?? TRANSPARENT), ...s.stroke],
      i * FLOATS_PER_SHAPE,
    );
  });
  return data;
}

/** Tailles des poignées des nœuds, en unités du monde. */
export interface HandleStyle {
  jointRadius: number;
  rootRadius: number;
  selectedRadius: number;
  haloRadius: number;
}

export const DEFAULT_HANDLE_STYLE: HandleStyle = { jointRadius: 4.5, rootRadius: 7, selectedRadius: 7, haloRadius: 14 };

/** Poignées regroupées par couche de dessin (le halo passe sous le stickman, le reste dessus). */
export interface HandleLayers {
  halo: Capsule[];
  joints: Capsule[];
  root: Capsule[];
  selected: Capsule[];
}

/** Une poignée au bout de chaque nœud ; la racine et le nœud sélectionné sont mis en évidence. */
export function buildHandles(
  skeleton: readonly SkeletonNode[],
  posed: readonly PosedNode[],
  selectedNodeId: string | null,
  style: HandleStyle,
): HandleLayers {
  const disc = (center: Vec2, radius: number): Capsule => ({ a: center, b: center, radius });
  const byId = new Map(posed.map((p) => [p.id, p]));
  const layers: HandleLayers = { halo: [], joints: [], root: [], selected: [] };

  for (const node of skeleton) {
    const placed = byId.get(node.id);
    if (!placed) continue;
    if (node.parentId === null) layers.root.push(disc(placed.end, style.rootRadius));
    else layers.joints.push(disc(placed.end, style.jointRadius));
    if (node.id === selectedNodeId) {
      layers.halo.push(disc(placed.end, style.haloRadius));
      layers.selected.push(disc(placed.end, style.selectedRadius));
    }
  }
  return layers;
}
