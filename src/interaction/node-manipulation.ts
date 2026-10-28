// Manipulation des nœuds sur la scène : traduit le pointeur et le clavier en sélection
// et en nouvelles poses de la frame active. Sans DOM : écoute et émet sur le bus.

import type { AppEventBus, StagePointer } from '../core/events';
import { activeFrame } from '../core/selectors';
import type { Store } from '../core/store';
import type { Vec2 } from '../core/types';
import { solvePose } from '../model/kinematics';
import { pixelsToWorld, screenToWorld, STAGE_WORLD_HEIGHT } from '../render/camera';
import { startNodeDrag, type NodeDrag } from './node-drag';
import { cycleNode, nudgeNode } from './node-keys';
import { pickNode } from './picking';

/** Rayon de la zone de saisie d'une poignée, en pixels CSS (cible tactile de 44 px). */
export const HANDLE_HIT_RADIUS_PX = 22;

export interface NodeManipulationOptions {
  bus: AppEventBus;
  store: Store;
}

export function connectNodeManipulation({ bus, store }: NodeManipulationOptions): () => void {
  let drag: { pointerId: number; session: NodeDrag } | null = null;

  const toWorld = (p: StagePointer): Vec2 => screenToWorld(p, p, STAGE_WORLD_HEIGHT);

  /** La manipulation porte toujours sur la frame active (une frame générée devient image clé au premier geste). */
  const current = () => activeFrame(store.state)?.frame;

  function onDown(pointer: StagePointer): void {
    const frame = current();
    if (drag || store.state.session.isPlaying || !frame) return;

    const { skeleton } = store.state.project.present;
    const posed = solvePose(skeleton, frame.pose, frame.rootPosition);
    const point = toWorld(pointer);
    const nodeId = pickNode(posed, point, pixelsToWorld(HANDLE_HIT_RADIUS_PX, pointer.height, STAGE_WORLD_HEIGHT));

    bus.emit('node:select', { nodeId });
    if (nodeId) {
      drag = { pointerId: pointer.pointerId, session: startNodeDrag(skeleton, posed, frame, nodeId, point) };
    }
  }

  function onMove(pointer: StagePointer): void {
    if (!drag || pointer.pointerId !== drag.pointerId) return;
    const frame = current();
    if (!frame) return;
    const { pose, rootPosition } = drag.session.update(toWorld(pointer));
    bus.emit('frame:pose:change', { frameId: frame.id, pose: { ...pose }, rootPosition });
  }

  function onUp(pointer: StagePointer): void {
    if (drag && pointer.pointerId === drag.pointerId) drag = null;
  }

  const unsubscribers = [
    bus.on('stage:pointer:down', onDown),
    bus.on('stage:pointer:move', onMove),
    bus.on('stage:pointer:up', onUp),
    bus.on('playback:play', () => {
      drag = null;
    }),
    bus.on('node:cycle', ({ direction }) => {
      const { project, session } = store.state;
      bus.emit('node:select', { nodeId: cycleNode(project.present.skeleton, session.selectedNodeId, direction) });
    }),
    bus.on('node:nudge', ({ radians }) => {
      const frame = current();
      const nodeId = store.state.session.selectedNodeId;
      if (!frame || !nodeId || store.state.session.isPlaying) return;
      bus.emit('frame:pose:change', {
        frameId: frame.id,
        pose: nudgeNode(frame.pose, store.state.project.present.skeleton, nodeId, radians),
        rootPosition: frame.rootPosition,
      });
    }),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
