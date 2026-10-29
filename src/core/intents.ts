// Aiguillage sans règle : chaque événement de l'interface devient soit un changement nommé
// du Projet (avec l'heure, pour regrouper les gestes), soit une mise à jour de la Session.
// Les règles vivent dans le module Projet, dans la séquence dérivée et dans session.ts.

import { applyChange, recordRecentColor, redo, undo, type ProjectChange, type ProjectHistory } from '../model/project';
import { deriveSequence, type SequenceFrame } from '../model/sequence';
import type { AppEventBus } from './events';
import { createId } from './id';
import { activeFrame, sequenceOf } from './selectors';
import { clearSelection, fitSessionToSequence, selectPart, withPartialPaint, type Session } from './session';
import type { Store } from './store';
import { clamp, type FramePose } from './types';

export interface IntentOptions {
  /** Horloge en millisecondes (injectable pour les tests). */
  now?: () => number;
}

export function connectIntents(bus: AppEventBus, store: Store, { now = Date.now }: IntentOptions = {}): () => void {
  /** Remplace l'historique du Projet puis recale la Session sur le nouveau Projet. */
  function setProject(next: ProjectHistory, patch: Partial<Session> = {}): void {
    const { project, session } = store.state;
    if (next === project) return;
    const fitted = fitSessionToSequence(
      { ...session, ...patch },
      deriveSequence(project.present),
      deriveSequence(next.present),
      next.present,
    );
    store.update({ project: next, session: fitted });
  }

  const change = (projectChange: ProjectChange, patch?: Partial<Session>): void =>
    setProject(applyChange(store.state.project, projectChange, now()), patch);

  const setSession = (patch: Partial<Session> | ((session: Session) => Session)): void =>
    store.update((s) => ({ session: typeof patch === 'function' ? patch(s.session) : { ...s.session, ...patch } }));

  const current = (): SequenceFrame | undefined => activeFrame(store.state)?.frame;

  /** Frame de la séquence à une position donnée (ramenée dans la séquence). */
  const frameAt = (index: number): SequenceFrame | undefined => {
    const sequence = sequenceOf(store.state);
    return sequence[clamp(index, 0, sequence.length - 1)];
  };

  /**
   * Donne des poses à une frame. Une image clé est posée directement ; une frame générée
   * devient une nouvelle image clé entre ses voisines (avec les poses de tous les personnages
   * à cet instant), qui devient la frame active.
   */
  function poseFrame(frame: SequenceFrame, poses: Readonly<Record<string, FramePose>>): void {
    if (frame.kind === 'keyframe') {
      change({ type: 'poseKeyframe', keyframeId: frame.id, poses: { ...poses } });
      return;
    }
    const keyframeId = createId();
    change(
      { type: 'insertKeyframe', afterKeyframeId: frame.from, keyframeId, poses: { ...frame.poses, ...poses } },
      { activeFrameId: keyframeId },
    );
  }

  const unsubscribers = [
    // ---------- Projet ----------
    bus.on('history:undo', () => setProject(undo(store.state.project))),
    bus.on('history:redo', () => setProject(redo(store.state.project))),

    bus.on('project:rename', ({ name }) => change({ type: 'rename', name })),
    bus.on('animation:fps:change', ({ fps }) => change({ type: 'setFps', fps })),
    bus.on('ai:smoothing:change', (changes) => change({ type: 'updateSmoothing', changes })),
    bus.on('ai:loop:change', (changes) => change({ type: 'updateLoop', changes })),

    // « + » : copie de la frame active juste après elle (une frame générée devient image clé).
    bus.on('frame:add', () => {
      const frame = current();
      if (!frame) return;
      if (frame.kind === 'generated') return poseFrame(frame, frame.poses);
      const keyframeId = createId();
      change({ type: 'insertKeyframe', afterKeyframeId: frame.id, keyframeId }, { activeFrameId: keyframeId });
    }),
    bus.on('frame:pose:change', ({ frameId, characterId, pose, rootPosition }) => {
      const frame = sequenceOf(store.state).find((f) => f.id === frameId);
      if (frame) poseFrame(frame, { [characterId]: { pose, rootPosition } });
    }),
    // Seules les images clés se suppriment : une frame générée découle de ses voisines.
    bus.on('frame:delete', () => {
      const frame = current();
      if (frame?.kind === 'keyframe') change({ type: 'deleteKeyframe', keyframeId: frame.id });
    }),
    bus.on('frame:paste', () => {
      const frame = current();
      const { clipboard } = store.state.session;
      if (frame && clipboard) poseFrame(frame, clipboard);
    }),

    // ---------- Personnages ----------
    bus.on('character:add', ({ name }) => {
      const characterId = createId();
      change({ type: 'addCharacter', characterId, name }, selectPart(store.state.session, characterId, null, false));
    }),
    bus.on('character:duplicate', ({ characterId: sourceId, name }) => {
      const characterId = createId();
      change(
        { type: 'duplicateCharacter', sourceId, characterId, name },
        selectPart(store.state.session, characterId, null, false),
      );
    }),
    bus.on('character:remove', ({ characterId }) => change({ type: 'removeCharacter', characterId })),
    bus.on('character:rename', ({ characterId, name }) => change({ type: 'renameCharacter', characterId, name })),
    bus.on('character:reorder', ({ characterId, direction }) => change({ type: 'moveCharacter', characterId, direction })),
    bus.on('character:visibility', ({ characterId, visible }) =>
      change({ type: 'setCharacterVisibility', characterId, visible }),
    ),
    bus.on('character:lock', ({ characterId, locked }) => change({ type: 'setCharacterLock', characterId, locked })),
    bus.on('appearance:color', ({ characterId, parts, color }) =>
      change({ type: 'setCharacterColor', characterId, parts, color }),
    ),
    bus.on('appearance:scale', ({ characterId, scale }) => change({ type: 'setCharacterScale', characterId, scale })),
    bus.on('appearance:bands', ({ characterId, bands }) => change({ type: 'setPartBands', characterId, bands })),
    bus.on('partialPaint:change', (changes) => setSession((s) => withPartialPaint(s, changes))),
    // Les couleurs récentes ne sont pas une étape d'annulation (voir recordRecentColor).
    bus.on('color:commit', ({ color }) => setProject(recordRecentColor(store.state.project, color))),

    // ---------- Décor ----------
    bus.on('shape:create', ({ shape, gesture }) =>
      change({ type: 'addShape', shape, gesture }, { ...clearSelection(store.state.session), selectedShapeId: shape.id }),
    ),
    bus.on('shape:update', ({ shapeId, changes, gesture }) => change({ type: 'updateShape', shapeId, changes, gesture })),
    bus.on('shape:remove', ({ shapeId }) => change({ type: 'removeShape', shapeId })),
    bus.on('shape:duplicate', ({ shapeId }) => {
      const source = store.state.project.present.environment.shapes.find((s) => s.id === shapeId);
      if (!source) return;
      const shape = { ...source, id: createId(), x: source.x + DUPLICATE_SHAPE_OFFSET, y: source.y - DUPLICATE_SHAPE_OFFSET };
      change({ type: 'addShape', shape }, { selectedShapeId: shape.id });
    }),
    bus.on('drawing:stroke', ({ tiles }) => change({ type: 'paintDrawing', tiles })),

    // ---------- Session ----------
    bus.on('frame:select', ({ index }) => setSession({ activeFrameId: frameAt(index)?.id ?? null })),
    bus.on('playback:frame', ({ index }) => setSession({ activeFrameId: frameAt(index)?.id ?? null })),
    bus.on('frame:copy', () => {
      const frame = current();
      if (frame) setSession({ clipboard: frame.poses });
    }),
    bus.on('animation:onion-skin:change', ({ enabled }) => setSession({ onionSkin: enabled })),
    bus.on('node:select', ({ nodeId }) => setSession({ selectedNodeId: nodeId })),
    bus.on('character:select', ({ characterId }) =>
      setSession((s) => (characterId === null ? clearSelection(s) : selectPart(s, characterId, null, false))),
    ),
    bus.on('segment:select', ({ characterId, nodeId, additive }) =>
      setSession((s) => selectPart(s, characterId, nodeId, additive)),
    ),
    bus.on('shape:select', ({ shapeId }) => setSession((s) => ({ ...clearSelection(s), selectedShapeId: shapeId }))),
    bus.on('playback:play', () => setSession({ isPlaying: true })),
    bus.on('playback:pause', () => setSession({ isPlaying: false })),
    // Relayé en lecture / pause, que d'autres modules écoutent (ex. arrêt d'un glisser).
    bus.on('playback:toggle', () => bus.emit(store.state.session.isPlaying ? 'playback:pause' : 'playback:play')),
    bus.on('playback:speed:change', ({ speed }) => setSession({ playbackSpeed: speed })),
    // Changer de contexte efface la sélection de l'autre contexte (elle n'y serait plus manipulable).
    bus.on('editMode:change', ({ mode }) =>
      setSession((s) =>
        mode === 'characters'
          ? { ...s, editorMode: mode, selectedShapeId: null }
          : {
              ...s,
              editorMode: mode,
              selectedCharacterId: null,
              selectedNodeId: null,
              selectedParts: [],
              partialPaint: { ...s.partialPaint, open: false },
            },
      ),
    ),
    bus.on('panel:toggle', ({ open }) => setSession({ panelOpen: open })),
    bus.on('tool:select', ({ tool }) => setSession({ tool })),
    bus.on('tool:settings', (settings) => setSession((s) => ({ ...s, toolSettings: { ...s.toolSettings, ...settings } }))),
    bus.on('eyedropper:start', () => setSession({ eyedropper: true })),
    bus.on('eyedropper:pick', () => setSession({ eyedropper: false })),
    bus.on('eyedropper:cancel', () => setSession({ eyedropper: false })),
    bus.on('export:format:change', ({ format }) => setSession({ exportFormat: format })),
    bus.on('ui:drawer:toggle', ({ open }) => setSession({ drawerOpen: open })),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

/** Décalage d'une forme dupliquée, en unités du monde. */
const DUPLICATE_SHAPE_OFFSET = 16;
