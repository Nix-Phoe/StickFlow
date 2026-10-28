import { describe, expect, it } from 'vitest';

import { createEventBus, type AppEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { createInitialState, Store } from '../core/store';
import type { ToolId, Vec2 } from '../core/types';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { connectShapeManipulation } from './shape-manipulation';

/** 800 × 400 px pour une hauteur de monde de 400 : 1 px = 1 unité, origine en (400, 200). */
const VIEWPORT = { width: 800, height: 400 };

function setup(tool: ToolId = 'rectangle') {
  const bus = createEventBus();
  const store = new Store(createInitialState('Test', sortSkeleton(createDefaultSkeleton())));
  connectIntents(bus, store);
  connectShapeManipulation({ bus, store });
  const fills: Vec2[] = [];
  bus.on('drawing:fill', ({ point }) => fills.push(point));
  bus.emit('editMode:change', { mode: 'environment' });
  bus.emit('tool:select', { tool });
  bus.emit('tool:settings', { color: '#ff0000', strokeWidth: 4, opacity: 1, filled: false });
  return {
    bus,
    store,
    fills,
    shapes: () => store.state.project.present.environment.shapes,
    session: () => store.state.session,
  };
}

interface Extra {
  shiftKey?: boolean;
  pointerType?: 'mouse' | 'touch';
}
const screen = (p: Vec2, extra: Extra = {}) => ({ pointerId: 1, x: p.x + 400, y: 200 - p.y, ...VIEWPORT, ...extra });
const down = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:down', screen(p, extra));
const move = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:move', screen(p, extra));
const up = (bus: AppEventBus, p: Vec2, extra?: Extra): void => bus.emit('stage:pointer:up', screen(p, extra));
const drag = (bus: AppEventBus, from: Vec2, to: Vec2, extra?: Extra): void => {
  down(bus, from, extra);
  move(bus, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, extra);
  move(bus, to, extra);
  up(bus, to, extra);
};

describe('connectShapeManipulation: drawing shapes', () => {
  it('draws a rectangle by dragging, with the tool settings, and selects it', () => {
    const { bus, shapes, session } = setup('rectangle');
    drag(bus, { x: 0, y: 0 }, { x: 40, y: -20 });
    expect(shapes()).toHaveLength(1);
    expect(shapes()[0]).toMatchObject({ kind: 'rectangle', x: 20, y: -10, width: 40, height: 20, stroke: '#ff0000', fill: null, strokeWidth: 4 });
    expect(session().selectedShapeId).toBe(shapes()[0]?.id);
  });

  it('fills the new shape when the tool is set to filled', () => {
    const { bus, shapes } = setup('triangle');
    bus.emit('tool:settings', { filled: true });
    drag(bus, { x: 0, y: 0 }, { x: 20, y: 20 });
    expect(shapes()[0]?.fill).toBe('#ff0000');
  });

  it('keeps the proportions with Maj', () => {
    const { bus, shapes } = setup('rectangle');
    drag(bus, { x: 0, y: 0 }, { x: 40, y: 10 }, { shiftKey: true });
    expect(shapes()[0]).toMatchObject({ width: 40, height: 40 });
  });

  it('draws a line from the start to the end point', () => {
    const { bus, shapes } = setup('line');
    drag(bus, { x: -10, y: 0 }, { x: 30, y: 0 });
    expect(shapes()[0]).toMatchObject({ kind: 'line', x: 10, y: 0, width: 40, fill: null });
  });

  it('creates nothing for a simple click', () => {
    const { bus, shapes } = setup('square');
    down(bus, { x: 0, y: 0 });
    up(bus, { x: 0, y: 0 });
    expect(shapes()).toEqual([]);
  });

  it('undoes a drawn shape in one step', () => {
    const { bus, shapes } = setup('circle');
    drag(bus, { x: 0, y: 0 }, { x: 30, y: 30 });
    bus.emit('history:undo');
    expect(shapes()).toEqual([]);
  });
});

describe('connectShapeManipulation: selecting and editing', () => {
  const withBox = (tool: ToolId = 'select') => {
    const context = setup('rectangle');
    drag(context.bus, { x: -20, y: -10 }, { x: 20, y: 10 });
    context.bus.emit('tool:select', { tool });
    return context;
  };

  it('selects the topmost shape under the pointer, and nothing in empty space', () => {
    const { bus, session, shapes } = withBox();
    bus.emit('shape:select', { shapeId: null });
    down(bus, { x: 5, y: 5 });
    up(bus, { x: 5, y: 5 });
    expect(session().selectedShapeId).toBe(shapes()[0]?.id);
    down(bus, { x: 200, y: 150 });
    expect(session().selectedShapeId).toBeNull();
  });

  it('moves a shape by dragging it, in one undo step', () => {
    const { bus, shapes } = withBox();
    drag(bus, { x: 0, y: 0 }, { x: 30, y: 15 });
    expect(shapes()[0]).toMatchObject({ x: 30, y: 15 });
    bus.emit('history:undo');
    expect(shapes()[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('resizes the selected shape by a corner handle', () => {
    const { bus, shapes } = withBox();
    drag(bus, { x: 20, y: 10 }, { x: 30, y: 20 });
    expect(shapes()[0]).toMatchObject({ x: 5, y: 5, width: 50, height: 30 });
  });

  it('rotates the selected shape by its rotation handle', () => {
    const { bus, shapes } = withBox();
    const handle = { x: 0, y: 10 + 28 };
    drag(bus, handle, { x: 40, y: 0 });
    expect(shapes()[0]?.rotation).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('lets a shape tool move the selected shape instead of drawing over it', () => {
    const { bus, shapes } = withBox('square');
    drag(bus, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(shapes()).toHaveLength(1);
    expect(shapes()[0]?.x).toBe(10);
  });

  it('ignores the stage in the Personnages mode, while playing, or with the eyedropper', () => {
    const { bus, shapes } = setup('rectangle');
    bus.emit('editMode:change', { mode: 'characters' });
    drag(bus, { x: 0, y: 0 }, { x: 40, y: 40 });
    bus.emit('editMode:change', { mode: 'environment' });
    bus.emit('eyedropper:start');
    drag(bus, { x: 0, y: 0 }, { x: 40, y: 40 });
    bus.emit('eyedropper:cancel');
    bus.emit('playback:play');
    drag(bus, { x: 0, y: 0 }, { x: 40, y: 40 });
    expect(shapes()).toEqual([]);
  });
});

describe('connectShapeManipulation: fill', () => {
  it('fills the shape under the pointer with the tool colour', () => {
    const context = setup('rectangle');
    drag(context.bus, { x: -20, y: -10 }, { x: 20, y: 10 });
    context.bus.emit('tool:select', { tool: 'fill' });
    context.bus.emit('tool:settings', { color: '#00ff00' });
    down(context.bus, { x: 0, y: 0 });
    expect(context.shapes()[0]?.fill).toBe('#00ff00');
    expect(context.fills).toEqual([]);
  });

  it('asks for a flood fill of the drawing layer elsewhere', () => {
    const { bus, fills } = setup('fill');
    down(bus, { x: 100, y: 50 });
    expect(fills).toEqual([{ x: 100, y: 50 }]);
  });
});
