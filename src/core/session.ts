// Session : l'état de travail du moment, ni sauvegardé ni annulable (voir GLOSSARY.md).

import {
  clamp,
  type EditorMode,
  type ExportFormat,
  type FramePose,
  type LibraryEntry,
  type Notice,
  type PlaybackSpeed,
  type Project,
  type SkeletonNode,
} from './types';

export interface Session {
  /** Frame active de la séquence, désignée par son id (stable) ; `null` avant la première. */
  activeFrameId: string | null;
  selectedNodeId: string | null;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  editorMode: EditorMode;
  exportFormat: ExportFormat;
  /** Tiroir du panneau gauche ouvert (petits écrans uniquement). */
  drawerOpen: boolean;
  /** Pelure d'oignon : frame précédente affichée en transparence. */
  onionSkin: boolean;
  /** Pose copiée, prête à être collée sur une autre frame. */
  clipboard: FramePose | null;
  /** Id du projet enregistré en cours d'édition ; `null` s'il n'a jamais été enregistré. */
  documentId: string | null;
  /** Projet tel qu'il a été enregistré ou ouvert, pour savoir s'il a changé depuis. */
  savedProject: Project | null;
  /** Liste des projets enregistrés quand le dialogue « Ouvrir » est affiché. */
  library: LibraryEntry[] | null;
  notice: Notice | null;
  /** Avancement de l'export en cours (0 à 1), `null` sans export. */
  exportProgress: number | null;
}

export function createSession(): Session {
  return {
    activeFrameId: null,
    selectedNodeId: null,
    isPlaying: false,
    playbackSpeed: 1,
    editorMode: 'character',
    exportFormat: 'gif',
    drawerOpen: false,
    onionSkin: true,
    clipboard: null,
    documentId: null,
    savedProject: null,
    library: null,
    notice: null,
    exportProgress: null,
  };
}

/**
 * Recale la Session quand la séquence change (`previous` → `next`) : si la frame active
 * a disparu, on garde sa place dans la séquence ; une sélection de nœud disparu est effacée.
 * Même objet si rien ne change.
 */
export function fitSessionToSequence(
  session: Session,
  previous: readonly { id: string }[],
  next: readonly { id: string }[],
  skeleton: readonly SkeletonNode[],
): Session {
  let { activeFrameId } = session;
  if (!next.some((frame) => frame.id === activeFrameId)) {
    const place = previous.findIndex((frame) => frame.id === activeFrameId);
    activeFrameId = next[clamp(place === -1 ? 0 : place, 0, next.length - 1)]?.id ?? null;
  }
  const selectedNodeId =
    session.selectedNodeId !== null && skeleton.some((n) => n.id === session.selectedNodeId)
      ? session.selectedNodeId
      : null;
  return activeFrameId === session.activeFrameId && selectedNodeId === session.selectedNodeId
    ? session
    : { ...session, activeFrameId, selectedNodeId };
}
