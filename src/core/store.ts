import { DEFAULT_APPEARANCE } from '../model/character';
import { createHistory, type ProjectHistory } from '../model/project';
import { deriveSequence } from '../model/sequence';
import { DEFAULT_FORMAT } from './formats';
import { createId } from './id';
import { createSession, fitSessionToSequence, selectPart, type Session } from './session';
import type { Project, SkeletonNode } from './types';

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

/**
 * État de l'éditeur pour un projet enregistré sous `documentId` : historique vierge, Session
 * neuve sur la première frame, projet considéré comme enregistré.
 */
export function createStateFromProject(project: Project, documentId: string): AppState {
  const history = createHistory(project);
  const session: Session = { ...createSession(), documentId, savedProject: history.present };
  return { project: history, session: fitSessionToSequence(session, [], deriveSequence(history.present), history.present) };
}

/** Pose de démonstration de la 2e image clé : le bras droit salue (angles relatifs, en radians). */
const WAVE_POSE = { upperArmR: -0.8, forearmR: 0.9 };

/**
 * État de départ : un personnage, sélectionné, et deux images clés (repos, puis salut du bras
 * droit) ; la Fluidité génère les frames intermédiaires entre elles. Décor vide.
 */
export function createInitialState(projectName: string, skeleton: SkeletonNode[], characterName = 'Personnage 1'): AppState {
  const characterId = createId();
  const rest = { x: 0, y: 0 };
  const project = createHistory({
    name: projectName,
    fps: 12,
    format: DEFAULT_FORMAT,
    characters: [{ id: characterId, name: characterName, visible: true, locked: false, skeleton, appearance: { ...DEFAULT_APPEARANCE } }],
    keyframes: [
      { id: createId(), poses: { [characterId]: { pose: {}, rootPosition: rest } } },
      { id: createId(), poses: { [characterId]: { pose: { ...WAVE_POSE }, rootPosition: rest } } },
    ],
    environment: { background: null, shapes: [], drawing: { tiles: {} } },
    recentColors: [],
    ai: {
      smoothing: { enabled: true, intensity: 3, curve: 'smooth' },
      loop: { enabled: false, repeatCount: 3, infinite: true, transitionFrames: 4 },
    },
  });
  const session = fitSessionToSequence(
    selectPart(createSession(), characterId, null, false),
    [],
    deriveSequence(project.present),
    project.present,
  );
  return { project, session };
}
