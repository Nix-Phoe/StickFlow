import '../../styles/components/background-page.css';

import { BACKGROUND_TABS, type BackgroundTab } from '../../../core/session';
import { aspectRatio } from '../../../core/formats';
import { clamp, type Background } from '../../../core/types';
import type { Component } from '../../component';
import { createSegmented } from '../../controls/segmented';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import { createBuiltinPane } from './builtin-pane';
import { createColorPane } from './color-pane';
import { createGesture, paintPreview, type BackgroundContext } from './context';
import { createDevicePane } from './device-pane';
import { createImageSettings } from './image-settings';
import { createInternetPane } from './internet-pane';

const t = strings.background;
/** Pas du point focal au clavier (flèches sur l'aperçu). */
const FOCUS_STEP = 0.05;

/** Type affiché de l'arrière-plan (« Couleur », « Image »…). */
export function backgroundKind(background: Background | null): string {
  return t.kinds[background?.type ?? 'none'];
}

/**
 * Sous-page « Arrière-plan » du panneau Environnement (navigation iOS) : bouton Retour, aperçu
 * aux proportions du format (point focal d'une image déplaçable au glisser et aux flèches), crédit
 * d'une photo, réglages d'une image, « Retirer l'arrière-plan », puis les sources : Couleur,
 * Intégrés, Appareil, Internet. Les erreurs d'import sont annoncées (`aria-live`).
 */
export function createBackgroundPage(context: BackgroundContext): Component {
  const { bus, store, preview } = context;
  const cleanups: Array<() => void> = [];

  const back = h('button', { type: 'button', class: 'background-page__back', 'data-action': 'background:open' }, [icon('back'), t.back]);
  back.addEventListener('click', () => bus.emit('background:open', { open: false }));
  const header = h('header', { class: 'background-page__header' }, [back, h('h3', { class: 'background-page__title', id: 'background-page-title' }, [t.title])]);

  // ---------- Aperçu (point focal) ----------
  const canvas = h('canvas', { class: 'background-page__canvas', 'aria-hidden': 'true' });
  const previewBox = h('div', { class: 'background-page__preview', role: 'img', 'aria-label': t.preview }, [canvas]);
  const credit = h('p', { class: 'background-page__credit' });
  const repaint = (): void => paintPreview(canvas, preview);
  cleanups.push(preview.onChange(repaint));
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(repaint) : null;
  resizeObserver?.observe(canvas);
  cleanups.push(() => resizeObserver?.disconnect());

  const image = () => {
    const background = store.state.project.present.environment.background;
    return background?.type === 'image' ? background : null;
  };
  const focusGesture = createGesture();
  let drag: { x: number; y: number; focus: { x: number; y: number } } | null = null;
  previewBox.addEventListener('pointerdown', (event) => {
    const current = image();
    if (!current || !event.isPrimary) return;
    previewBox.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, focus: current.focus };
  });
  previewBox.addEventListener('pointermove', (event) => {
    const current = image();
    if (!drag || !current) return;
    // On « attrape » l'image : la glisser vers la gauche montre sa partie droite.
    const rect = previewBox.getBoundingClientRect();
    const focus = {
      x: clamp(drag.focus.x - (event.clientX - drag.x) / (rect.width * current.zoom), 0, 1),
      y: clamp(drag.focus.y - (event.clientY - drag.y) / (rect.height * current.zoom), 0, 1),
    };
    bus.emit('background:update', { changes: { focus }, gesture: focusGesture.token() });
  });
  const endDrag = (): void => {
    drag = null;
    focusGesture.end();
  };
  previewBox.addEventListener('pointerup', endDrag);
  previewBox.addEventListener('pointercancel', endDrag);
  previewBox.addEventListener('keydown', (event) => {
    const current = image();
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.key];
    if (!current || !move) return;
    event.preventDefault();
    const focus = { x: clamp(current.focus.x + move[0] * FOCUS_STEP, 0, 1), y: clamp(current.focus.y + move[1] * FOCUS_STEP, 0, 1) };
    bus.emit('background:update', { changes: { focus } });
  });

  const settings = createImageSettings(context);
  const remove = h('button', { type: 'button', class: 'button-secondary background-page__remove', 'data-action': 'background:remove' }, [icon('trash'), t.remove]);
  remove.addEventListener('click', () => bus.emit('background:remove'));

  // ---------- Sources ----------
  const tabs = createSegmented<BackgroundTab>({
    label: t.tabsLabel,
    action: 'background:open',
    className: 'background-page__tabs',
    options: BACKGROUND_TABS.map((value) => ({ value, label: t.tabs[value] })),
    value: store.state.session.backgroundPage.tab,
    onChange: (tab) => bus.emit('background:open', { open: true, tab }),
  });
  const panes: Record<BackgroundTab, Component> = {
    color: createColorPane(context),
    builtin: createBuiltinPane(context),
    device: createDevicePane(context),
    internet: createInternetPane(context),
  };
  const slot = (tab: BackgroundTab): HTMLElement => {
    const element = h('div', { class: 'background-page__pane', role: 'region', 'aria-label': t.tabs[tab] });
    panes[tab].mount(element);
    return element;
  };
  const slots: Record<BackgroundTab, HTMLElement> = { color: slot('color'), builtin: slot('builtin'), device: slot('device'), internet: slot('internet') };

  // Import en cours (poli) et erreurs (urgentes), lus par les lecteurs d'écran.
  const busy = h('p', { class: 'background-page__status', role: 'status', 'aria-live': 'polite' });
  const error = h('p', { class: 'background-page__error', role: 'alert' });

  const settingsSlot = h('div', {});
  settings.mount(settingsSlot);
  const root = h('section', { class: 'background-page', 'aria-labelledby': 'background-page-title' }, [
    header,
    previewBox,
    credit,
    busy,
    error,
    settingsSlot,
    remove,
    tabs.element,
    ...BACKGROUND_TABS.map((tab) => slots[tab]),
  ]);
  // Échap revient à la page principale de l'onglet avant de fermer le panneau.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    bus.emit('background:open', { open: false });
  });

  function renderBackground(): void {
    const { background } = store.state.project.present.environment;
    const current = background?.type === 'image' ? background : null;
    previewBox.tabIndex = current ? 0 : -1;
    previewBox.classList.toggle('is-movable', current !== null);
    previewBox.title = current ? t.previewHint : '';
    previewBox.style.setProperty('--preview-ratio', String(aspectRatio(store.state.project.present.format)));
    remove.hidden = background === null;
    credit.replaceChildren();
    if (current?.credit) {
      credit.append(h('a', { href: current.credit.url, target: '_blank', rel: 'noopener noreferrer' }, [t.credit(current.credit.author, current.credit.provider)]));
    }
    credit.hidden = !current?.credit;
    repaint();
  }

  cleanups.push(
    store.watch((s) => s.project.present.environment.background, renderBackground),
    store.watch((s) => s.project.present.format, renderBackground),
    store.watch(
      (s) => s.session.backgroundPage.tab,
      (tab) => {
        tabs.setValue(tab);
        for (const name of BACKGROUND_TABS) slots[name].hidden = name !== tab;
      },
    ),
    store.watch(
      (s) => s.session.assetImport,
      (state) => {
        busy.textContent = state.status === 'busy' ? t.importing : '';
        error.textContent = state.status === 'error' && state.error ? t.errors[state.error] : '';
        error.hidden = error.textContent === '';
        root.setAttribute('aria-busy', String(state.status === 'busy'));
      },
    ),
  );

  return {
    mount(parent) {
      parent.append(root);
      repaint();
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      Object.values(panes).forEach((pane) => pane.destroy());
      settings.destroy();
      root.remove();
    },
  };
}
