// Manipulation des personnages sur la scène (mode Personnages) : traduit le pointeur et le
// clavier en sélection (personnage, partie, nœud) et en nouvelles poses de la frame active.
// Sans DOM : écoute et émet sur le bus.

import type { AppEventBus, StagePointer } from '../core/events';
import { activeFrame } from '../core/selectors';
import type { Store } from '../core/store';
import type { Character, Vec2 } from '../core/types';
import { posedCharacter } from '../model/character';
import { pixelsToWorld, screenToWorld, stageWorldHeight } from '../render/camera';
import { pickCharacterTarget, type HitTolerance } from './hit-test';
import { startNodeDrag, type NodeDrag } from './node-drag';
import { cycleNode, nudgeNode } from './node-keys';

/** Rayon de saisie d'une poignée, en pixels CSS : plus large au doigt (cible de 44 px) qu'à la souris. */
export const HANDLE_HIT_RADIUS_PX = { touch: 22, precise: 12 } as const;
/** Marge autour du trait d'une partie, en pixels CSS. */
export const SEGMENT_HIT_MARGIN_PX = { touch: 14, precise: 6 } as const;

export interface CharacterManipulationOptions {
  bus: AppEventBus;
  store: Store;
}

export function connectCharacterManipulation({ bus, store }: CharacterManipulationOptions): () => void {
  let drag: { pointerId: number; characterId: string; session: NodeDrag } | null = null;

  /** Hauteur du monde de la scène : le cadre du format du projet, avec sa marge. */
  const worldHeight = (p: StagePointer): number => stageWorldHeight(p, store.state.project.present.format);
  const toWorld = (p: StagePointer): Vec2 => screenToWorld(p, p, worldHeight(p));
  /** La manipulation porte toujours sur la frame active (une frame générée devient image clé au premier geste). */
  const current = () => activeFrame(store.state)?.frame;
  const character = (id: string | null): Character | undefined =>
    store.state.project.present.characters.find((c) => c.id === id);

  function tolerance(pointer: StagePointer): HitTolerance {
    const kind = pointer.pointerType === 'touch' ? 'touch' : 'precise';
    const toUnits = (px: number): number => pixelsToWorld(px, pointer.height, worldHeight(pointer));
    return { handle: toUnits(HANDLE_HIT_RADIUS_PX[kind]), segment: toUnits(SEGMENT_HIT_MARGIN_PX[kind]) };
  }

  function onDown(pointer: StagePointer): void {
    const { session, project } = store.state;
    const frame = current();
    if (drag || !frame || session.isPlaying || session.eyedropper || session.editorMode !== 'characters') return;

    const point = toWorld(pointer);
    const hit = pickCharacterTarget(project.present, frame, point, tolerance(pointer), session.selectedCharacterId);
    if (!hit) {
      bus.emit('character:select', { characterId: null });
      return;
    }
    const additive = pointer.shiftKey === true;
    bus.emit('segment:select', { characterId: hit.characterId, nodeId: hit.nodeId, additive });
    // Maj + clic ne fait que changer la sélection des parties.
    if (additive) return;

    const target = character(hit.characterId);
    const pose = frame.poses[hit.characterId];
    if (!target || !pose) return;
    // Le cadre du personnage le déplace tout entier, comme sa racine.
    const nodeId = hit.nodeId ?? target.skeleton.find((n) => n.parentId === null)?.id;
    if (!nodeId) return;
    drag = {
      pointerId: pointer.pointerId,
      characterId: target.id,
      session: startNodeDrag(target.skeleton, posedCharacter(target, pose), pose, nodeId, point),
    };
  }

  function onMove(pointer: StagePointer): void {
    if (!drag || pointer.pointerId !== drag.pointerId) return;
    const frame = current();
    if (!frame) return;
    const { pose, rootPosition } = drag.session.update(toWorld(pointer));
    bus.emit('frame:pose:change', { frameId: frame.id, characterId: drag.characterId, pose: { ...pose }, rootPosition });
  }

  function onUp(pointer: StagePointer): void {
    if (drag && pointer.pointerId === drag.pointerId) drag = null;
  }

  /** Personnage visé au clavier : le sélectionné, sinon le premier qu'on peut manipuler. */
  function keyboardTarget(): Character | undefined {
    const { characters } = store.state.project.present;
    return character(store.state.session.selectedCharacterId) ?? characters.find((c) => c.visible && !c.locked);
  }

  const unsubscribers = [
    bus.on('stage:pointer:down', onDown),
    bus.on('stage:pointer:move', onMove),
    bus.on('stage:pointer:up', onUp),
    bus.on('playback:play', () => {
      drag = null;
    }),
    bus.on('node:cycle', ({ direction }) => {
      const target = keyboardTarget();
      if (!target || store.state.session.editorMode !== 'characters') return;
      const nodeId = cycleNode(target.skeleton, store.state.session.selectedNodeId, direction);
      bus.emit('segment:select', { characterId: target.id, nodeId, additive: false });
    }),
    bus.on('node:nudge', ({ radians }) => {
      const frame = current();
      const target = character(store.state.session.selectedCharacterId);
      const nodeId = store.state.session.selectedNodeId;
      const pose = target ? frame?.poses[target.id] : undefined;
      if (!frame || !target || !pose || !nodeId || store.state.session.isPlaying) return;
      bus.emit('frame:pose:change', {
        frameId: frame.id,
        characterId: target.id,
        pose: nudgeNode(pose.pose, target.skeleton, nodeId, radians),
        rootPosition: pose.rootPosition,
      });
    }),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
