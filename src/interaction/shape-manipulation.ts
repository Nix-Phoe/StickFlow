// Formes du décor sur la scène (mode Environnement) : tracer une forme par glisser, sélectionner,
// déplacer, redimensionner et faire tourner la forme sélectionnée, remplir. Sans DOM : écoute
// le pointeur sur le bus et émet des changements de formes (une étape d'annulation par geste).

import type { AppEventBus, StagePointer } from '../core/events';
import { createId } from '../core/id';
import type { Store } from '../core/store';
import type { Shape, ShapeKind, ToolId, Vec2 } from '../core/types';
import {
  moveShape,
  pickShape,
  pickShapeHandle,
  resizeShape,
  rotateShape,
  shapeFromDrag,
  type ShapeHandle,
} from '../model/shape';
import { pixelsToWorld, screenToWorld, stageWorldHeight } from '../render/camera';

/** Rayon de saisie d'une poignée de forme, et marge autour d'une forme, en pixels CSS. */
const HANDLE_RADIUS_PX = { touch: 22, precise: 12 } as const;
const SHAPE_MARGIN_PX = { touch: 14, precise: 4 } as const;
/** Distance à parcourir avant qu'un glisser ne trace une forme (un simple clic n'en crée pas). */
const CREATE_THRESHOLD_PX = 3;

const DRAWN_SHAPES: readonly ToolId[] = ['square', 'circle', 'rectangle', 'triangle', 'line'];

type Gesture =
  | { kind: 'create'; tool: ShapeKind; start: Vec2; shapeId: string | null }
  | { kind: 'move'; original: Shape; start: Vec2 }
  | { kind: 'resize'; original: Shape; handle: ShapeHandle }
  | { kind: 'rotate'; original: Shape };

export interface ShapeManipulationOptions {
  bus: AppEventBus;
  store: Store;
}

export function connectShapeManipulation({ bus, store }: ShapeManipulationOptions): () => void {
  /** `token` distingue chaque geste dans l'historique (un geste = une étape d'annulation). */
  let gesture: { pointerId: number; token: string; value: Gesture } | null = null;

  /** Hauteur du monde de la scène : le cadre du format du projet, avec sa marge. */
  const worldHeight = (p: StagePointer): number => stageWorldHeight(p, store.state.project.present.format);
  const toWorld = (p: StagePointer): Vec2 => screenToWorld(p, p, worldHeight(p));
  const toUnits = (p: StagePointer, px: number): number => pixelsToWorld(px, p.height, worldHeight(p));
  const precision = (p: StagePointer): 'touch' | 'precise' => (p.pointerType === 'touch' ? 'touch' : 'precise');
  const shapes = (): readonly Shape[] => store.state.project.present.environment.shapes;

  function onDown(pointer: StagePointer): void {
    const { session } = store.state;
    if (gesture || session.isPlaying || session.eyedropper || session.editorMode !== 'environment') return;
    const { tool } = session;
    const isShapeTool = tool === 'select' || tool === 'fill' || DRAWN_SHAPES.includes(tool);
    if (!isShapeTool) return;

    const point = toWorld(pointer);
    const margin = toUnits(pointer, SHAPE_MARGIN_PX[precision(pointer)]);
    const begin = (value: Gesture): void => {
      gesture = { pointerId: pointer.pointerId, token: createId(), value };
    };

    if (tool === 'fill') {
      const shapeId = pickShape(shapes(), point, margin);
      const shape = shapes().find((s) => s.id === shapeId);
      if (!shape) {
        bus.emit('drawing:fill', { point });
        return;
      }
      // Une ligne n'a pas d'intérieur : c'est son trait qui prend la couleur.
      const color = session.toolSettings.color;
      bus.emit('shape:update', { shapeId: shape.id, changes: shape.kind === 'line' ? { stroke: color } : { fill: color } });
      return;
    }

    // La forme sélectionnée garde la main : ses poignées, puis son intérieur.
    const selected = shapes().find((s) => s.id === session.selectedShapeId);
    if (selected) {
      const handle = pickShapeHandle(selected, point, toUnits(pointer, HANDLE_RADIUS_PX[precision(pointer)]));
      if (handle === 'rotate') return begin({ kind: 'rotate', original: selected });
      if (handle) return begin({ kind: 'resize', original: selected, handle });
      if (pickShape([selected], point, margin)) return begin({ kind: 'move', original: selected, start: point });
    }

    if (tool === 'select') {
      const shapeId = pickShape(shapes(), point, margin);
      bus.emit('shape:select', { shapeId });
      const shape = shapes().find((s) => s.id === shapeId);
      if (shape) begin({ kind: 'move', original: shape, start: point });
      return;
    }
    begin({ kind: 'create', tool: tool as ShapeKind, start: point, shapeId: null });
  }

  function onMove(pointer: StagePointer): void {
    if (!gesture || pointer.pointerId !== gesture.pointerId) return;
    const point = toWorld(pointer);
    const constrain = pointer.shiftKey === true;
    const { value, token } = gesture;
    const update = (shapeId: string, changes: Partial<Omit<Shape, 'id'>>): void =>
      bus.emit('shape:update', { shapeId, changes, gesture: token });
    switch (value.kind) {
      case 'create': {
        const geometry = shapeFromDrag(value.tool, value.start, point, constrain);
        if (value.shapeId) {
          update(value.shapeId, geometry);
          return;
        }
        if (Math.hypot(point.x - value.start.x, point.y - value.start.y) < toUnits(pointer, CREATE_THRESHOLD_PX)) return;
        const { color, strokeWidth, opacity, filled } = store.state.session.toolSettings;
        const shape: Shape = {
          id: createId(),
          kind: value.tool,
          ...geometry,
          stroke: color,
          fill: filled && value.tool !== 'line' ? color : null,
          strokeWidth,
          opacity,
        };
        value.shapeId = shape.id;
        bus.emit('shape:create', { shape, gesture: token });
        return;
      }
      case 'move':
        update(value.original.id, moveShape(value.original, { x: point.x - value.start.x, y: point.y - value.start.y }));
        return;
      case 'resize':
        update(value.original.id, resizeShape(value.original, value.handle, point, constrain));
        return;
      case 'rotate':
        update(value.original.id, { rotation: rotateShape(value.original, point, constrain) });
        return;
    }
  }

  function onUp(pointer: StagePointer): void {
    if (gesture && pointer.pointerId === gesture.pointerId) gesture = null;
  }

  const unsubscribers = [
    bus.on('stage:pointer:down', onDown),
    bus.on('stage:pointer:move', onMove),
    bus.on('stage:pointer:up', onUp),
    bus.on('playback:play', () => {
      gesture = null;
    }),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
