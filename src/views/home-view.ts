// Vue « Accueil » : retrouver ses projets, en créer (format, modèle), retrouver ses vidéos.
// Elle crée son bus, son store et ses modules au montage, et libère tout à la destruction.

import '../ui/styles/components/home/home.css';

import { createEventBus, type AppEventName } from '../core/events';
import { connectHomeIntents, type HomeIntents } from '../core/home-intents';
import { createHomeState, normalizePreferences, type HomeState } from '../core/home-state';
import type { HomeSection, Route } from '../core/router';
import { Store } from '../core/store';
import { createDrawingSurface, type DrawingSurface } from '../drawing/surface';
import { createAssetImages } from '../environment/asset-images';
import { exportProject } from '../export';
import { projectThumbnail } from '../render/thumbnail';
import type { ProjectLibrary } from '../storage';
import type { PreferencesStore } from '../storage/preferences';
import type { VideoLibrary } from '../storage/video-store';
import { loadTemplate } from '../templates';
import type { Component } from '../ui/component';
import type { HomeContext, TemplateCatalog } from '../ui/components/home/context';
import { createCreateProjectSheet } from '../ui/components/home/create-project-sheet';
import { createExportSheet } from '../ui/components/home/export-sheet';
import { createFloatingAddButton } from '../ui/components/home/floating-add-button';
import { createHeroBanner } from '../ui/components/home/hero-banner';
import { createHomeNotice } from '../ui/components/home/home-notice';
import { createProjectGrid } from '../ui/components/home/project-grid';
import { createSettingsSheet } from '../ui/components/home/settings-sheet';
import { createSidebar } from '../ui/components/home/sidebar';
import { createTopBar } from '../ui/components/home/top-bar';
import { createTemplateCarousel } from '../ui/components/home/template-carousel';
import { createVideoGrid } from '../ui/components/home/video-grid';
import { createVideoPlayerSheet } from '../ui/components/home/video-player-sheet';
import { h } from '../ui/dom';
import { downloadBlob } from '../ui/download';
import { strings } from '../ui/strings';
import type { AssetStore } from '../storage/asset-store';
import { applyTheme } from '../ui/theme';
import { createProjectPreviewer } from './project-previewer';
import type { View } from './view-host';

export interface HomeViewOptions {
  section: HomeSection;
  library: ProjectLibrary;
  preferences: PreferencesStore;
  videos: VideoLibrary;
  /** Images d'arrière-plan (v2.1) : aperçus, exports, et suppression avec le dernier projet qui les utilise. */
  assets: AssetStore;
  navigate: (route: Route) => void;
}

/** Composants de chaque section, de haut en bas. */
const SECTIONS: Record<HomeSection, (context: HomeContext) => Component[]> = {
  home: (context) => [
    createHeroBanner(context),
    createTemplateCarousel(context, { variant: 'carousel' }),
    createProjectGrid(context, { variant: 'recent' }),
    createVideoGrid(context, { variant: 'recent' }),
  ],
  projects: (context) => [createProjectGrid(context, { variant: 'all' })],
  templates: (context) => [createTemplateCarousel(context, { variant: 'all' })],
  videos: (context) => [createVideoGrid(context, { variant: 'all' })],
};

export function createHomeView({ section, library, preferences, videos, assets, navigate }: HomeViewOptions): View {
  const bus = createEventBus();
  const store = new Store<HomeState>(createHomeState(section, normalizePreferences(preferences.load())));
  const images = createAssetImages(assets);
  const preview = createProjectPreviewer(library, images);
  const templates = createTemplateCatalog();
  const context: HomeContext = { bus, store, preview, templates, videoFile: (videoId) => videos.file(videoId) };
  const cleanups: Array<() => void> = [];

  // Calque de dessin des exports lancés depuis l'accueil, créé au premier export.
  let drawing: DrawingSurface | null = null;
  const intents: HomeIntents = connectHomeIntents({
    bus,
    store,
    library,
    preferences,
    navigate,
    templates,
    names: { project: strings.defaultProjectName, character: strings.characters.defaultName(1) },
    thumbnail: (project) => projectThumbnail(project, null),
    exportProject: (project, format, onProgress) => exportProject(project, format, { drawing: (drawing ??= createDrawingSurface()), images, onProgress }),
    download: ({ blob, filename }) => downloadBlob(blob, filename),
    videos,
    assets,
    estimateStorage: estimateStorage,
  });
  cleanups.push(
    intents.disconnect,
    preview.destroy,
    images.destroy,
    bus.onAny((type, payload) => {
      if (!QUIET_EVENTS.has(type as AppEventName)) console.info(`[event] ${String(type)}`, payload ?? '');
    }),
    store.watch((s) => s.preferences.theme, applyTheme),
  );

  const content = h('div', { class: 'home__content' });
  const main = h('main', { class: 'home__main', id: 'home-main', tabindex: -1 }, [content]);
  const root = h('div', { class: 'home' });

  let sectionComponents: Component[] = [];
  function showSection(next: HomeSection): void {
    sectionComponents.forEach((component) => component.destroy());
    sectionComponents = SECTIONS[next](context);
    sectionComponents.forEach((component) => component.mount(content));
    main.scrollTop = 0;
    document.title = next === 'home' ? strings.documentTitle.home : `${strings.home.sections[next]} · ${strings.appName}`;
  }

  return {
    mount(parent) {
      parent.append(root);
      // Dans l'ordre de lecture : barre latérale, contenu, bouton « + », feuilles, messages.
      const sidebar = createSidebar(context);
      sidebar.mount(root);
      root.append(main);
      const topBar = createTopBar(context);
      topBar.mount(content);
      const rest = [
        createFloatingAddButton,
        createCreateProjectSheet,
        createExportSheet,
        createVideoPlayerSheet,
        createSettingsSheet,
        createHomeNotice,
      ].map((create) => create(context));
      rest.forEach((component) => component.mount(root));
      cleanups.push(...[sidebar, topBar, ...rest].map((component) => () => component.destroy()));
      cleanups.push(store.watch((s) => s.section, showSection));
    },
    update(route) {
      if (route.name === 'editor') return false;
      if (route.name === store.state.section) return true;
      store.update({ section: route.name, query: '' });
      // Les listes ont pu changer ailleurs (autre onglet) : on les relit en changeant de section.
      void intents.refresh();
      return true;
    },
    destroy() {
      sectionComponents.forEach((component) => component.destroy());
      cleanups.reverse().forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}

const QUIET_EVENTS: ReadonlySet<AppEventName> = new Set(['home:search']);

/** Espace utilisé et disponible pour l'app, si le navigateur le dit. */
async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.usage !== undefined && estimate.quota !== undefined ? { usage: estimate.usage, quota: estimate.quota } : null;
  } catch {
    return null;
  }
}

/** Modèles de départ et leurs vignettes (calculées une fois). */
function createTemplateCatalog(): TemplateCatalog {
  const thumbnails = new Map<string, string | null>();
  return {
    load: loadTemplate,
    thumbnail(templateId) {
      if (!thumbnails.has(templateId)) {
        const template = loadTemplate(templateId);
        thumbnails.set(templateId, template ? projectThumbnail(template, null) : null);
      }
      return thumbnails.get(templateId) ?? null;
    },
  };
}
