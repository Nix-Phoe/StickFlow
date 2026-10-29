import '../styles/components/side-panel.css';

import { saveStatus } from '../../core/selectors';
import {
  EXPORT_FORMATS,
  LIMITS,
  SMOOTHING_CURVES,
  type ExportFormat,
  type Notice,
  type SmoothingCurve,
} from '../../core/types';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { createSegmented } from '../controls/segmented';
import { createSlider } from '../controls/slider';
import { createStepper } from '../controls/stepper';
import { createSwitch } from '../controls/switch';
import { DRAWER_MEDIA_QUERY, h, ids, type Child } from '../dom';
import { icon, type IconName } from '../icons';
import { logo } from '../logo';
import { strings } from '../strings';

const t = strings.panel;

/**
 * Panneau gauche : en-tête du projet, réglages IA, réglages d'animation et export.
 * Sous 900 px de large, il devient un tiroir piloté par `state.drawerOpen`.
 */
export function createSidePanel({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  const drawerQuery = window.matchMedia(DRAWER_MEDIA_QUERY);
  let focusBeforeOpen: HTMLElement | null = null;

  // ---------- En-tête ----------
  // Le nom se modifie directement ; chaque frappe est un changement du Projet (regroupés en une étape).
  const projectName = h('input', {
    type: 'text',
    class: 'side-panel__project-name',
    'aria-label': t.projectName,
    maxlength: LIMITS.projectNameLength,
    autocomplete: 'off',
    spellcheck: false,
    'data-action': 'project:rename',
  });
  projectName.addEventListener('input', () => bus.emit('project:rename', { name: projectName.value }));
  // Un nom vide est refusé : en quittant le champ, il retrouve le nom du Projet.
  projectName.addEventListener('change', () => (projectName.value = store.state.project.present.name));
  projectName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') projectName.blur();
  });
  const saveStatusText = h('p', { class: 'side-panel__save-status' });

  const openButton = h(
    'button',
    { type: 'button', class: 'button-secondary', 'data-action': 'project:library:request' },
    [icon('open'), t.open],
  );
  openButton.addEventListener('click', () => bus.emit('project:library:request'));
  const saveAsButton = h(
    'button',
    { type: 'button', class: 'button-secondary', 'data-action': 'project:save-as' },
    [icon('saveAs'), t.saveAs],
  );
  saveAsButton.addEventListener('click', () =>
    bus.emit('project:save-as', { name: t.copyName(store.state.project.present.name) }),
  );
  const closeButton = createIconButton({
    icon: 'close',
    label: t.closeDrawer,
    action: 'ui:drawer:toggle',
    variant: 'filled',
    className: 'side-panel__close',
    onClick: () => bus.emit('ui:drawer:toggle', { open: false }),
  });
  const saveButton = createIconButton({
    icon: 'save',
    label: t.save,
    action: 'project:save',
    variant: 'accent',
    onClick: () => bus.emit('project:save'),
  });

  // Retour à l'accueil : le projet est sauvegardé en quittant l'éditeur.
  const backButton = h(
    'button',
    { type: 'button', class: 'side-panel__back', 'aria-label': t.back, title: t.back, 'data-action': 'route:change' },
    [icon('back', 'icon side-panel__back-chevron'), h('span', { class: 'side-panel__brand' }, [logo('side-panel__logo')])],
  );
  backButton.addEventListener('click', () => bus.emit('route:change', { route: { name: 'home' } }));

  // Le mode se choisit dans le panneau « Personnages & Environnement » ; ici, un simple rappel.
  const modeIndicator = h('p', { class: 'side-panel__mode', 'aria-live': 'polite' });

  const header = h('header', { class: 'side-panel__header' }, [
    h('div', { class: 'side-panel__title-row' }, [
      backButton,
      h('div', { class: 'side-panel__titles' }, [
        h('p', { class: 'side-panel__app-name' }, [strings.appName]),
        projectName,
        saveStatusText,
        modeIndicator,
      ]),
      saveButton,
      closeButton,
    ]),
    h('div', { class: 'side-panel__file-actions' }, [openButton, saveAsButton]),
  ]);

  // ---------- Fluidité ----------
  const smoothing = store.state.project.present.ai.smoothing;
  const smoothingSwitch = createSwitch({
    label: t.smoothing.toggle,
    action: 'ai:smoothing:change',
    checked: smoothing.enabled,
    onChange: (enabled) => bus.emit('ai:smoothing:change', { enabled }),
  });
  const intensityValue = h('span', { class: 'group__value', 'aria-hidden': 'true' });
  const intensitySlider = createSlider({
    id: 'smoothing-intensity',
    action: 'ai:smoothing:change',
    ...LIMITS.smoothingIntensity,
    value: smoothing.intensity,
    formatValue: strings.units.frames,
    onChange: (intensity) => bus.emit('ai:smoothing:change', { intensity }),
  });
  const curveControl = createSegmented<SmoothingCurve>({
    label: t.smoothing.curve,
    action: 'ai:smoothing:change',
    options: SMOOTHING_CURVES.map((curve) => ({
      value: curve,
      label: t.smoothing.curvesShort[curve],
      ariaLabel: t.smoothing.curves[curve],
    })),
    value: smoothing.curve,
    onChange: (curve) => bus.emit('ai:smoothing:change', { curve }),
  });

  const intensityRow = stackedRow(
    labelFor('smoothing-intensity', t.smoothing.intensity),
    intensityValue,
    intensitySlider.element,
  );
  const curveRow = stackedRow(h('span', { class: 'group__label' }, [t.smoothing.curve]), null, curveControl.element);

  const smoothingGroup = h('div', { class: 'group' }, [
    featureRow('sparkles', t.smoothing.title, t.smoothing.description, smoothingSwitch.element),
    intensityRow,
    curveRow,
  ]);

  // ---------- Répétition ----------
  const loop = store.state.project.present.ai.loop;

  const loopSwitch = createSwitch({
    label: t.loop.toggle,
    action: 'ai:loop:change',
    checked: loop.enabled,
    onChange: (enabled) => bus.emit('ai:loop:change', { enabled }),
  });
  const repeatStepper = createStepper({
    id: 'loop-repeat',
    label: t.loop.repeat,
    action: 'ai:loop:change',
    ...LIMITS.loopRepeat,
    value: loop.repeatCount,
    onChange: (repeatCount) => bus.emit('ai:loop:change', { repeatCount }),
  });
  const infiniteChip = h(
    'button',
    {
      type: 'button',
      class: 'chip',
      'aria-pressed': 'false',
      'aria-label': t.loop.infiniteToggle,
      'data-action': 'ai:loop:change',
    },
    [icon('infinity'), t.loop.infinite],
  );
  infiniteChip.addEventListener('click', () =>
    bus.emit('ai:loop:change', { infinite: !store.state.project.present.ai.loop.infinite }),
  );

  const transitionValue = h('span', { class: 'group__value', 'aria-hidden': 'true' });
  const transitionSlider = createSlider({
    id: 'loop-transition',
    action: 'ai:loop:change',
    ...LIMITS.loopTransitionFrames,
    value: loop.transitionFrames,
    formatValue: strings.units.frames,
    onChange: (transitionFrames) => bus.emit('ai:loop:change', { transitionFrames }),
  });

  const repeatRow = h('div', { class: 'group__row side-panel__repeat-row' }, [
    labelFor('loop-repeat', t.loop.repeat),
    h('div', { class: 'group__controls' }, [repeatStepper.element, infiniteChip]),
  ]);
  const transitionRow = stackedRow(
    labelFor('loop-transition', t.loop.transition),
    transitionValue,
    transitionSlider.element,
  );

  const loopGroup = h('div', { class: 'group' }, [
    featureRow('repeat', t.loop.title, t.loop.description, loopSwitch.element),
    repeatRow,
    transitionRow,
  ]);

  // ---------- Animation ----------
  const fpsStepper = createStepper({
    id: 'animation-fps',
    label: t.fps,
    action: 'animation:fps:change',
    ...LIMITS.fps,
    value: store.state.project.present.fps,
    onChange: (fps) => bus.emit('animation:fps:change', { fps }),
  });
  const onionSkinSwitch = createSwitch({
    label: t.onionSkinToggle,
    action: 'animation:onion-skin:change',
    checked: store.state.session.onionSkin,
    onChange: (enabled) => bus.emit('animation:onion-skin:change', { enabled }),
  });
  const animationGroup = h('div', { class: 'group' }, [
    h('div', { class: 'group__row' }, [
      h('span', { class: 'side-panel__row-icon', 'aria-hidden': 'true' }, [icon('fps')]),
      labelFor('animation-fps', t.fps),
      fpsStepper.element,
    ]),
    h('div', { class: 'group__row' }, [
      h('span', { class: 'side-panel__row-icon', 'aria-hidden': 'true' }, [icon('onionSkin')]),
      h('span', { class: 'group__label' }, [t.onionSkin]),
      onionSkinSwitch.element,
    ]),
  ]);

  const body = h('div', { class: 'side-panel__body' }, [
    section('section-ai', t.aiSection, [smoothingGroup, loopGroup]),
    section('section-animation', t.animationSection, [animationGroup]),
    // Emplacements réservés (effets prédéfinis, zone de prompt) : phase 8.
    section('section-effects', t.effectsSection, [], { slot: 'effects', hidden: true }),
    section('section-prompt', t.promptSection, [], { slot: 'prompt', hidden: true }),
  ]);

  // ---------- Export ----------
  const formatControl = createSegmented<ExportFormat>({
    label: t.exportFormat,
    action: 'export:format:change',
    options: EXPORT_FORMATS.map((format) => ({ value: format, label: t.formats[format] })),
    value: store.state.session.exportFormat,
    onChange: (format) => bus.emit('export:format:change', { format }),
  });
  const exportLabel = h('span', {}, [t.export]);
  const exportButton = h(
    'button',
    { type: 'button', class: 'button-primary side-panel__export', 'data-action': 'export:request' },
    [icon('download'), exportLabel],
  );
  exportButton.addEventListener('click', () =>
    bus.emit('export:request', { format: store.state.session.exportFormat }),
  );
  // Résultat de la dernière action longue (enregistrement, ouverture, export), annoncé aux lecteurs d'écran.
  const notice = h('p', { class: 'side-panel__notice', role: 'status', 'aria-live': 'polite' });
  const footer = h('footer', { class: 'side-panel__footer' }, [formatControl.element, exportButton, notice]);

  // ---------- Racine ----------
  const panel = h('div', { class: 'side-panel', id: ids.sidePanel, tabindex: -1 }, [header, body, footer]);
  const scrim = h('div', { class: 'side-panel__scrim', 'aria-hidden': 'true' });
  scrim.addEventListener('click', () => bus.emit('ui:drawer:toggle', { open: false }));
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawerQuery.matches && store.state.session.drawerOpen) {
      bus.emit('ui:drawer:toggle', { open: false });
    }
  });

  // ---------- Abonnements au store ----------
  cleanups.push(
    store.watch(
      (s) => s.project.present.name,
      (name) => {
        if (document.activeElement !== projectName) projectName.value = name;
      },
    ),
    store.watch(saveStatus, (status) => {
      saveStatusText.textContent = t.saveStatus[status];
      saveStatusText.dataset.status = status;
    }),
    store.watch(
      (s) => s.session.exportProgress,
      (progress) => {
        exportButton.disabled = progress !== null;
        exportLabel.textContent = progress === null ? t.export : t.exporting(progress);
      },
    ),
    store.watch((s) => s.session.notice, (value) => (notice.textContent = value ? noticeText(value) : '')),
    store.watch((s) => s.session.editorMode, (mode) => {
      modeIndicator.textContent = t.modeIndicator(mode);
      modeIndicator.dataset.mode = mode;
    }),
    store.watch(
      (s) => s.project.present.ai.smoothing,
      (value) => {
        smoothingSwitch.setChecked(value.enabled);
        intensitySlider.setValue(value.intensity);
        intensityValue.textContent = strings.units.frames(value.intensity);
        curveControl.setValue(value.curve);
        setRowDisabled(intensityRow, !value.enabled);
        setRowDisabled(curveRow, !value.enabled);
        intensitySlider.setDisabled(!value.enabled);
        curveControl.setDisabled(!value.enabled);
      },
    ),
    store.watch(
      (s) => s.project.present.ai.loop,
      (value) => {
        loopSwitch.setChecked(value.enabled);
        repeatStepper.setValue(value.repeatCount);
        repeatStepper.setDisabled(!value.enabled || value.infinite);
        infiniteChip.setAttribute('aria-pressed', String(value.infinite));
        infiniteChip.disabled = !value.enabled;
        transitionSlider.setValue(value.transitionFrames);
        transitionSlider.setDisabled(!value.enabled);
        transitionValue.textContent = strings.units.frames(value.transitionFrames);
        setRowDisabled(repeatRow, !value.enabled);
        setRowDisabled(transitionRow, !value.enabled);
      },
    ),
    store.watch((s) => s.project.present.fps, (fps) => fpsStepper.setValue(fps)),
    store.watch((s) => s.session.onionSkin, (enabled) => onionSkinSwitch.setChecked(enabled)),
    store.watch((s) => s.session.exportFormat, (format) => formatControl.setValue(format)),
    store.watch((s) => s.session.drawerOpen, () => applyDrawerState(true)),
  );

  const onQueryChange = (): void => applyDrawerState(false);
  drawerQuery.addEventListener('change', onQueryChange);
  cleanups.push(() => drawerQuery.removeEventListener('change', onQueryChange));

  function applyDrawerState(manageFocus: boolean): void {
    const isDrawer = drawerQuery.matches;
    const open = isDrawer && store.state.session.drawerOpen;
    panel.classList.toggle('is-open', open);
    scrim.classList.toggle('is-visible', open);
    panel.inert = isDrawer && !open;
    if (open) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', strings.regions.panel);
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-label');
    }

    if (!manageFocus || !isDrawer) return;
    if (open) {
      focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButton.focus();
    } else if (focusBeforeOpen) {
      focusBeforeOpen.focus();
      focusBeforeOpen = null;
    }
  }

  return {
    mount(parent) {
      parent.append(scrim, panel);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      scrim.remove();
      panel.remove();
    },
  };
}

// ---------- Aides de construction ----------

function section(
  id: string,
  title: string,
  children: readonly Child[],
  options: { slot?: string; hidden?: boolean } = {},
): HTMLElement {
  return h(
    'section',
    {
      class: 'side-panel__section',
      'aria-labelledby': id,
      'data-slot': options.slot,
      hidden: options.hidden,
    },
    [h('h2', { class: 'side-panel__section-title', id }, [title]), ...children],
  );
}

function featureRow(iconName: IconName, title: string, description: string, control: Child): HTMLElement {
  return h('div', { class: 'group__row side-panel__feature' }, [
    h('span', { class: 'side-panel__feature-icon', 'aria-hidden': 'true' }, [icon(iconName)]),
    h('div', { class: 'side-panel__feature-text' }, [
      h('h3', { class: 'side-panel__feature-title' }, [title]),
      h('p', { class: 'side-panel__feature-description' }, [description]),
    ]),
    control,
  ]);
}

function stackedRow(label: HTMLElement, value: HTMLElement | null, control: HTMLElement): HTMLElement {
  return h('div', { class: 'group__row group__row--stacked' }, [
    h('div', { class: 'group__row-header' }, value ? [label, value] : [label]),
    control,
  ]);
}

function labelFor(id: string, text: string): HTMLLabelElement {
  return h('label', { class: 'group__label', for: id }, [text]);
}

/** Texte de la notification : nom du fichier pour un export, détail technique pour un échec. */
function noticeText({ code, kind, detail }: Notice): string {
  const text = t.notices[code];
  if (code === 'exported' && detail) return `${text} : ${detail}`;
  if (kind === 'error' && detail) return `${text} (${detail})`;
  return text;
}

function setRowDisabled(row: HTMLElement, disabled: boolean): void {
  row.setAttribute('aria-disabled', String(disabled));
}
