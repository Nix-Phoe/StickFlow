import { IMAGE_FITS, type ImageBackground, type ImageFit } from '../../../core/types';
import { BACKGROUND_LIMITS } from '../../../model/background';
import type { Component } from '../../component';
import { createSegmented } from '../../controls/segmented';
import { createSwitch } from '../../controls/switch';
import { h } from '../../dom';
import { strings } from '../../strings';
import { createGestureSlider, type BackgroundContext } from './context';

const t = strings.background;
const TINT_COLORS = Object.keys(t.tintColors);
const DEFAULT_TINT = { color: '#000000', amount: 0.3 };

/**
 * Réglages d'une image d'arrière-plan : ajustement, zoom, flou, luminosité, opacité et voile de
 * couleur. Le point focal se règle dans l'aperçu (glisser ou flèches). Chaque glisser de slider
 * forme une seule étape d'annulation.
 */
export function createImageSettings({ bus, store }: BackgroundContext): Component {
  const image = (): ImageBackground | null => {
    const background = store.state.project.present.environment.background;
    return background?.type === 'image' ? background : null;
  };
  const update = (changes: Partial<ImageBackground>, gesture?: string): void => bus.emit('background:update', { changes, gesture });

  const fit = createSegmented<ImageFit>({
    label: t.fit,
    action: 'background:update',
    options: IMAGE_FITS.map((value) => ({ value, label: t.fits[value] })),
    value: 'cover',
    onChange: (value) => update({ fit: value }),
  });

  /** Ligne « libellé, valeur, slider », dans l'unité affichée (%, px) ; `apply` la convertit pour le Projet. */
  const sliderRow = (
    id: string,
    label: string,
    range: { min: number; max: number },
    format: (value: number) => string,
    apply: (value: number, gesture: string) => void,
  ) => {
    const value = h('span', { class: 'group__value', 'aria-hidden': 'true' });
    const slider = createGestureSlider({ id, action: 'background:update', ...range, value: range.min, formatValue: format, onChange: apply });
    const row = h('div', { class: 'group__row group__row--stacked' }, [
      h('div', { class: 'group__row-header' }, [h('label', { class: 'group__label', for: id }, [label]), value]),
      slider.element,
    ]);
    return {
      row,
      set(next: number) {
        slider.setValue(next);
        value.textContent = format(next);
      },
    };
  };

  const percent = (n: number): string => strings.environment.percent(n);
  const zoom = sliderRow('background-zoom', t.zoom, { min: 100, max: BACKGROUND_LIMITS.zoom.max * 100 }, percent, (v, g) => update({ zoom: v / 100 }, g));
  const blur = sliderRow('background-blur', t.blur, BACKGROUND_LIMITS.blur, strings.environment.units, (v, g) => update({ blur: v }, g));
  const brightness = sliderRow(
    'background-brightness',
    t.brightness,
    { min: BACKGROUND_LIMITS.brightness.min * 100, max: BACKGROUND_LIMITS.brightness.max * 100 },
    percent,
    (v, g) => update({ brightness: v / 100 }, g),
  );
  const opacity = sliderRow('background-opacity', t.imageOpacity, { min: 0, max: 100 }, percent, (v, g) => update({ opacity: v / 100 }, g));
  const tintAmount = sliderRow('background-tint-amount', t.tintAmount, { min: 5, max: 100 }, percent, (v, g) => {
    const current = image()?.tint ?? DEFAULT_TINT;
    update({ tint: { ...current, amount: v / 100 } }, g);
  });

  const tintSwitch = createSwitch({
    label: t.tint,
    action: 'background:update',
    checked: false,
    onChange: (checked) => update({ tint: checked ? DEFAULT_TINT : null }),
  });
  const swatches = TINT_COLORS.map((color) => {
    const swatch = h('button', {
      type: 'button',
      class: 'background-swatch',
      role: 'radio',
      'aria-checked': 'false',
      'aria-label': t.tintColors[color],
      title: t.tintColors[color],
      'data-action': 'background:update',
    });
    // Couleur de la pastille : une donnée (la couleur du voile), pas un style de l'interface.
    swatch.style.setProperty('--swatch-color', color);
    swatch.addEventListener('click', () => update({ tint: { color, amount: image()?.tint?.amount ?? DEFAULT_TINT.amount } }));
    return [color, swatch] as const;
  });
  const tintColors = h('div', { class: 'group__row' }, [
    h('span', { class: 'group__label', id: 'background-tint-color' }, [t.tintColor]),
    h('div', { class: 'background-swatches', role: 'radiogroup', 'aria-labelledby': 'background-tint-color' }, swatches.map(([, s]) => s)),
  ]);

  const root = h('div', { class: 'background-settings' }, [
    h('div', { class: 'group' }, [
      h('div', { class: 'group__row group__row--stacked' }, [h('span', { class: 'group__label' }, [t.fit]), fit.element]),
      zoom.row,
    ]),
    h('h4', { class: 'editor-panel__section-title' }, [t.effects]),
    h('div', { class: 'group' }, [
      blur.row,
      brightness.row,
      opacity.row,
      h('div', { class: 'group__row' }, [h('span', { class: 'group__label' }, [t.tint]), tintSwitch.element]),
      tintColors,
      tintAmount.row,
    ]),
  ]);

  function render(): void {
    const current = image();
    root.hidden = !current;
    if (!current) return;
    fit.setValue(current.fit);
    zoom.set(Math.round(current.zoom * 100));
    blur.set(Math.round(current.blur));
    brightness.set(Math.round(current.brightness * 100));
    opacity.set(Math.round(current.opacity * 100));
    tintSwitch.setChecked(current.tint !== null);
    tintColors.hidden = current.tint === null;
    tintAmount.row.hidden = current.tint === null;
    if (current.tint) tintAmount.set(Math.round(current.tint.amount * 100));
    for (const [color, swatch] of swatches) swatch.setAttribute('aria-checked', String(current.tint?.color === color));
  }
  render();
  const stop = store.watch((s) => s.project.present.environment.background, render);

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      stop();
      root.remove();
    },
  };
}
