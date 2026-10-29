// Sauvegarder, sauvegarder sous et ouvrir : relie le bus à la bibliothèque de projets.
// Sans DOM ; la bibliothèque (et donc IndexedDB) est injectée.

import type { AppEventBus } from '../core/events';
import { saveStatus } from '../core/selectors';
import { clearSelection, fitSessionToSequence, type Session } from '../core/session';
import type { Store } from '../core/store';
import type { Notice } from '../core/types';
import { createHistory } from '../model/project';
import { deriveSequence } from '../model/sequence';
import type { ProjectLibrary } from './library';

export interface ProjectStorageOptions {
  bus: AppEventBus;
  store: Store;
  library: ProjectLibrary;
}

/** Opérations exposées pour les tests ; l'interface passe par les événements `project:*`. */
export interface ProjectStorage {
  save(): Promise<void>;
  /** Sauvegarde automatique (retour à l'accueil) : n'écrit que si le Projet a changé depuis. */
  saveIfModified(): Promise<void>;
  saveAs(name: string): Promise<void>;
  open(projectId: string): Promise<void>;
  refreshLibrary(): Promise<void>;
  disconnect(): void;
}

export function connectProjectStorage({ bus, store, library }: ProjectStorageOptions): ProjectStorage {
  const setSession = (patch: Partial<Session>): void =>
    store.update((s) => ({ session: { ...s.session, ...patch } }));
  const fail = (code: Notice['code'], error: unknown): void =>
    setSession({ notice: { kind: 'error', code, detail: error instanceof Error ? error.message : String(error) } });

  /** Enregistre le Projet actuel sous `id` (ou un nouvel id) et en fait le document courant. */
  async function write(id: string | undefined): Promise<void> {
    const project = store.state.project.present;
    try {
      const entry = await library.save(project, id);
      // Le Projet a pu changer pendant l'enregistrement : on retient celui qui a été écrit.
      setSession({ documentId: entry.id, savedProject: project, notice: { kind: 'success', code: 'saved' } });
    } catch (error) {
      fail('save-failed', error);
    }
  }

  const storage: ProjectStorage = {
    save: () => write(store.state.session.documentId ?? undefined),
    saveIfModified: () => (saveStatus(store.state) === 'saved' ? Promise.resolve() : storage.save()),

    async saveAs(name) {
      bus.emit('project:rename', { name });
      await write(undefined);
    },

    async open(projectId) {
      try {
        const history = createHistory(await library.load(projectId));
        const { session } = store.state;
        const reset: Session = {
          ...clearSelection(session),
          activeFrameId: null,
          isPlaying: false,
          documentId: projectId,
          savedProject: history.present,
          library: null,
          notice: { kind: 'success', code: 'opened' },
        };
        store.update({
          project: history,
          session: fitSessionToSequence(reset, [], deriveSequence(history.present), history.present),
        });
      } catch (error) {
        fail('open-failed', error);
      }
    },

    async refreshLibrary() {
      try {
        setSession({ library: await library.list() });
      } catch (error) {
        fail('open-failed', error);
      }
    },

    disconnect: () => unsubscribers.forEach((unsubscribe) => unsubscribe()),
  };

  const unsubscribers = [
    bus.on('project:save', () => void storage.save()),
    bus.on('project:save-as', ({ name }) => void storage.saveAs(name)),
    bus.on('project:open', ({ projectId }) => void storage.open(projectId)),
    bus.on('project:library:request', () => void storage.refreshLibrary()),
    bus.on('project:library:close', () => setSession({ library: null })),
  ];

  return storage;
}
