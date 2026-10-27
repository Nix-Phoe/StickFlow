import type {
  EditorMode,
  ExportFormat,
  LoopSettings,
  PlaybackSpeed,
  SmoothingSettings,
} from './types';

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
  'playback:speed:change': { speed: PlaybackSpeed };

  'frame:select': { index: number };
  'frame:add': void;

  'project:save': void;
  'editor:mode:change': { mode: EditorMode };

  'ai:smoothing:change': Partial<SmoothingSettings>;
  'ai:loop:change': Partial<LoopSettings>;

  'animation:fps:change': { fps: number };

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
