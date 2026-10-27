// Session : l'état de travail du moment, ni sauvegardé ni annulable (voir GLOSSARY.md).

import { clamp, type EditorMode, type ExportFormat, type PlaybackSpeed, type Project } from './types';

export interface Session {
  activeFrameIndex: number;
  selectedNodeId: string | null;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  editorMode: EditorMode;
  exportFormat: ExportFormat;
  /** Tiroir du panneau gauche ouvert (petits écrans uniquement). */
  drawerOpen: boolean;
}

export function createSession(): Session {
  return {
    activeFrameIndex: 0,
    selectedNodeId: null,
    isPlaying: false,
    playbackSpeed: 1,
    editorMode: 'character',
    exportFormat: 'gif',
    drawerOpen: false,
  };
}

/**
 * Recale la Session après un changement du Projet : la frame active reste dans la liste
 * des frames, et une sélection de nœud disparu est effacée. Même objet si rien ne change.
 */
export function fitSessionToProject(session: Session, project: Project): Session {
  const activeFrameIndex = clamp(session.activeFrameIndex, 0, project.frames.length - 1);
  const selectedNodeId =
    session.selectedNodeId !== null && project.skeleton.some((n) => n.id === session.selectedNodeId)
      ? session.selectedNodeId
      : null;
  return activeFrameIndex === session.activeFrameIndex && selectedNodeId === session.selectedNodeId
    ? session
    : { ...session, activeFrameIndex, selectedNodeId };
}
