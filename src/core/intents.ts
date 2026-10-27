// Aiguillage sans règle : chaque événement de l'interface devient soit un changement nommé
// du Projet (avec l'heure, pour regrouper les gestes), soit une mise à jour de la Session.
// Les règles vivent dans le module Projet et dans session.ts.

import { applyChange, redo, undo, type ProjectChange, type ProjectHistory } from '../model/project';
import type { AppEventBus } from './events';
import { createId } from './id';
import { fitSessionToProject, type Session } from './session';
import type { Store } from './store';
import { clamp, type Project } from './types';

export interface IntentOptions {
  /** Horloge en millisecondes (injectable pour les tests). */
  now?: () => number;
}

export function connectIntents(bus: AppEventBus, store: Store, { now = Date.now }: IntentOptions = {}): () => void {
  /** Remplace l'historique du Projet puis recale la Session (frame active, sélection). */
  function setProject(next: ProjectHistory, sessionPatch?: (project: Project) => Partial<Session>): void {
    const { project, session } = store.state;
    if (next === project) return;
    const patched = sessionPatch ? { ...session, ...sessionPatch(next.present) } : session;
    store.update({ project: next, session: fitSessionToProject(patched, next.present) });
  }

  const change = (projectChange: ProjectChange, sessionPatch?: (project: Project) => Partial<Session>): void =>
    setProject(applyChange(store.state.project, projectChange, now()), sessionPatch);

  const setSession = (patch: Partial<Session>): void =>
    store.update((s) => ({ session: { ...s.session, ...patch } }));

  const activeFrame = () => store.state.project.present.frames[store.state.session.activeFrameIndex];

  const unsubscribers = [
    // ---------- Projet ----------
    bus.on('history:undo', () => setProject(undo(store.state.project))),
    bus.on('history:redo', () => setProject(redo(store.state.project))),

    bus.on('animation:fps:change', ({ fps }) => change({ type: 'setFps', fps })),
    bus.on('ai:smoothing:change', (changes) => change({ type: 'updateSmoothing', changes })),
    bus.on('ai:loop:change', (changes) => change({ type: 'updateLoop', changes })),

    bus.on('frame:add', () => {
      const { project, session } = store.state;
      const after = project.present.frames[session.activeFrameIndex];
      if (!after) return;
      const frameId = createId();
      change({ type: 'insertFrame', afterFrameId: after.id, frameId }, (p) => ({
        activeFrameIndex: p.frames.findIndex((f) => f.id === frameId),
      }));
    }),
    bus.on('frame:pose:change', ({ frameId, pose, rootPosition }) =>
      change({ type: 'poseFrame', frameId, pose, rootPosition }),
    ),
    bus.on('frame:delete', () => {
      const active = activeFrame();
      if (active) change({ type: 'deleteFrame', frameId: active.id });
    }),
    bus.on('frame:paste', () => {
      const active = activeFrame();
      const { clipboard } = store.state.session;
      if (!active || !clipboard) return;
      change({ type: 'poseFrame', frameId: active.id, pose: { ...clipboard.pose }, rootPosition: clipboard.rootPosition });
    }),

    // ---------- Session ----------
    bus.on('frame:select', ({ index }) =>
      setSession({ activeFrameIndex: clamp(index, 0, store.state.project.present.frames.length - 1) }),
    ),
    bus.on('playback:frame', ({ index }) =>
      setSession({ activeFrameIndex: clamp(index, 0, store.state.project.present.frames.length - 1) }),
    ),
    bus.on('frame:copy', () => {
      const active = activeFrame();
      if (active) setSession({ clipboard: { pose: active.pose, rootPosition: active.rootPosition } });
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
