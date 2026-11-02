// Accueil : traduit les événements de l'interface en opérations sur la bibliothèque de projets,
// en navigation, ou en mises à jour de l'état de l'accueil (recherche, tri, vue, préférences).
// Sans DOM : bibliothèque, préférences, modèles, vignettes et export sont injectés.

import type { Project } from './types';
import type { Asset, AssetStore } from '../storage/asset-store';
import { ArchiveError, archiveFileName, backupFileName, type ArchivedProject, type ProjectArchive } from '../storage/archive-file';
import { collectProjects, importProjects } from '../storage/project-transfer';
import type { StorageProtection } from '../storage/storage-protection';
import type { Installer } from '../app/install';
import type { ProjectLibrary } from '../storage/library';
import type { PreferencesStore } from '../storage/preferences';
import type { VideoLibrary } from '../storage/video-store';
import { createProject, uniqueName } from '../model/new-project';
import type { AppEventBus } from './events';
import { isVideoType, normalizePreferences, videosToPrune, type HomeNoticeCode, type HomeState, type HomeTransfer, type Preferences } from './home-state';
import type { Route } from './router';
import type { Store } from './store';
import type { ExportFormat } from './types';

/** Fichier produit par un export lancé depuis l'accueil. */
export interface ExportedFile {
  blob: Blob;
  filename: string;
  /** « mp4 », « webm », « gif » ou « zip » (séquence PNG). */
  extension: string;
  /** Durée, en secondes. */
  duration: number;
}

export interface HomeIntentOptions {
  bus: AppEventBus;
  store: Store<HomeState>;
  library: ProjectLibrary;
  preferences: PreferencesStore;
  navigate: (route: Route) => void;
  /** Modèles de départ (projets en lecture seule). */
  templates: { load(templateId: string): Project | null };
  /** Noms par défaut (textes de l'interface). */
  names: { project: string; character: string };
  /** Vignette d'un projet ; navigateur uniquement. */
  thumbnail?: (project: Project) => string | null;
  /** Export d'un projet enregistré (menu de sa carte) ; navigateur uniquement. */
  exportProject?: (project: Project, format: ExportFormat, onProgress: (progress: number) => void) => Promise<ExportedFile>;
  /** Remet un fichier à l'utilisateur (téléchargement). */
  download?: (file: { blob: Blob; filename: string }) => void;
  /** Vidéos exportées conservées dans l'app (« Mes vidéos »). */
  videos?: VideoLibrary;
  /** Images d'arrière-plan : supprimées avec leur dernier projet (v2.1), exportées et importées avec lui (v2.2). */
  assets?: Pick<AssetStore, 'removeUnused' | 'get' | 'add'>;
  /** Écrit et relit les fichiers « .stickflow » (v2.2) ; navigateur uniquement (chargé à la demande). */
  archive?: {
    write(contents: { projects: ArchivedProject[]; assets: Asset[] }): Promise<Blob>;
    read(file: Blob): Promise<ProjectArchive>;
  };
  /** Stockage protégé (`navigator.storage.persist()`, v2.2). */
  protection?: StorageProtection;
  /** Installation de la PWA (v2.2). */
  installer?: Pick<Installer, 'mode' | 'subscribe' | 'prompt'>;
  now?: () => number;
  /** Espace utilisé et disponible (`navigator.storage.estimate()`), s'il est connu. */
  estimateStorage?: () => Promise<{ usage: number; quota: number } | null>;
}

export interface HomeIntents {
  /** Relit la liste des projets. */
  refresh(): Promise<void>;
  /** Attend la fin des opérations lancées (tests). */
  settled(): Promise<void>;
  disconnect(): void;
}

export function connectHomeIntents(options: HomeIntentOptions): HomeIntents {
  const { bus, store, library, preferences, navigate, templates, names, thumbnail } = options;
  let pending: Promise<unknown> = Promise.resolve();

  /** Lance une opération à la suite des précédentes ; une erreur devient un message. */
  const run = (operation: () => Promise<void>): void => {
    pending = pending.then(operation).catch((error: unknown) => {
      console.error('[home]', error);
      notify('error', 'action-failed', error);
    });
  };

  const notify = (kind: 'success' | 'error', code: HomeNoticeCode, detail?: unknown): void =>
    store.update({ notice: { kind, code, detail: detail instanceof Error ? detail.message : detail === undefined ? undefined : String(detail) } });

  async function refresh(): Promise<void> {
    store.update({ projects: await library.list(), storageProtected: (await options.protection?.status()) ?? null });
    await refreshVideos();
  }

  /** Un transfert de fichier « .stickflow » : un seul à la fois, et ses erreurs deviennent un message. */
  const transfer = (kind: HomeTransfer, operation: () => Promise<void>, failure: HomeNoticeCode): void =>
    run(async () => {
      if (store.state.transfer) return;
      store.update({ transfer: kind, notice: null });
      try {
        await operation();
      } catch (error) {
        if (!(error instanceof ArchiveError)) console.error('[home]', error);
        notify('error', failure, error instanceof ArchiveError ? error.code : error);
      } finally {
        store.update({ transfer: null });
      }
    });

  /** Archive des projets donnés, remise à l'utilisateur sous ce nom. */
  async function downloadArchive(projectIds: readonly string[], filename: string): Promise<void> {
    const { archive, assets, download } = options;
    if (!archive || !assets) throw new Error('Fichiers .stickflow indisponibles');
    const blob = await archive.write(await collectProjects(projectIds, { library, assets }));
    download?.({ blob, filename });
  }

  async function refreshVideos(): Promise<void> {
    if (!options.videos) return;
    store.update({ videos: await options.videos.list(), storage: (await options.estimateStorage?.()) ?? null });
  }

  /** Une opération sur les vidéos, puis la liste et l'espace à jour, puis un message. */
  const onVideos = (operation: (videos: VideoLibrary) => Promise<void>, code: HomeNoticeCode): void =>
    run(async () => {
      if (!options.videos) return;
      await operation(options.videos);
      await refreshVideos();
      notify('success', code);
    });

  function setPreferences(changes: Partial<Preferences>): void {
    const next = normalizePreferences({ ...store.state.preferences, ...changes });
    store.update({ preferences: next });
    preferences.save(next);
  }

  const unsubscribers = [
    bus.on('route:change', ({ route }) => navigate(route)),
    bus.on('project:open', ({ projectId }) => navigate({ name: 'editor', projectId })),
    bus.on('project:create', (request) =>
      run(async () => {
        const { defaultFormat, defaultFps } = store.state.preferences;
        const template = request.templateId ? templates.load(request.templateId) : null;
        const taken = (await library.list()).map((p) => p.name);
        const project = createProject({
          name: uniqueName(request.name ?? '', taken, names.project),
          format: request.format ?? defaultFormat,
          // Un modèle garde son rythme, sauf si un IPS est choisi.
          fps: request.fps ?? (template ? undefined : defaultFps),
          characterName: names.character,
          template: template ?? undefined,
        });
        const { id } = await library.save(project, undefined, { thumbnail: thumbnail?.(project) ?? null });
        store.update({ sheet: null });
        navigate({ name: 'editor', projectId: id });
      }),
    ),
    bus.on('library:rename', ({ projectId, name }) =>
      run(async () => {
        await library.rename(projectId, name);
        await refresh();
      }),
    ),
    bus.on('library:duplicate', ({ projectId, name }) =>
      run(async () => {
        await library.duplicate(projectId, name);
        await refresh();
        notify('success', 'duplicated');
      }),
    ),
    bus.on('library:delete', ({ projectId }) =>
      run(async () => {
        const removed = (await library.list()).find((summary) => summary.id === projectId);
        await library.remove(projectId);
        await refresh();
        // Une copie partage l'image de son original : on ne la supprime qu'avec le dernier projet.
        if (removed && removed.assetIds.length > 0 && options.assets) {
          const used = new Set((store.state.projects ?? []).flatMap((summary) => summary.assetIds));
          await options.assets.removeUnused(removed.assetIds, used);
        }
        notify('success', 'deleted');
      }),
    ),
    bus.on('library:export', ({ projectId, format }) =>
      run(async () => {
        if (!options.exportProject || store.state.exporting) return;
        store.update({ exporting: { projectId, progress: 0 }, notice: null });
        try {
          const project = await library.load(projectId);
          const file = await options.exportProject(project, format, (progress) =>
            store.update({ exporting: { projectId, progress } }),
          );
          options.download?.(file);
          // Un GIF ou une vidéo est aussi conservé dans « Mes vidéos » (pas une séquence PNG).
          if (options.videos && isVideoType(file.extension)) {
            await options.videos.add({
              projectId,
              projectName: project.name,
              type: file.extension,
              blob: file.blob,
              duration: file.duration,
              thumbnail: (await library.list()).find((p) => p.id === projectId)?.thumbnail ?? null,
            });
            await refreshVideos();
          }
          notify('success', 'exported', file.filename);
        } catch (error) {
          notify('error', 'export-failed', error);
        } finally {
          store.update({ exporting: null });
        }
      }),
    ),
    bus.on('library:export-file', ({ projectId }) =>
      transfer(
        'export',
        async () => {
          const summary = (await library.list()).find((p) => p.id === projectId);
          if (!summary) return;
          const filename = archiveFileName(summary.name);
          await downloadArchive([projectId], filename);
          notify('success', 'project-exported', filename);
        },
        'action-failed',
      ),
    ),
    bus.on('library:backup', () =>
      transfer(
        'backup',
        async () => {
          const projects = await library.list();
          if (projects.length === 0) return notify('error', 'backup-empty');
          const filename = backupFileName(new Date((options.now ?? Date.now)()));
          await downloadArchive(
            projects.map((p) => p.id),
            filename,
          );
          notify('success', 'backup-created', filename);
        },
        'action-failed',
      ),
    ),
    bus.on('library:import', ({ file }) =>
      transfer(
        'import',
        async () => {
          const { archive, assets } = options;
          if (!archive || !assets) throw new Error('Fichiers .stickflow indisponibles');
          const imported = await importProjects(await archive.read(file), { library, assets, thumbnail });
          await refresh();
          notify('success', 'imported', imported.length);
        },
        'import-failed',
      ),
    ),
    options.installer?.subscribe((install) => store.update({ install })) ?? (() => undefined),
    bus.on('app:install', () =>
      run(async () => {
        await options.installer?.prompt();
      }),
    ),
    bus.on('storage:protect', () =>
      run(async () => {
        await options.protection?.request({ force: true });
        store.update({ storageProtected: (await options.protection?.status()) ?? null });
      }),
    ),
    bus.on('video:delete', ({ videoId }) => onVideos((videos) => videos.remove(videoId), 'video-deleted')),
    bus.on('videos:clear', () => onVideos((videos) => videos.clear(), 'videos-cleared')),
    bus.on('videos:prune', () =>
      onVideos(async (videos) => {
        const storage = (await options.estimateStorage?.()) ?? store.state.storage;
        if (storage) await videos.removeMany(videosToPrune(store.state.videos ?? [], storage));
      }, 'videos-cleared'),
    ),
    bus.on('home:search', ({ query }) => store.update({ query })),
    bus.on('home:sort', ({ sort }) => setPreferences({ sort })),
    bus.on('home:view', ({ view }) => setPreferences({ view })),
    bus.on('home:sheet', ({ sheet }) => store.update({ sheet })),
    bus.on('home:hero:visibility', ({ visible }) => store.update({ heroVisible: visible })),
    bus.on('settings:change', (changes) => setPreferences(changes)),
  ];

  if (options.installer) store.update({ install: options.installer.mode() });
  run(refresh);

  return {
    refresh: () => {
      run(refresh);
      return pending.then(() => undefined);
    },
    settled: () => pending.then(() => undefined),
    disconnect: () => unsubscribers.forEach((unsubscribe) => unsubscribe()),
  };
}
