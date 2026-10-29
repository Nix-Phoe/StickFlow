// Point d'entrée : crée le bus et le store, monte l'interface et branche les modules.

import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/controls.css';

import { createEventBus } from './core/events';
import { connectIntents } from './core/intents';
import { connectPlayer } from './animation';
import type { AppEventName } from './core/events';
import { connectExporter } from './export';
import { createInitialState, Store } from './core/store';
import { connectCharacterManipulation, connectShapeManipulation } from './interaction';
import { createDefaultSkeleton, sortSkeleton } from './model';
import { connectDrawingTool } from './drawing/drawing-tool';
import { createDrawingSurface } from './drawing/surface';
import { connectStageView } from './render';
import { connectProjectStorage, createIdbStore, createMemoryStore, createProjectLibrary } from './storage';
import type { Component, ComponentContext } from './ui/component';
import { createCanvasArea } from './ui/components/canvas-area';
import { createCharactersTab } from './ui/components/characters-tab';
import { createEditorPanel } from './ui/components/editor-panel';
import { createPartialPaintWindow } from './ui/components/partial-paint-window';
import { createEnvironmentTab } from './ui/components/environment-tab';
import { createProjectsDialog } from './ui/components/projects-dialog';
import { createSidePanel } from './ui/components/side-panel';
import { createTimeline } from './ui/components/timeline';
import { createToolbar } from './ui/components/toolbar';
import { h, ids } from './ui/dom';
import { downloadBlob } from './ui/download';
import { strings } from './ui/strings';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Élément #app introuvable');

const bus = createEventBus();
const store = new Store(
  createInitialState(strings.defaultProjectName, sortSkeleton(createDefaultSkeleton()), strings.characters.defaultName(1)),
);
const drawing = createDrawingSurface();
connectIntents(bus, store);
connectCharacterManipulation({ bus, store });
connectShapeManipulation({ bus, store });
connectDrawingTool({ bus, store, surface: drawing });
connectPlayer({ bus, store });
// IndexedDB si le navigateur l'autorise (absent en navigation privée sur certains navigateurs) ;
// sinon les projets ne vivent que le temps de la session.
const library = createProjectLibrary(typeof indexedDB === 'undefined' ? createMemoryStore() : createIdbStore());
connectProjectStorage({ bus, store, library });
connectExporter({ bus, store, download: downloadBlob, drawing });

// Débogage : chaque événement est journalisé, sauf ceux émis en continu (glisser, lecture).
const QUIET_EVENTS: ReadonlySet<AppEventName> = new Set(['stage:pointer:move', 'frame:pose:change', 'playback:frame']);
bus.onAny((type, payload) => {
  if (!QUIET_EVENTS.has(type as AppEventName)) console.info(`[event] ${String(type)}`, payload ?? '');
});

const regions = {
  panel: h('aside', { class: 'app__panel', 'aria-label': strings.regions.panel }),
  toolbar: h('header', { class: 'app__toolbar', 'aria-label': strings.regions.toolbar }),
  stage: h('main', { class: 'app__stage', 'aria-label': strings.regions.stage }),
  timeline: h('section', { class: 'app__timeline', 'aria-label': strings.regions.timeline }),
};
root.append(regions.panel, regions.toolbar, regions.stage, regions.timeline);

const context: ComponentContext = { bus, store };
const components: Array<[Component, HTMLElement]> = [
  [createSidePanel(context), regions.panel],
  [createToolbar(context), regions.toolbar],
  [createCanvasArea(context), regions.stage],
  [createTimeline(context), regions.timeline],
  [createProjectsDialog(context), root],
  [createEditorPanel(context), root],
];
components.forEach(([component, parent]) => component.mount(parent));

// Les onglets du panneau flottant se montent dans les emplacements qu'il a créés.
const tabs: Array<[Component, string]> = [
  [createCharactersTab(context), ids.charactersTab],
  [createEnvironmentTab(context), ids.environmentTab],
];
for (const [component, slotId] of tabs) {
  const slot = document.getElementById(slotId);
  if (slot) component.mount(slot);
}
// Après le panneau et ses onglets : elle peut prendre la place du panneau (petits écrans).
createPartialPaintWindow(context).mount(root);

// Le rendu dessine dans le canvas monté par CanvasArea ; l'UI, elle, ne dessine jamais.
const stage = document.getElementById(ids.stage);
if (stage instanceof HTMLCanvasElement) {
  try {
    connectStageView({ bus, store, canvas: stage, drawing });
  } catch (error) {
    console.error('[render] Rendu indisponible :', error);
  }
}
