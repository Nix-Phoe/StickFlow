// Ce que la scène dessine pour une frame, couche par couche, dans l'ordre :
// calque de dessin → formes → pelure d'oignon → contour des parties choisies → personnages
// → cadres de sélection → poignées. Le contexte inactif est atténué ; le rendu final
// (lecture, export) ne montre aucune aide d'édition. Pur.

import type { Session } from '../core/session';
import type { Character, EditorMode, FramePose, Project, Shape } from '../core/types';
import { characterBounds, posedCharacter, type Bounds } from '../model/character';
import type { SequenceFrame } from '../model/sequence';
import { shapeHandles, shapeOutline } from '../model/shape';
import { parseHexColor, type Rgba } from './color';
import {
  buildCapsules,
  buildHandles,
  DEFAULT_HANDLE_STYLE,
  DEFAULT_STICKMAN_STYLE,
  type Capsule,
  type ColoredCapsule,
  type ShapeInstance,
} from './scene';

/** Opacité du contexte inactif (décor en mode Personnages, personnages en mode Environnement). */
export const DIMMED_OPACITY = 0.4;
const ONION_SKIN_OPACITY = 0.22;
const HALO_OPACITY = 0.25;
const JOINT_OPACITY = 0.85;
const FRAME_OPACITY = 0.55;
/** Épaisseur du contour d'accent d'une partie sélectionnée, et des cadres de sélection. */
const HIGHLIGHT_WIDTH = 3;
const FRAME_LINE_RADIUS = 0.75;
const FRAME_PADDING = 8;
const SHAPE_HANDLE_RADIUS = 5;

export type CapsuleRole = 'onion' | 'highlight' | 'characters' | 'frame' | 'handles';

export type SceneLayer =
  | { kind: 'drawing'; opacity: number }
  | { kind: 'shapes'; shapes: ShapeInstance[] }
  | { kind: 'capsules'; role: CapsuleRole; capsules: ColoredCapsule[] };

export interface SceneLayersInput {
  project: Project;
  frame: SequenceFrame | null;
  /** Frame précédente à montrer en pelure d'oignon. */
  onion: SequenceFrame | null;
  /** Contexte d'édition ; `null` = rendu final : rien d'atténué, aucune aide d'édition. */
  mode: EditorMode | null;
  selection: Pick<Session, 'selectedCharacterId' | 'selectedNodeId' | 'selectedParts' | 'selectedShapeId'>;
  palette: { stickman: Rgba; accent: Rgba };
}

export function buildSceneLayers({ project, frame, onion, mode, selection, palette }: SceneLayersInput): SceneLayer[] {
  const decorOpacity = mode === 'characters' ? DIMMED_OPACITY : 1;
  const characterOpacity = mode === 'environment' ? DIMMED_OPACITY : 1;
  const visible = project.characters.filter((c) => c.visible);
  const posesIn = (f: SequenceFrame | null) =>
    visible.flatMap((character) => {
      const pose = f?.poses[character.id];
      return pose ? [{ character, pose }] : [];
    });

  const layers: SceneLayer[] = [
    { kind: 'drawing', opacity: decorOpacity },
    { kind: 'shapes', shapes: project.environment.shapes.map((s) => shapeInstance(s, decorOpacity)) },
    {
      kind: 'capsules',
      role: 'onion',
      capsules: posesIn(onion).flatMap(({ character, pose }) =>
        characterCapsules(character, pose, () => withOpacity(palette.stickman, ONION_SKIN_OPACITY * characterOpacity)),
      ),
    },
  ];
  const characters: SceneLayer = {
    kind: 'capsules',
    role: 'characters',
    capsules: posesIn(frame).flatMap(({ character, pose }) =>
      characterCapsules(character, pose, (nodeId) => withOpacity(partRgba(character, nodeId, palette.stickman), characterOpacity)),
    ),
  };
  if (mode === null) return [...layers, characters];

  const highlight: ColoredCapsule[] = [];
  const frames: ColoredCapsule[] = [];
  const handles: ColoredCapsule[] = [];
  const accent = palette.accent;

  const selected = posesIn(frame).find(({ character }) => character.id === selection.selectedCharacterId && !character.locked);
  if (mode === 'characters' && selected) {
    const { character, pose } = selected;
    const posed = posedCharacter(character, pose);
    const scale = character.appearance.scale;
    for (const capsule of buildCapsules(character.skeleton, posed, DEFAULT_STICKMAN_STYLE, scale)) {
      if (selection.selectedParts.includes(capsule.nodeId)) {
        highlight.push({ ...capsule, radius: capsule.radius + HIGHLIGHT_WIDTH, color: accent });
      }
    }
    const markers = buildHandles(character.skeleton, posed, selection.selectedNodeId, DEFAULT_HANDLE_STYLE);
    highlight.push(...colored(markers.halo, withOpacity(accent, HALO_OPACITY)));
    handles.push(
      ...colored(markers.joints, withOpacity(accent, JOINT_OPACITY)),
      ...colored(markers.root, accent),
      ...colored(markers.selected, accent),
    );
    frames.push(...boxLines(padded(characterBounds(character, pose, DEFAULT_STICKMAN_STYLE.strokeWidth)), withOpacity(accent, FRAME_OPACITY)));
  }

  const shape = project.environment.shapes.find((s) => s.id === selection.selectedShapeId);
  if (mode === 'environment' && shape) {
    const color = withOpacity(accent, FRAME_OPACITY);
    const outline = shape.kind === 'line' ? [] : shapeOutline(shape);
    frames.push(...outline.map((a, i) => line(a, outline[(i + 1) % outline.length] ?? a, color)));
    const points = shapeHandles(shape);
    const rotate = points.find((p) => p.handle === 'rotate');
    if (rotate) frames.push(line({ x: shape.x, y: shape.y }, rotate.position, color));
    frames.push(...points.map(({ position }) => ({ a: position, b: position, radius: SHAPE_HANDLE_RADIUS, color: accent })));
  }

  return [
    ...layers,
    { kind: 'capsules', role: 'highlight', capsules: highlight },
    characters,
    { kind: 'capsules', role: 'frame', capsules: frames },
    { kind: 'capsules', role: 'handles', capsules: handles },
  ];
}

// ---------- Aides ----------

function characterCapsules(character: Character, pose: FramePose, colorOf: (nodeId: string) => Rgba): ColoredCapsule[] {
  const capsules = buildCapsules(character.skeleton, posedCharacter(character, pose), DEFAULT_STICKMAN_STYLE, character.appearance.scale);
  return capsules.map(({ nodeId, ...capsule }) => ({ ...capsule, color: colorOf(nodeId) }));
}

function partRgba(character: Character, nodeId: string, fallback: Rgba): Rgba {
  const hex = character.appearance.segmentColors[nodeId] ?? character.appearance.defaultColor;
  return hex ? parseHexColor(hex) : fallback;
}

function shapeInstance(shape: Shape, opacity: number): ShapeInstance {
  const alpha = shape.opacity * opacity;
  return {
    kind: shape.kind,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    rotation: shape.rotation,
    strokeWidth: shape.strokeWidth,
    fill: shape.fill === null || shape.kind === 'line' ? null : withOpacity(parseHexColor(shape.fill), alpha),
    stroke: withOpacity(parseHexColor(shape.stroke), alpha),
  };
}

function colored(capsules: readonly Capsule[], color: Rgba): ColoredCapsule[] {
  return capsules.map((c) => ({ ...c, color }));
}

function line(a: { x: number; y: number }, b: { x: number; y: number }, color: Rgba): ColoredCapsule {
  return { a, b, radius: FRAME_LINE_RADIUS, color };
}

function padded(b: Bounds): Bounds {
  return { minX: b.minX - FRAME_PADDING, minY: b.minY - FRAME_PADDING, maxX: b.maxX + FRAME_PADDING, maxY: b.maxY + FRAME_PADDING };
}

function boxLines({ minX, minY, maxX, maxY }: Bounds, color: Rgba): ColoredCapsule[] {
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  return corners.map((a, i) => line(a, corners[(i + 1) % 4] ?? a, color));
}

export function withOpacity([r, g, b, a]: Rgba, opacity: number): Rgba {
  return [r, g, b, a * opacity];
}
