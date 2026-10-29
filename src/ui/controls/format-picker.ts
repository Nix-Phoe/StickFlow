import '../styles/format-picker.css';

import {
  CUSTOM_FORMAT_LIMITS,
  FORMAT_PRESETS,
  presetFormat,
  ratioLabel,
  type FormatPreset,
  type VideoFormat,
} from '../../core/formats';
import { h } from '../dom';
import { strings } from '../strings';

export interface FormatPickerOptions {
  /** Nom du groupe de boutons radio (unique dans la page). */
  name: string;
  label: string;
  action: string;
  value: VideoFormat;
  /** `list` : une ligne par format (nom et résolution) ; `tiles` : vignettes compactes. */
  layout?: 'list' | 'tiles';
  onChange: (format: VideoFormat) => void;
}

/** Rectangle d'aperçu aux proportions du format, dans son carré. */
function sizeFrame(frame: HTMLElement, format: VideoFormat): void {
  const ratio = format.width / format.height;
  frame.style.setProperty('--frame-width', `${ratio >= 1 ? 100 : ratio * 100}%`);
  frame.style.setProperty('--frame-height', `${ratio >= 1 ? 100 / ratio : 100}%`);
}

export interface FormatPickerControl {
  element: HTMLFieldSetElement;
  setValue(format: VideoFormat): void;
}

const t = strings.formats;

/**
 * Choix du format de la vidéo : un bouton radio par préréglage, avec un petit rectangle aux
 * proportions du format ; « Personnalisé » ouvre deux champs largeur × hauteur.
 */
export function createFormatPicker(options: FormatPickerOptions): FormatPickerControl {
  const { name, layout = 'list' } = options;
  let current = options.value;

  const radios = new Map<FormatPreset, HTMLInputElement>();
  let customFrame: HTMLElement | null = null;
  const rows = FORMAT_PRESETS.map((preset) => {
    const radio = h('input', { type: 'radio', name, value: preset.id, class: 'format-option__input', 'data-action': options.action });
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      options.onChange(preset.id === 'custom' ? presetFormat('custom', current) : presetFormat(preset.id));
    });
    radios.set(preset.id, radio);
    const format = presetFormat(preset.id);
    const frame = h('span', { class: 'format-option__frame', 'aria-hidden': 'true' });
    sizeFrame(frame, format);
    if (preset.id === 'custom') customFrame = frame;
    const detail = preset.id === 'custom' ? t.customDetail : `${ratioLabel(format)} · ${t.size(format.width, format.height)}`;
    return h('label', { class: 'format-option', title: t.names[preset.id] }, [
      radio,
      h('span', { class: 'format-option__preview' }, [frame]),
      h('span', { class: 'format-option__text' }, [
        h('span', { class: 'format-option__name' }, [layout === 'tiles' ? t.shortNames[preset.id] : t.names[preset.id]]),
        h('span', { class: 'format-option__detail' }, [layout === 'tiles' ? (preset.id === 'custom' ? '' : ratioLabel(format)) : detail]),
      ]),
    ]);
  });

  // Taille libre : deux champs numériques, validés en quittant le champ.
  const sideInput = (side: 'width' | 'height'): HTMLInputElement => {
    const input = h('input', {
      type: 'number',
      class: 'format-picker__side',
      inputmode: 'numeric',
      min: CUSTOM_FORMAT_LIMITS.min,
      max: CUSTOM_FORMAT_LIMITS.max,
      step: 2,
      'aria-label': t[side],
      'data-action': options.action,
    });
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || input.value === '') {
        input.value = String(current[side]);
        return;
      }
      options.onChange(presetFormat('custom', { ...current, [side]: value }));
    });
    return input;
  };
  const widthInput = sideInput('width');
  const heightInput = sideInput('height');
  const custom = h('div', { class: 'format-picker__custom' }, [
    widthInput,
    h('span', { class: 'format-picker__times', 'aria-hidden': 'true' }, ['×']),
    heightInput,
    h('span', { class: 'format-picker__unit' }, [t.pixels]),
  ]);

  const element = h('fieldset', { class: `format-picker format-picker--${layout}` }, [
    h('legend', { class: 'visually-hidden' }, [options.label]),
    h('div', { class: 'format-picker__options' }, rows),
    custom,
  ]);

  function setValue(format: VideoFormat): void {
    current = format;
    const radio = radios.get(format.preset);
    if (radio) radio.checked = true;
    custom.hidden = format.preset !== 'custom';
    if (customFrame && format.preset === 'custom') sizeFrame(customFrame, format);
    if (document.activeElement !== widthInput) widthInput.value = String(format.width);
    if (document.activeElement !== heightInput) heightInput.value = String(format.height);
  }
  setValue(current);

  return { element, setValue };
}
