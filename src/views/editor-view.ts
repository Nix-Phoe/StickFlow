// Vue « Éditeur » : l'éditeur d'animation d'un projet enregistré. Elle crée son bus, son store
// et ses modules au montage, et libère tout à la destruction (écouteurs, rendu, contexte WebGL).
// Avant de quitter, le projet est sauvegardé s'il a changé.

import { connectPlayer } from '../animation';
import { createEventBus, type AppEventName } from '../core/events';
import { isVideoType } from '../core/home-state';
import { connectIntents } from '../core/intents';
import type { Route } from '../core/router';
import { createStateFromProject, Store } from '../core/store';
import { connectDrawingTool } from '../drawing/drawing-tool';
import { createDrawingSurface } from '../drawing/surface';
import { connectExporter } from '../export';
import { connectCharacterManipulation, connectShapeManipulation } from '../interaction';
import { connectStageView } from '../render';
import type { DrawingImage } from '../render/canvas2d';
import { projectThumbnail } from '../render/thumbnail';
import { connectProjectStorage, type ProjectLibrary, type ProjectStorage } from '../storage';
import type { VideoLibrary } from '../storage/video-store';
import type { Component, ComponentContext } from '../ui/component';
import { createCanvasArea } from '../ui/components/canvas-area';
import { createCharactersTab } from '../ui/components/characters-tab';
import { createEditorPanel } from '../ui/components/editor-panel';
import { createEnvironmentTab } from '../ui/components/environment-tab';
import { createPartialPaintWindow } from '../ui/components/partial-paint-window';
import { createProjectsDialog } from '../ui/components/projects-dialog';
import { createSidePanel } from '../ui/components/side-panel';
import { createTimeline } from '../ui/components/timeline';
import { createToolbar } from '../ui/components/toolbar';
import { h, ids } from '../ui/dom';
import { downloadBlob } from '../ui/download';
import { strings } from '../ui/strings';
import type { View } from './view-host';

export interface EditorViewOptions {
  projectId: string;
  library: ProjectLibrary;
  /** Vidéos exportées conservées dans l'app (« Mes vidéos »). */
  videos: VideoLibrary;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
}

/** Débogage : chaque événement est journalisé, sauf ceux émis en continu (glisser, lecture). */
const QUIET_EVENTS: ReadonlySet<AppEventName> = new Set(['stage:pointer:move', 'frame:pose:change', 'playback:frame']);

export function createEditorView({ projectId, library, videos, navigate }: EditorViewOptions): View {
  const root = h('div', { class: 'app', 'aria-busy': 'true' });
  const cleanups: Array<() => void> = [];
  let storage: ProjectStorage | null = null;
  let store: Store | null = null;
  let destroyed = false;

  async function load(): Promise<void> {
    let project;
    try {
      project = await library.load(projectId);
    } catch (error) {
      console.error('[editor] Projet introuvable :', error);
      if (!destroyed) navigate({ name: 'home' }, { replace: true });
      return;
    }
    if (destroyed) return;
    build(createStateFromProject(project, projectId));
  }

  function build(initial: ReturnType<typeof createStateFromProject>): void {
    const bus = createEventBus();
    const editorStore = new Store(initial);
    store = editorStore;
    const drawing = createDrawingSurface();
    const context: ComponentContext = { bus, store: editorStore };

    const drawingImage = (): DrawingImage => ({ image: drawing.canvas, bounds: drawing.bounds });
    // La vignette de l'accueil est régénérée à chaque sauvegarde, à partir de la première frame.
    storage = connectProjectStorage({ bus, store: editorStore, library, thumbnail: (project) => projectThumbnail(project, drawingImage()) });
    cleanups.push(
      connectIntents(bus, editorStore),
      connectCharacterManipulation(context),
      connectShapeManipulation(context),
      connectDrawingTool({ bus, store: editorStore, surface: drawing }),
      connectPlayer(context),
      storage.disconnect,
      connectExporter({
        bus,
        store: editorStore,
        download: downloadBlob,
        drawing,
        // Un GIF ou une vidéo rejoint aussi « Mes vidéos » sur l'accueil.
        onExported: (result, project) => {
          if (!isVideoType(result.extension)) return;
          void videos
            .add({
              projectId: editorStore.state.session.documentId,
              projectName: project.name,
              type: result.extension,
              blob: result.blob,
              duration: result.duration,
              thumbnail: projectThumbnail(project, drawingImage()),
            })
            .catch((error: unknown) => console.warn('[videos] Vidéo non conservée :', error));
        },
      }),
      bus.onAny((type, payload) => {
        if (!QUIET_EVENTS.has(type as AppEventName)) console.info(`[event] ${String(type)}`, payload ?? '');
      }),
      // Retour à l'accueil (bouton du panneau) : la sauvegarde se fait en quittant la vue.
      bus.on('route:change', ({ route }) => navigate(route)),
      // « Enregistrer sous » ou « Ouvrir » changent de document : l'adresse suit, sans recharger la vue.
      editorStore.watch(
        (s) => s.session.documentId,
        (documentId) => {
          if (documentId && documentId !== currentId()) navigate({ name: 'editor', projectId: documentId }, { replace: true });
        },
      ),
    );

    const regions = {
      panel: h('aside', { class: 'app__panel', 'aria-label': strings.regions.panel }),
      toolbar: h('header', { class: 'app__toolbar', 'aria-label': strings.regions.toolbar }),
      stage: h('main', { class: 'app__stage', 'aria-label': strings.regions.stage }),
      timeline: h('section', { class: 'app__timeline', 'aria-label': strings.regions.timeline }),
    };
    root.append(regions.panel, regions.toolbar, regions.stage, regions.timeline);

    const components: Array<[Component, HTMLElement]> = [
      [createSidePanel(context), regions.panel],
      [createToolbar(context), regions.toolbar],
      [createCanvasArea(context), regions.stage],
      [createTimeline(context, { image: drawingImage, onChange: drawing.onChange }), regions.timeline],
      [createProjectsDialog(context), root],
      [createEditorPanel(context), root],
    ];
    for (const [component, parent] of components) {
      component.mount(parent);
      cleanups.push(() => component.destroy());
    }
    // Les onglets du panneau flottant se montent dans les emplacements qu'il a créés.
    const tabs: Array<[Component, string]> = [
      [createCharactersTab(context), ids.charactersTab],
      [createEnvironmentTab(context), ids.environmentTab],
    ];
    for (const [component, slotId] of tabs) {
      const slot = root.querySelector<HTMLElement>(`#${slotId}`);
      if (!slot) continue;
      component.mount(slot);
      cleanups.push(() => component.destroy());
    }
    // Après le panneau et ses onglets : elle peut prendre la place du panneau (petits écrans).
    const paintWindow = createPartialPaintWindow(context);
    paintWindow.mount(root);
    cleanups.push(() => paintWindow.destroy());

    // Le rendu dessine dans le canvas monté par CanvasArea ; l'UI, elle, ne dessine jamais.
    const stage = root.querySelector(`#${ids.stage}`);
    if (stage instanceof HTMLCanvasElement) {
      try {
        cleanups.push(connectStageView({ bus, store: editorStore, canvas: stage, drawing }));
      } catch (error) {
        console.error('[render] Rendu indisponible :', error);
      }
    }
    root.removeAttribute('aria-busy');
  }

  const currentId = (): string => store?.state.session.documentId ?? projectId;

  return {
    mount(parent) {
      parent.append(root);
      document.title = strings.documentTitle.editor;
      void load();
    },
    update: (route) => route.name === 'editor' && route.projectId === currentId(),
    async leave() {
      await storage?.saveIfModified();
    },
    destroy() {
      destroyed = true;
      // Dans l'ordre inverse du montage : les composants avant les modules qu'ils utilisent.
      cleanups.reverse().forEach((cleanup) => cleanup());
      cleanups.length = 0;
      root.remove();
    },
  };
}
