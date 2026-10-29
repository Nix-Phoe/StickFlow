// Session : l'état de travail du moment, ni sauvegardé ni annulable (voir GLOSSARY.md).

import { normalizeHex } from '../model/color';
import {
  clamp,
  type EditorMode,
  type ExportFormat,
  type FramePose,
  type ProjectSummary,
  type Notice,
  type PlaybackSpeed,
  type Project,
  type ToolId,
  type ToolSettings,
} from './types';

/** Réglages de la fenêtre « Coloration partielle ». */
export interface PartialPaintSettings {
  open: boolean;
  /** Une zone posée sur un bras ou une jambe l'est aussi sur l'autre. */
  symmetric: boolean;
  /** Couleur des nouvelles zones et des tenues toutes faites. */
  color: string;
}

export const DEFAULT_PARTIAL_PAINT: PartialPaintSettings = { open: false, symmetric: true, color: '#9b1b30' };

export interface Session {
  /** Frame active de la séquence, désignée par son id (stable) ; `null` avant la première. */
  activeFrameId: string | null;
  /** Personnage sélectionné (liste de l'onglet Personnages et scène). */
  selectedCharacterId: string | null;
  /** Nœud du personnage sélectionné (poignée mise en évidence, rotation au clavier). */
  selectedNodeId: string | null;
  /** Parties du personnage sélectionné, colorées par l'inspecteur ; vide = personnage entier. */
  selectedParts: readonly string[];
  selectedShapeId: string | null;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  /** Contexte d'édition de la scène, choisi par l'onglet du panneau flottant (mémorisé). */
  editorMode: EditorMode;
  /** Panneau flottant « Personnages & Environnement » ouvert. */
  panelOpen: boolean;
  partialPaint: PartialPaintSettings;
  /** Outil de l'environnement. */
  tool: ToolId;
  toolSettings: ToolSettings;
  /** Pipette de secours : le prochain appui sur la scène lit la couleur d'un pixel. */
  eyedropper: boolean;
  exportFormat: ExportFormat;
  /** Tiroir du panneau gauche ouvert (petits écrans uniquement). */
  drawerOpen: boolean;
  /** Pelure d'oignon : frame précédente affichée en transparence. */
  onionSkin: boolean;
  /** Poses copiées (une par personnage), prêtes à être collées sur une autre frame. */
  clipboard: Readonly<Record<string, FramePose>> | null;
  /** Id du projet enregistré en cours d'édition ; `null` s'il n'a jamais été enregistré. */
  documentId: string | null;
  /** Projet tel qu'il a été enregistré ou ouvert, pour savoir s'il a changé depuis. */
  savedProject: Project | null;
  /** Liste des projets enregistrés quand le dialogue « Ouvrir » est affiché. */
  library: ProjectSummary[] | null;
  notice: Notice | null;
  /** Avancement de l'export en cours (0 à 1), `null` sans export. */
  exportProgress: number | null;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = { color: '#1c1c1e', strokeWidth: 4, opacity: 1, filled: false };

export function createSession(): Session {
  return {
    activeFrameId: null,
    selectedCharacterId: null,
    selectedNodeId: null,
    selectedParts: [],
    selectedShapeId: null,
    isPlaying: false,
    playbackSpeed: 1,
    editorMode: 'characters',
    panelOpen: false,
    partialPaint: DEFAULT_PARTIAL_PAINT,
    tool: 'select',
    toolSettings: DEFAULT_TOOL_SETTINGS,
    eyedropper: false,
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
 * Recale la Session quand le Projet ou la séquence change (`previous` → `next`) : si la frame
 * active a disparu, on garde sa place dans la séquence ; une sélection (personnage verrouillé,
 * masqué ou supprimé, nœud, partie ou forme disparus) est effacée. Même objet si rien ne change.
 */
export function fitSessionToSequence(
  session: Session,
  previous: readonly { id: string }[],
  next: readonly { id: string }[],
  project: Project,
): Session {
  let { activeFrameId } = session;
  if (!next.some((frame) => frame.id === activeFrameId)) {
    const place = previous.findIndex((frame) => frame.id === activeFrameId);
    activeFrameId = next[clamp(place === -1 ? 0 : place, 0, next.length - 1)]?.id ?? null;
  }

  const character = project.characters.find((c) => c.id === session.selectedCharacterId && c.visible && !c.locked);
  const inSkeleton = (id: string): boolean => character?.skeleton.some((n) => n.id === id) ?? false;
  const selectedCharacterId = character?.id ?? null;
  const selectedNodeId = session.selectedNodeId !== null && inSkeleton(session.selectedNodeId) ? session.selectedNodeId : null;
  const parts = session.selectedParts.filter(inSkeleton);
  const selectedParts = parts.length === session.selectedParts.length ? session.selectedParts : parts;
  const selectedShapeId =
    session.selectedShapeId !== null && project.environment.shapes.some((s) => s.id === session.selectedShapeId)
      ? session.selectedShapeId
      : null;

  return activeFrameId === session.activeFrameId &&
    selectedCharacterId === session.selectedCharacterId &&
    selectedNodeId === session.selectedNodeId &&
    selectedParts === session.selectedParts &&
    selectedShapeId === session.selectedShapeId
    ? session
    : { ...session, activeFrameId, selectedCharacterId, selectedNodeId, selectedParts, selectedShapeId };
}

/**
 * Sélectionne un personnage (`nodeId` à `null`) ou une de ses parties. Avec `additive` (Maj),
 * la partie s'ajoute à celles du même personnage, ou s'en retire si elle y était déjà.
 */
export function selectPart(session: Session, characterId: string, nodeId: string | null, additive: boolean): Session {
  const base = { ...session, selectedCharacterId: characterId, selectedShapeId: null };
  if (nodeId === null) return { ...base, selectedNodeId: null, selectedParts: [] };
  if (!additive || session.selectedCharacterId !== characterId) {
    return { ...base, selectedNodeId: nodeId, selectedParts: [nodeId] };
  }
  if (session.selectedParts.includes(nodeId)) {
    const selectedParts = session.selectedParts.filter((id) => id !== nodeId);
    return { ...base, selectedParts, selectedNodeId: selectedParts.at(-1) ?? null };
  }
  return { ...base, selectedNodeId: nodeId, selectedParts: [...session.selectedParts, nodeId] };
}

/** Plus rien de sélectionné (clic dans le vide). */
export function clearSelection(session: Session): Session {
  return { ...session, selectedCharacterId: null, selectedNodeId: null, selectedParts: [], selectedShapeId: null };
}

/** Met à jour les réglages de la coloration partielle ; une couleur invalide est ignorée. */
export function withPartialPaint(session: Session, changes: Partial<PartialPaintSettings>): Session {
  const color = changes.color === undefined ? session.partialPaint.color : (normalizeHex(changes.color) ?? session.partialPaint.color);
  return { ...session, partialPaint: { ...session.partialPaint, ...changes, color } };
}
