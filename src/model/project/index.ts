// Module Projet : invariants du Projet, changements nommés et historique annuler / rétablir.
// Pur : aucune dépendance au DOM, au store ni à l'horloge (l'heure est passée en paramètre).
export type { ProjectChange } from './changes';
export {
  applyChange,
  canRedo,
  canUndo,
  COALESCE_WINDOW_MS,
  createHistory,
  HISTORY_LIMIT,
  recordRecentColor,
  redo,
  undo,
  type ProjectHistory,
} from './history';
