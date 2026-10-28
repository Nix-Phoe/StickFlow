import type {
  EditorMode,
  ExportFormat,
  LoopSettings,
  PlaybackSpeed,
  Shape,
  SmoothingSettings,
  ToolId,
  ToolSettings,
  Vec2,
} from './types';

/** Pointeur sur la scène, en pixels CSS depuis le coin haut-gauche du canvas, avec sa taille. */
export interface StagePointer {
  pointerId: number;
  /** Doigt, stylet ou souris : la zone de saisie est plus large au toucher. */
  pointerType?: 'mouse' | 'pen' | 'touch';
  /** Maj enfoncée (sélection multiple, proportions contraintes). */
  shiftKey?: boolean;
  /** Pression du stylet (0 à 1), 0,5 pour une souris. */
  pressure?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Catalogue des événements de l'application et de leur payload.
 * L'UI émet des intentions ; les modules (store, rendu, animation…) les écoutent.
 * Les noms d'événements servent aussi de valeur aux attributs `data-action`.
 */
export interface AppEvents {
  'history:undo': void;
  'history:redo': void;

  'playback:play': void;
  'playback:pause': void;
  /** Bouton unique Lecture / Pause : lance la lecture, ou la met en pause. */
  'playback:toggle': void;
  /** Arrête la lecture et revient à la frame où elle avait commencé. */
  'playback:stop': void;
  /** Le lecteur avance la tête de lecture (émis en continu pendant la lecture). */
  'playback:frame': { index: number };
  'playback:speed:change': { speed: PlaybackSpeed };

  'frame:select': { index: number };
  /** Insère une copie de la frame active juste après elle. */
  'frame:add': void;
  /** Supprime la frame active (jamais la dernière). */
  'frame:delete': void;
  /** Copie la pose de la frame active dans le presse-papiers de la Session. */
  'frame:copy': void;
  /** Colle la pose copiée sur la frame active. */
  'frame:paste': void;
  /** Nouvelle pose d'un personnage dans une frame (désignée par son id) ; une frame générée devient image clé. */
  'frame:pose:change': { frameId: string; characterId: string; pose: Record<string, number>; rootPosition: Vec2 };

  'stage:pointer:down': StagePointer;
  'stage:pointer:move': StagePointer;
  /** Relâchement ou annulation du pointeur. */
  'stage:pointer:up': StagePointer;

  'node:select': { nodeId: string | null };
  /** Sélectionne le nœud suivant (1) ou précédent (-1). */
  'node:cycle': { direction: 1 | -1 };
  /** Tourne le nœud sélectionné. */
  'node:nudge': { radians: number };

  'project:save': void;
  /** Enregistre une copie sous ce nom, qui devient le document courant. */
  'project:save-as': { name: string };
  'project:open': { projectId: string };
  'project:rename': { name: string };
  /** Demande la liste des projets enregistrés (dialogue Ouvrir) ; `close` la referme. */
  'project:library:request': void;
  'project:library:close': void;
  /** Contexte d'édition : Personnages ou Environnement (onglet du panneau flottant). */
  'editMode:change': { mode: EditorMode };
  /** Ouvre ou ferme le panneau flottant « Personnages & Environnement ». */
  'panel:toggle': { open: boolean };

  /** Ajoute un stickman de base (nom fourni par l'interface), qui devient le personnage sélectionné. */
  'character:add': { name: string };
  'character:remove': { characterId: string };
  'character:duplicate': { characterId: string; name: string };
  /** `null` : plus aucun personnage sélectionné. */
  'character:select': { characterId: string | null };
  'character:rename': { characterId: string; name: string };
  /** Monte (1) ou descend (-1) dans l'ordre d'affichage. */
  'character:reorder': { characterId: string; direction: 1 | -1 };
  'character:visibility': { characterId: string; visible: boolean };
  'character:lock': { characterId: string; locked: boolean };
  /** Sélectionne une partie d'un personnage (`nodeId` à `null` : le personnage entier) ; Maj = ajouter. */
  'segment:select': { characterId: string; nodeId: string | null; additive: boolean };
  /** Colore des parties (aucune = tout le personnage) ; `null` = couleur automatique. */
  'appearance:color': { characterId: string; parts: readonly string[]; color: string | null };
  'appearance:scale': { characterId: string; scale: number };
  /** Fin d'un geste de couleur : la couleur rejoint les couleurs récentes. */
  'color:commit': { color: string };
  /** Pipette de secours : le prochain appui sur la scène lit un pixel et émet `eyedropper:pick`. */
  'eyedropper:start': void;
  'eyedropper:pick': { color: string };
  'eyedropper:cancel': void;

  'tool:select': { tool: ToolId };
  'tool:settings': Partial<ToolSettings>;
  /** Ajoute une forme au décor ; elle devient la forme sélectionnée. */
  'shape:create': { shape: Shape; gesture?: string };
  /** `gesture` : jeton du geste sur la scène (un geste = une étape d'annulation). */
  'shape:update': { shapeId: string; changes: Partial<Omit<Shape, 'id'>>; gesture?: string };
  'shape:remove': { shapeId: string };
  'shape:select': { shapeId: string | null };
  'shape:duplicate': { shapeId: string };
  /** Trait terminé sur le calque de dessin : tuiles repeintes (PNG en data URL, `null` = transparente). */
  'drawing:stroke': { tiles: Record<string, string | null> };
  /** Outil Remplir hors d'une forme : remplissage par diffusion du calque de dessin en ce point du monde. */
  'drawing:fill': { point: Vec2 };

  'ai:smoothing:change': Partial<SmoothingSettings>;
  'ai:loop:change': Partial<LoopSettings>;

  'animation:fps:change': { fps: number };
  'animation:onion-skin:change': { enabled: boolean };

  'export:format:change': { format: ExportFormat };
  'export:request': { format: ExportFormat };

  'ui:drawer:toggle': { open: boolean };

  'canvas:resize': { width: number; height: number; pixelRatio: number };
}

export type AppEventName = keyof AppEvents;

export type EventHandler<P> = (payload: P) => void;
export type AnyEventHandler<Events> = <K extends keyof Events>(type: K, payload: Events[K]) => void;

/** Un événement sans payload s'émet sans argument. */
type EmitArgs<P> = [P] extends [void] ? [] : [payload: P];

type HandlerMap<Events> = { [K in keyof Events]?: Set<EventHandler<Events[K]>> };

export class EventBus<Events extends object> {
  private readonly handlers: HandlerMap<Events> = {};
  private readonly anyHandlers = new Set<AnyEventHandler<Events>>();

  /** Abonne `handler` à `type`. Retourne la fonction de désabonnement. */
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers[type];
    if (!set) {
      set = new Set();
      this.handlers[type] = set;
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers[type]?.delete(handler);
  }

  /** Écoute tous les événements (journalisation, débogage). */
  onAny(handler: AnyEventHandler<Events>): () => void {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit<K extends keyof Events>(type: K, ...args: EmitArgs<Events[K]>): void {
    const payload = args[0] as Events[K];
    this.handlers[type]?.forEach((handler) => handler(payload));
    this.anyHandlers.forEach((handler) => handler(type, payload));
  }
}

export type AppEventBus = EventBus<AppEvents>;

export function createEventBus(): AppEventBus {
  return new EventBus<AppEvents>();
}
