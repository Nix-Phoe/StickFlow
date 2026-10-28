import '../styles/color-picker.css';

import type { AppEventBus } from '../../core/events';
import { COLOR_HARMONIES, type ColorHarmony } from '../../core/types';
import { harmonyHues, hexToHsv, hsvToHex, normalizeHex, wheelHueSaturation, wheelPoint, type Hsv } from '../../model/color';
import { h } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';
import { createSegmented } from './segmented';
import { createSlider } from './slider';

const t = strings.colorPicker;
/** Pas de la roue au clavier : teinte en degrés, saturation. */
const HUE_STEP = 5;
const SATURATION_STEP = 0.05;

export interface ColorPickerOptions {
  /** Préfixe des ids internes (plusieurs palettes peuvent coexister). */
  id: string;
  /** Événement porté par `data-action` (ce que l'hôte émet). */
  action: string;
  value: string;
  recent: readonly string[];
  /** Le bus sert à la pipette de secours (lecture d'un pixel de la scène). */
  bus: AppEventBus;
  /** Pendant le geste (glisser sur la roue, saisie) : aperçu en direct. */
  onChange: (hex: string) => void;
  /** Fin du geste : la couleur est choisie (une seule étape d'annulation, couleurs récentes). */
  onCommit: (hex: string) => void;
}

export interface ColorPicker {
  element: HTMLElement;
  /** Affiche une couleur venue du store, sans rien émettre. */
  setValue(hex: string): void;
  setRecent(colors: readonly string[]): void;
  destroy(): void;
}

interface EyeDropperResult {
  sRGBHex: string;
}
type EyeDropperConstructor = new () => { open(): Promise<EyeDropperResult> };

/**
 * Grande palette : roue chromatique (teinte = angle, saturation = distance au centre) avec un
 * curseur déplaçable à la souris, au doigt et au clavier, luminosité, harmonies, blanc / noir,
 * pipette, champ HEX et couleurs récentes.
 */
export function createColorPicker(options: ColorPickerOptions): ColorPicker {
  let hsv: Hsv = hexToHsv(normalizeHex(options.value) ?? '#000000');
  let harmony: ColorHarmony = 'none';
  let cleanupEyedropper: (() => void) | null = null;

  // ---------- Roue ----------
  const wheelCanvas = h('canvas', { class: 'color-picker__wheel-canvas', 'aria-hidden': 'true' });
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'color-picker__lines');
  lines.setAttribute('viewBox', '-1 -1 2 2');
  lines.setAttribute('aria-hidden', 'true');
  const cursor = h('span', { class: 'color-picker__cursor', 'aria-hidden': 'true' });
  const harmonyDots = h('div', { class: 'color-picker__harmony-dots' });
  const wheel = h(
    'div',
    {
      class: 'color-picker__wheel',
      role: 'slider',
      tabindex: 0,
      'aria-label': t.wheel,
      'data-action': options.action,
    },
    [wheelCanvas, lines, harmonyDots, cursor],
  );

  /** Point de la roue sous le pointeur, en coordonnées de la roue (rayon 1, y vers le haut). */
  function wheelCoordinates(event: PointerEvent): { x: number; y: number } {
    const rect = wheel.getBoundingClientRect();
    const radius = rect.width / 2;
    return { x: (event.clientX - rect.left - radius) / radius, y: (rect.top + radius - event.clientY) / radius };
  }

  let dragging = false;
  wheel.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    wheel.setPointerCapture(event.pointerId);
    dragging = true;
    pickFromWheel(event);
  });
  wheel.addEventListener('pointermove', (event) => {
    if (dragging) pickFromWheel(event);
  });
  const endDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    options.onCommit(currentHex());
  };
  wheel.addEventListener('pointerup', endDrag);
  wheel.addEventListener('pointercancel', endDrag);

  function pickFromWheel(event: PointerEvent): void {
    const { h: hue, s } = wheelHueSaturation(wheelCoordinates(event));
    hsv = { h: hue, s, v: hsv.v === 0 ? 1 : hsv.v };
    change();
  }

  wheel.addEventListener('keydown', (event) => {
    const steps: Record<string, Partial<Hsv>> = {
      ArrowLeft: { h: hsv.h + HUE_STEP },
      ArrowRight: { h: hsv.h - HUE_STEP },
      ArrowUp: { s: Math.min(1, hsv.s + SATURATION_STEP) },
      ArrowDown: { s: Math.max(0, hsv.s - SATURATION_STEP) },
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    hsv = { ...hsv, ...step, h: (((step.h ?? hsv.h) % 360) + 360) % 360 };
    change();
    options.onCommit(currentHex());
  });

  // ---------- Luminosité ----------
  const brightnessId = `${options.id}-brightness`;
  const brightness = createSlider({
    id: brightnessId,
    action: options.action,
    min: 0,
    max: 100,
    value: Math.round(hsv.v * 100),
    formatValue: (value) => `${value} %`,
    onChange: (value) => {
      hsv = { ...hsv, v: value / 100 };
      change();
    },
  });
  brightness.element.addEventListener('change', () => options.onCommit(currentHex()));

  // ---------- Harmonies ----------
  const harmonyControl = createSegmented<ColorHarmony>({
    label: t.harmony,
    action: options.action,
    className: 'color-picker__harmony',
    options: COLOR_HARMONIES.map((value) => ({ value, label: t.harmonies[value], ariaLabel: t.harmoniesLong[value] })),
    value: harmony,
    onChange: (value) => {
      harmony = value;
      harmonyControl.setValue(value);
      render();
    },
  });
  const harmonySwatches = h('div', { class: 'color-picker__harmony-swatches' });
  harmonySwatches.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-color]') : null;
    if (target?.dataset.color) choose(target.dataset.color);
  });

  // ---------- Raccourcis : blanc, noir, pipette ----------
  const quickButton = (label: string, hex: string, className: string): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: `color-picker__quick ${className}`, 'aria-label': label, title: label, 'data-action': options.action });
    button.addEventListener('click', () => choose(hex));
    return button;
  };
  const eyedropperButton = h(
    'button',
    { type: 'button', class: 'icon-button icon-button--filled', 'aria-label': t.eyedropper, title: t.eyedropper, 'aria-pressed': 'false', 'data-action': 'eyedropper:start' },
    [icon('eyedropper')],
  );
  eyedropperButton.addEventListener('click', () => void pickWithEyedropper());

  /** API EyeDropper du navigateur si elle existe, sinon un pixel de la scène au prochain appui. */
  async function pickWithEyedropper(): Promise<void> {
    const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (EyeDropper) {
      try {
        const { sRGBHex } = await new EyeDropper().open();
        const hex = normalizeHex(sRGBHex);
        if (hex) choose(hex);
      } catch {
        // Annulée par l'utilisateur (Échap) : rien à faire.
      }
      return;
    }
    cleanupEyedropper?.();
    eyedropperButton.setAttribute('aria-pressed', 'true');
    eyedropperButton.title = t.eyedropperFallback;
    const stop = (): void => {
      eyedropperButton.setAttribute('aria-pressed', 'false');
      eyedropperButton.title = t.eyedropper;
      offPick();
      offCancel();
      cleanupEyedropper = null;
    };
    const offPick = options.bus.on('eyedropper:pick', ({ color }) => {
      stop();
      choose(color);
    });
    const offCancel = options.bus.on('eyedropper:cancel', stop);
    cleanupEyedropper = stop;
    options.bus.emit('eyedropper:start');
  }

  // ---------- HEX ----------
  const hexInput = h('input', {
    type: 'text',
    id: `${options.id}-hex`,
    class: 'color-picker__hex',
    inputmode: 'text',
    autocomplete: 'off',
    spellcheck: false,
    maxlength: 7,
    'aria-label': strings.appearance.hex,
    'data-action': options.action,
  });
  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (!hex || hexInput.value.replace('#', '').length < 6) return;
    hsv = hexToHsv(hex);
    change({ keepHexField: true });
  });
  hexInput.addEventListener('change', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) choose(hex);
    else hexInput.value = currentHex();
  });

  // ---------- Récentes ----------
  const recentList = h('div', { class: 'color-picker__recent', role: 'group', 'aria-label': t.recent });
  recentList.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-color]') : null;
    if (target?.dataset.color) choose(target.dataset.color);
  });

  const element = h('div', { class: 'color-picker' }, [
    wheel,
    h('label', { class: 'color-picker__label', for: brightnessId }, [t.brightness]),
    brightness.element,
    harmonyControl.element,
    harmonySwatches,
    h('div', { class: 'color-picker__row' }, [
      quickButton(t.white, '#ffffff', 'color-picker__quick--white'),
      quickButton(t.black, '#000000', 'color-picker__quick--black'),
      eyedropperButton,
      hexInput,
    ]),
    h('p', { class: 'color-picker__label' }, [t.recent]),
    recentList,
  ]);

  // ---------- Rendu ----------
  const currentHex = (): string => hsvToHex(hsv);

  function change({ keepHexField = false } = {}): void {
    render({ keepHexField });
    options.onChange(currentHex());
  }

  function choose(hex: string): void {
    hsv = hexToHsv(hex);
    change();
    options.onCommit(currentHex());
  }

  let paintedValue = -1;
  function paintWheel(): void {
    const ratio = window.devicePixelRatio || 1;
    const size = Math.round(wheel.clientWidth * ratio);
    if (size === 0 || (paintedValue === hsv.v && wheelCanvas.width === size)) return;
    wheelCanvas.width = wheelCanvas.height = size;
    const context = wheelCanvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(size, size);
    const radius = size / 2;
    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        const x = (px + 0.5 - radius) / radius;
        const y = (radius - py - 0.5) / radius;
        const distance = Math.hypot(x, y);
        if (distance > 1) continue;
        const { h: hue, s } = wheelHueSaturation({ x, y });
        const hex = hsvToHex({ h: hue, s, v: hsv.v });
        const n = Number.parseInt(hex.slice(1), 16);
        const i = (py * size + px) * 4;
        image.data[i] = (n >> 16) & 255;
        image.data[i + 1] = (n >> 8) & 255;
        image.data[i + 2] = n & 255;
        // Bord adouci sur un pixel.
        image.data[i + 3] = Math.round(255 * Math.min(1, (1 - distance) * radius));
      }
    }
    context.putImageData(image, 0, 0);
    paintedValue = hsv.v;
  }

  /** Place un élément sur la roue (coordonnées de la roue → pourcentages CSS). */
  const place = (el: HTMLElement, hue: number, saturation: number): void => {
    const { x, y } = wheelPoint(hue, saturation);
    el.style.left = `${50 + x * 50}%`;
    el.style.top = `${50 - y * 50}%`;
  };

  function render({ keepHexField = false } = {}): void {
    const hex = currentHex();
    paintWheel();
    place(cursor, hsv.h, hsv.s);
    cursor.style.setProperty('--picker-color', hex);
    wheel.setAttribute('aria-valuetext', hex);
    brightness.setValue(Math.round(hsv.v * 100));
    if (!keepHexField && document.activeElement !== hexInput) hexInput.value = hex;

    // Harmonies : points reliés au centre, et pastilles cliquables.
    const hues = harmonyHues(hsv.h, harmony);
    const all = [hsv.h, ...hues];
    lines.replaceChildren(
      ...all.map((hue) => {
        const { x, y } = wheelPoint(hue, hsv.s);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', String(x));
        line.setAttribute('y2', String(-y));
        return line;
      }),
    );
    harmonyDots.replaceChildren(
      ...hues.map((hue) => {
        const dot = h('span', { class: 'color-picker__harmony-dot' });
        place(dot, hue, hsv.s);
        dot.style.setProperty('--picker-color', hsvToHex({ ...hsv, h: hue }));
        return dot;
      }),
    );
    harmonySwatches.replaceChildren(...hues.map((hue) => swatch(hsvToHex({ ...hsv, h: hue }), t.harmonyColor)));
    harmonySwatches.hidden = hues.length === 0;
  }

  function setRecent(colors: readonly string[]): void {
    recentList.replaceChildren(
      ...(colors.length > 0
        ? colors.map((hex) => swatch(hex, strings.appearance.swatch))
        : [h('span', { class: 'color-picker__empty' }, [t.noRecent])]),
    );
  }

  // La roue n'a une taille qu'une fois dans le document : on la peint quand elle apparaît.
  const observer = new ResizeObserver(() => paintWheel());
  observer.observe(wheel);
  setRecent(options.recent);
  render();

  return {
    element,
    setValue(hex) {
      const normalized = normalizeHex(hex);
      if (!normalized || normalized === currentHex() || dragging) return;
      hsv = hexToHsv(normalized);
      render();
    },
    setRecent,
    destroy() {
      observer.disconnect();
      cleanupEyedropper?.();
      element.remove();
    },
  };
}

/** Pastille de couleur cliquable (sa couleur dans `data-color`). */
export function swatch(hex: string, label: (hex: string) => string): HTMLButtonElement {
  const button = h('button', { type: 'button', class: 'swatch', 'data-color': hex, 'aria-label': label(hex), title: hex });
  button.style.setProperty('--swatch-color', hex);
  return button;
}
