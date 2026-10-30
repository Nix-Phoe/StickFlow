import type { Background } from '../../../core/types';
import type { Component } from '../../component';
import { createColorPicker } from '../../controls/color-picker';
import { createSegmented } from '../../controls/segmented';
import { h } from '../../dom';
import { strings } from '../../strings';
import { createGesture, createGestureSlider, type BackgroundContext } from './context';

const t = strings.background;
type Fill = 'solid' | 'gradient';
type Stop = 'from' | 'to';
/** Couleurs de départ quand l'arrière-plan n'est encore ni une couleur ni un dégradé. */
const DEFAULT_SOLID = '#4a90d9';
const DEFAULT_GRADIENT_END = '#f5f0e8';
const DEFAULT_ANGLE = 180;

/**
 * Onglet Couleur : couleur unie (ColorPicker) ou dégradé (deux couleurs, la palette modifie celle
 * choisie, et un angle). Chaque glisser forme une seule étape d'annulation.
 */
export function createColorPane({ bus, store }: BackgroundContext): Component {
  const background = (): Background | null => store.state.project.present.environment.background;
  let fill: Fill = background()?.type === 'gradient' ? 'gradient' : 'solid';
  let stop: Stop = 'from';
  const pickerGesture = createGesture();

  /** Couleur affichée par la palette : celle de l'arrière-plan, ou une couleur de départ. */
  const shownColor = (): string => {
    const current = background();
    if (current?.type === 'color') return current.color;
    if (current?.type === 'gradient') return current[stop];
    return DEFAULT_SOLID;
  };

  function applyColor(color: string, gesture?: string): void {
    const current = background();
    if (fill === 'solid') {
      bus.emit('background:set', { background: { type: 'color', color }, gesture });
    } else if (current?.type === 'gradient') {
      bus.emit('background:update', { changes: { [stop]: color }, gesture });
    } else {
      const base = { type: 'gradient' as const, from: DEFAULT_SOLID, to: DEFAULT_GRADIENT_END, angle: DEFAULT_ANGLE };
      bus.emit('background:set', { background: { ...base, [stop]: color }, gesture });
    }
  }

  const picker = createColorPicker({
    id: 'background-color',
    action: 'background:set',
    value: shownColor(),
    recent: store.state.project.present.recentColors,
    bus,
    onChange: (color) => applyColor(color, pickerGesture.token()),
    onCommit: (color) => {
      applyColor(color, pickerGesture.token());
      pickerGesture.end();
      bus.emit('color:commit', { color });
    },
  });

  const fillControl = createSegmented<Fill>({
    label: t.fill,
    action: 'background:set',
    options: [
      { value: 'solid', label: t.solid },
      { value: 'gradient', label: t.gradient },
    ],
    value: fill,
    onChange: (next) => {
      fill = next;
      const current = background();
      // Passer d'un mode à l'autre garde la couleur actuelle comme point de départ.
      const color = current?.type === 'color' ? current.color : current?.type === 'gradient' ? current.from : DEFAULT_SOLID;
      bus.emit('background:set', {
        background: next === 'solid' ? { type: 'color', color } : { type: 'gradient', from: color, to: DEFAULT_GRADIENT_END, angle: DEFAULT_ANGLE },
      });
      render();
    },
  });

  const stopControl = createSegmented<Stop>({
    label: t.gradientStop,
    action: 'background:update',
    options: [
      { value: 'from', label: t.gradientFrom },
      { value: 'to', label: t.gradientTo },
    ],
    value: stop,
    onChange: (next) => {
      stop = next;
      render();
    },
  });

  const angleValue = h('span', { class: 'group__value', 'aria-hidden': 'true' });
  const angle = createGestureSlider({
    id: 'background-angle',
    action: 'background:update',
    min: 0,
    max: 359,
    value: DEFAULT_ANGLE,
    formatValue: t.degrees,
    onChange: (value, gesture) => bus.emit('background:update', { changes: { angle: value }, gesture }),
  });

  const gradientRows = [
    h('div', { class: 'group__row group__row--stacked' }, [h('span', { class: 'group__label' }, [t.gradientStop]), stopControl.element]),
    h('div', { class: 'group__row group__row--stacked' }, [
      h('div', { class: 'group__row-header' }, [h('label', { class: 'group__label', for: 'background-angle' }, [t.angle]), angleValue]),
      angle.element,
    ]),
  ];

  const root = h('div', { class: 'background-pane' }, [
    h('div', { class: 'group' }, [
      h('div', { class: 'group__row group__row--stacked' }, [h('span', { class: 'group__label' }, [t.fill]), fillControl.element]),
      ...gradientRows,
      h('div', { class: 'group__row group__row--stacked' }, [picker.element]),
    ]),
  ]);

  function render(): void {
    const current = background();
    if (current?.type === 'color' || current?.type === 'gradient') fill = current.type === 'color' ? 'solid' : 'gradient';
    fillControl.setValue(fill);
    stopControl.setValue(stop);
    gradientRows.forEach((row) => (row.hidden = fill !== 'gradient'));
    const degrees = current?.type === 'gradient' ? current.angle : DEFAULT_ANGLE;
    angle.setValue(degrees);
    angleValue.textContent = t.degrees(degrees);
    picker.setValue(shownColor());
  }
  render();

  const stops = [
    store.watch((s) => s.project.present.environment.background, render),
    store.watch((s) => s.project.present.recentColors, (colors) => picker.setRecent(colors)),
  ];

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      stops.forEach((stopWatching) => stopWatching());
      picker.destroy();
      root.remove();
    },
  };
}
