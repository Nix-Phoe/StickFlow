// Point d'entrée : crée le bus et le store, monte l'interface et branche les modules.

import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/controls.css';

import { createEventBus } from './core/events';
import { connectIntents } from './core/intents';
import type { AppEventName } from './core/events';
import { createInitialState, Store } from './core/store';
import { connectNodeManipulation } from './interaction';
import { createDefaultSkeleton, sortSkeleton } from './model';
import { connectStickmanView } from './render';
import type { Component, ComponentContext } from './ui/component';
import { createCanvasArea } from './ui/components/canvas-area';
import { createSidePanel } from './ui/components/side-panel';
import { createTimeline } from './ui/components/timeline';
import { createToolbar } from './ui/components/toolbar';
import { h, ids } from './ui/dom';
import { strings } from './ui/strings';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Élément #app introuvable');

const bus = createEventBus();
const store = new Store(createInitialState(strings.defaultProjectName, sortSkeleton(createDefaultSkeleton())));
connectIntents(bus, store);
connectNodeManipulation({ bus, store });

// Débogage : chaque événement est journalisé, sauf ceux émis en continu pendant un glisser.
const QUIET_EVENTS: ReadonlySet<AppEventName> = new Set(['stage:pointer:move', 'frame:pose:change']);
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
];
components.forEach(([component, parent]) => component.mount(parent));

// Le rendu dessine dans le canvas monté par CanvasArea ; l'UI, elle, ne dessine jamais.
const stage = document.getElementById(ids.stage);
if (stage instanceof HTMLCanvasElement) {
  try {
    connectStickmanView({ bus, store, canvas: stage });
  } catch (error) {
    console.error('[render] Rendu indisponible :', error);
  }
}
