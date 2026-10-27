import { createId } from './id';
import type { AiSettings, EditorMode, ExportFormat, Frame, PlaybackSpeed, SkeletonNode } from './types';

/** État global de l'application. Mis à jour de façon immuable. */
export interface AppState {
  projectName: string;
  editorMode: EditorMode;
  /** Trié parents avant enfants (voir `sortSkeleton`). */
  skeleton: SkeletonNode[];
  frames: Frame[];
  activeFrameIndex: number;
  /** Nœud sélectionné sur la scène (Session). */
  selectedNodeId: string | null;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  fps: number;
  ai: AiSettings;
  exportFormat: ExportFormat;
  /** Tiroir du panneau gauche ouvert (petits écrans uniquement). */
  drawerOpen: boolean;
}

export type StateListener = (state: Readonly<AppState>, previous: Readonly<AppState>) => void;
export type StatePatch = Partial<AppState> | ((state: Readonly<AppState>) => Partial<AppState>);

export class Store {
  private current: AppState;
  private readonly listeners = new Set<StateListener>();

  constructor(initial: AppState) {
    this.current = initial;
  }

  get state(): Readonly<AppState> {
    return this.current;
  }

  update(patch: StatePatch): void {
    const changes = typeof patch === 'function' ? patch(this.current) : patch;
    const previous = this.current;
    this.current = { ...previous, ...changes };
    this.listeners.forEach((listener) => listener(this.current, previous));
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Appelle `listener` immédiatement, puis à chaque fois que la valeur
   * retournée par `selector` change (comparaison par référence).
   */
  watch<T>(selector: (state: Readonly<AppState>) => T, listener: (value: T) => void): () => void {
    let last = selector(this.current);
    listener(last);
    return this.subscribe((state) => {
      const next = selector(state);
      if (!Object.is(next, last)) {
        last = next;
        listener(next);
      }
    });
  }
}

export function createPlaceholderFrame(generated = false): Frame {
  return { id: createId(), pose: {}, rootPosition: { x: 0, y: 0 }, generated };
}

/**
 * État de départ. Les 5 frames sont factices (pose vide = squelette au repos) ;
 * la 3e simule une frame générée.
 */
export function createInitialState(projectName: string, skeleton: SkeletonNode[]): AppState {
  return {
    projectName,
    editorMode: 'character',
    skeleton,
    frames: [false, false, true, false, false].map(createPlaceholderFrame),
    activeFrameIndex: 0,
    selectedNodeId: null,
    isPlaying: false,
    playbackSpeed: 1,
    fps: 12,
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
      loop: { enabled: false, repeat: 'infinite', transitionFrames: 4 },
    },
    exportFormat: 'gif',
    drawerOpen: false,
  };
}
