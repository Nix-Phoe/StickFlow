import type {
  EditorMode,
  ExportFormat,
  LoopSettings,
  PlaybackSpeed,
  SmoothingSettings,
  Vec2,
} from './types';

/** Pointeur sur la scène, en pixels CSS depuis le coin haut-gauche du canvas, avec sa taille. */
export interface StagePointer {
  pointerId: number;
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
  /** Nouvelle pose d'une frame (désignée par son id) ; une frame générée devient image clé. */
  'frame:pose:change': { frameId: string; pose: Record<string, number>; rootPosition: Vec2 };

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
  'editor:mode:change': { mode: EditorMode };

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
