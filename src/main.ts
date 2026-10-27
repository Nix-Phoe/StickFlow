// Point d'entrée : crée le bus et le store, monte l'interface et branche les modules.

import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/controls.css';

import { createEventBus } from './core/events';
import { connectIntents } from './core/intents';
import { createInitialState, Store } from './core/store';
import type { Component, ComponentContext } from './ui/component';
import { createCanvasArea } from './ui/components/canvas-area';
import { createSidePanel } from './ui/components/side-panel';
import { createTimeline } from './ui/components/timeline';
import { createToolbar } from './ui/components/toolbar';
import { h } from './ui/dom';
import { strings } from './ui/strings';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Élément #app introuvable');

const bus = createEventBus();
const store = new Store(createInitialState(strings.defaultProjectName));
connectIntents(bus, store);

// Phase 1 : chaque événement est journalisé pour vérifier le branchement de l'UI.
bus.onAny((type, payload) => {
  console.info(`[event] ${String(type)}`, payload ?? '');
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
