// Historique annuler / rétablir par instantanés du Projet (voir docs/adr/0001).

import type { Project } from '../../core/types';
import { applyToProject, coalesceKey, normalizeProject, type ProjectChange } from './changes';

/** Nombre maximal d'étapes d'annulation conservées. */
export const HISTORY_LIMIT = 100;
/** Deux changements du même réglage plus rapprochés que ceci forment une seule étape. */
export const COALESCE_WINDOW_MS = 1000;

export interface ProjectHistory {
  /** Le Projet actuel : c'est le seul champ que l'interface doit lire. */
  readonly present: Project;
  readonly past: readonly Project[];
  readonly future: readonly Project[];
  /** Dernier changement regroupable (clé et heure), pour fusionner les gestes rapides. */
  readonly lastChange: { readonly key: string; readonly time: number } | null;
}

/** Démarre un historique ; le Projet est d'abord ramené dans ses invariants. */
export function createHistory(project: Project): ProjectHistory {
  return { present: normalizeProject(project), past: [], future: [], lastChange: null };
}

/**
 * Applique un changement à l'heure `now` (ms). Un changement sans effet renvoie le même
 * historique ; un changement regroupable proche du précédent remplace l'étape en cours.
 */
export function applyChange(history: ProjectHistory, change: ProjectChange, now: number): ProjectHistory {
  const present = applyToProject(history.present, change);
  if (present === history.present) return history;

  const key = coalesceKey(change);
  const last = history.lastChange;
  const merge = key !== null && last !== null && last.key === key && now - last.time <= COALESCE_WINDOW_MS;

  return {
    present,
    past: merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    future: [],
    lastChange: key === null ? null : { key, time: now },
  };
}

export function undo(history: ProjectHistory): ProjectHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
    lastChange: null,
  };
}

export function redo(history: ProjectHistory): ProjectHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { present: next, past: [...history.past, history.present], future: rest, lastChange: null };
}

export const canUndo = (history: ProjectHistory): boolean => history.past.length > 0;
export const canRedo = (history: ProjectHistory): boolean => history.future.length > 0;
