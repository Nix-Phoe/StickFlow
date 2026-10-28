// Aiguillage sans règle : chaque événement de l'interface devient soit un changement nommé
// du Projet (avec l'heure, pour regrouper les gestes), soit une mise à jour de la Session.
// Les règles vivent dans le module Projet, dans la séquence dérivée et dans session.ts.

import { applyChange, redo, undo, type ProjectChange, type ProjectHistory } from '../model/project';
import { deriveSequence, type SequenceFrame } from '../model/sequence';
import type { AppEventBus } from './events';
import { createId } from './id';
import { activeFrame, sequenceOf } from './selectors';
import { fitSessionToSequence, type Session } from './session';
import type { Store } from './store';
import { clamp, type FramePose } from './types';

export interface IntentOptions {
  /** Horloge en millisecondes (injectable pour les tests). */
  now?: () => number;
}

export function connectIntents(bus: AppEventBus, store: Store, { now = Date.now }: IntentOptions = {}): () => void {
  /** Remplace l'historique du Projet puis recale la Session sur la nouvelle séquence. */
  function setProject(next: ProjectHistory, activeFrameId?: string): void {
    const { project, session } = store.state;
    if (next === project) return;
    const patched = activeFrameId ? { ...session, activeFrameId } : session;
    const fitted = fitSessionToSequence(
      patched,
      deriveSequence(project.present),
      deriveSequence(next.present),
      next.present.skeleton,
    );
    store.update({ project: next, session: fitted });
  }

  const change = (projectChange: ProjectChange, activeFrameId?: string): void =>
    setProject(applyChange(store.state.project, projectChange, now()), activeFrameId);

  const setSession = (patch: Partial<Session>): void =>
    store.update((s) => ({ session: { ...s.session, ...patch } }));

  const current = (): SequenceFrame | undefined => activeFrame(store.state)?.frame;

  /** Frame de la séquence à une position donnée (ramenée dans la séquence). */
  const frameAt = (index: number): SequenceFrame | undefined => {
    const sequence = sequenceOf(store.state);
    return sequence[clamp(index, 0, sequence.length - 1)];
  };

  /**
   * Donne une pose à une frame. Une image clé est posée directement ; une frame générée
   * devient une nouvelle image clé entre ses voisines, qui devient la frame active.
   */
  function poseFrame(frame: SequenceFrame, { pose, rootPosition }: FramePose): void {
    if (frame.kind === 'keyframe') {
      change({ type: 'poseKeyframe', keyframeId: frame.id, pose: { ...pose }, rootPosition });
      return;
    }
    const keyframeId = createId();
    change({ type: 'insertKeyframe', afterKeyframeId: frame.from, keyframeId, pose: { ...pose }, rootPosition }, keyframeId);
  }

  const unsubscribers = [
    // ---------- Projet ----------
    bus.on('history:undo', () => setProject(undo(store.state.project))),
    bus.on('history:redo', () => setProject(redo(store.state.project))),

    bus.on('animation:fps:change', ({ fps }) => change({ type: 'setFps', fps })),
    bus.on('ai:smoothing:change', (changes) => change({ type: 'updateSmoothing', changes })),
    bus.on('ai:loop:change', (changes) => change({ type: 'updateLoop', changes })),

    // « + » : copie de la frame active juste après elle (une frame générée devient image clé).
    bus.on('frame:add', () => {
      const frame = current();
      if (!frame) return;
      if (frame.kind === 'generated') return poseFrame(frame, frame);
      const keyframeId = createId();
      change({ type: 'insertKeyframe', afterKeyframeId: frame.id, keyframeId }, keyframeId);
    }),
    bus.on('frame:pose:change', ({ frameId, pose, rootPosition }) => {
      const frame = sequenceOf(store.state).find((f) => f.id === frameId);
      if (frame) poseFrame(frame, { pose, rootPosition });
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

    // ---------- Session ----------
    bus.on('frame:select', ({ index }) => setSession({ activeFrameId: frameAt(index)?.id ?? null })),
    bus.on('playback:frame', ({ index }) => setSession({ activeFrameId: frameAt(index)?.id ?? null })),
    bus.on('frame:copy', () => {
      const frame = current();
      if (frame) setSession({ clipboard: { pose: frame.pose, rootPosition: frame.rootPosition } });
    }),
    bus.on('animation:onion-skin:change', ({ enabled }) => setSession({ onionSkin: enabled })),
    bus.on('node:select', ({ nodeId }) => setSession({ selectedNodeId: nodeId })),
    bus.on('playback:play', () => setSession({ isPlaying: true })),
    bus.on('playback:pause', () => setSession({ isPlaying: false })),
    bus.on('playback:speed:change', ({ speed }) => setSession({ playbackSpeed: speed })),
    bus.on('editor:mode:change', ({ mode }) => setSession({ editorMode: mode })),
    bus.on('export:format:change', ({ format }) => setSession({ exportFormat: format })),
    bus.on('ui:drawer:toggle', ({ open }) => setSession({ drawerOpen: open })),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
