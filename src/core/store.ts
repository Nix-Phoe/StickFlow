import { createHistory, type ProjectHistory } from '../model/project';
import { createId } from './id';
import { createSession, type Session } from './session';
import type { Frame, SkeletonNode } from './types';

/** État global de l'application : le Projet (avec son historique) et la Session. */
export interface AppState {
  /** Ne lire que `project.present` (et `canUndo` / `canRedo`) depuis l'interface. */
  project: ProjectHistory;
  session: Session;
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

function createDemoFrame(generated: boolean): Frame {
  return { id: createId(), pose: {}, rootPosition: { x: 0, y: 0 }, generated };
}

/**
 * État de départ. Les 5 frames de démonstration sont au repos ;
 * la 3e simule une frame générée.
 */
export function createInitialState(projectName: string, skeleton: SkeletonNode[]): AppState {
  return {
    project: createHistory({
      name: projectName,
      fps: 12,
      skeleton,
      frames: [false, false, true, false, false].map(createDemoFrame),
      ai: {
        smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
        loop: { enabled: false, repeatCount: 3, infinite: true, transitionFrames: 4 },
      },
    }),
    session: createSession(),
  };
}
