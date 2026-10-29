import '../../styles/components/home/create-project-sheet.css';

import { LIMITS } from '../../../core/types';
import { TEMPLATE_IDS } from '../../../templates';
import type { Component } from '../../component';
import { createFormatPicker } from '../../controls/format-picker';
import { createSheet } from '../../controls/sheet';
import { createStepper } from '../../controls/stepper';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.createSheet;

/**
 * Feuille de création : nom, format, IPS et modèle de départ facultatif. Elle repart des valeurs
 * par défaut (Réglages) à chaque ouverture ; choisir un modèle reprend son IPS.
 */
export function createCreateProjectSheet({ bus, store, templates }: HomeContext): Component {
  let format = store.state.preferences.defaultFormat;
  let fps = store.state.preferences.defaultFps;
  let templateId: string | null = null;

  const nameInput = h('input', {
    type: 'text',
    id: 'create-name',
    class: 'sheet__input',
    placeholder: t.namePlaceholder,
    maxlength: LIMITS.projectNameLength,
    autocomplete: 'off',
    enterkeyhint: 'done',
  });
  const formatPicker = createFormatPicker({
    name: 'create-format',
    label: strings.formats.label,
    action: 'project:create',
    value: format,
    onChange: (value) => {
      format = value;
      formatPicker.setValue(value);
    },
  });
  const fpsStepper = createStepper({
    id: 'create-fps',
    label: strings.home.fps,
    action: 'project:create',
    ...LIMITS.fps,
    value: fps,
    onChange: (value) => {
      fps = value;
      fpsStepper.setValue(value);
    },
  });

  // Modèle de départ : pastilles « Aucun » + un par modèle (groupe de boutons radio).
  const templateChips = [null, ...TEMPLATE_IDS].map((id) => {
    const chip = h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': 'false', 'data-action': 'project:create' }, [
      id === null ? t.noTemplate : strings.templates.names[id],
    ]);
    chip.addEventListener('click', () => selectTemplate(id, true));
    return [id, chip] as const;
  });
  const templateGroup = h(
    'div',
    { class: 'create-sheet__templates', role: 'radiogroup', 'aria-labelledby': 'create-template-label' },
    templateChips.map(([, chip]) => chip),
  );

  function selectTemplate(id: string | null, adoptFps: boolean): void {
    templateId = id;
    for (const [chipId, chip] of templateChips) chip.setAttribute('aria-checked', String(chipId === id));
    const template = id ? templates.load(id) : null;
    if (template && adoptFps) {
      fps = template.fps;
      fpsStepper.setValue(fps);
    }
  }

  const submit = h('button', { type: 'submit', class: 'button-primary', form: 'create-project-form', 'data-action': 'project:create' }, [
    icon('plus'),
    t.submit,
  ]);
  const cancel = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'home:sheet' }, [t.cancel]);
  cancel.addEventListener('click', () => bus.emit('home:sheet', { sheet: null }));

  const form = h('form', { id: 'create-project-form', class: 'create-sheet__form', novalidate: true }, [
    h('div', { class: 'sheet__field' }, [h('label', { class: 'sheet__label', for: 'create-name' }, [t.name]), nameInput]),
    h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [strings.formats.label]), formatPicker.element]),
    h('div', { class: 'sheet__row' }, [h('label', { class: 'sheet__label', for: 'create-fps' }, [strings.home.fps]), fpsStepper.element]),
    h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label', id: 'create-template-label' }, [t.template]), templateGroup]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    bus.emit('project:create', { name: nameInput.value, format, fps, templateId });
  });

  const sheet = createSheet({
    id: 'create-sheet',
    title: t.title,
    closeLabel: t.cancel,
    body: [form],
    actions: [cancel, submit],
    className: 'create-sheet',
    onClose: () => bus.emit('home:sheet', { sheet: null }),
  });

  const stop = store.watch(
    (s) => s.sheet,
    (value) => {
      const open = value?.kind === 'create';
      if (open && !sheet.dialog.open) {
        // Nouvelle ouverture : on repart des valeurs par défaut.
        const { defaultFormat, defaultFps } = store.state.preferences;
        nameInput.value = '';
        format = defaultFormat;
        fps = defaultFps;
        formatPicker.setValue(format);
        fpsStepper.setValue(fps);
        selectTemplate(value.templateId, true);
      }
      sheet.setOpen(open);
      if (open) nameInput.focus();
    },
  );

  return {
    mount(parent) {
      parent.append(sheet.dialog);
    },
    destroy() {
      stop();
      sheet.setOpen(false);
      sheet.dialog.remove();
    },
  };
}
