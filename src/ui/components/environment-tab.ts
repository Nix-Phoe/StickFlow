import '../styles/components/environment-tab.css';

import { DRAWING_TOOLS, LIMITS, SHAPE_TOOLS, type Shape, type ToolId, type ToolSettings } from '../../core/types';
import type { Component, ComponentContext } from '../component';
import { createColorPicker } from '../controls/color-picker';
import { createIconButton } from '../controls/icon-button';
import { createSegmented } from '../controls/segmented';
import { createSlider } from '../controls/slider';
import { h } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.environment;
type Style = 'outline' | 'filled';

/**
 * Onglet « Environnement » du panneau flottant : grille des outils (formes, dessin), puis les
 * réglages de l'outil actif — couleur, épaisseur, opacité, contour / rempli. Quand une forme est
 * sélectionnée, les réglages s'appliquent aussi à elle.
 */
export function createEnvironmentTab({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  const selectedShape = (): Shape | undefined =>
    store.state.project.present.environment.shapes.find((s) => s.id === store.state.session.selectedShapeId);

  // ---------- Outils ----------
  const toolButton = (tool: ToolId): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: 'tool-button', 'data-action': 'tool:select', 'data-tool': tool, 'aria-pressed': 'false' }, [
      icon(tool),
      h('span', { class: 'tool-button__label' }, [t.tools[tool]]),
    ]);
    button.addEventListener('click', () => bus.emit('tool:select', { tool }));
    return button;
  };
  const toolGrid = (title: string, id: string, tools: readonly ToolId[]): HTMLElement =>
    h('section', { class: 'environment-tab__tools', 'aria-labelledby': id }, [
      h('h3', { class: 'editor-panel__section-title', id }, [title]),
      h('div', { class: 'tool-grid', role: 'group', 'aria-labelledby': id }, tools.map(toolButton)),
    ]);
  const tools = h('div', {}, [
    toolGrid(t.shapes, 'environment-shapes', ['select', ...SHAPE_TOOLS]),
    toolGrid(t.drawing, 'environment-drawing', DRAWING_TOOLS),
  ]);

  // ---------- Réglages ----------
  /** Applique un réglage à l'outil, et à la forme sélectionnée s'il y en a une. */
  function applySettings(settings: Partial<ToolSettings>): void {
    bus.emit('tool:settings', settings);
    const shape = selectedShape();
    if (!shape) return;
    const changes: Partial<Omit<Shape, 'id'>> = {};
    if (settings.color !== undefined) {
      changes.stroke = settings.color;
      if (shape.fill !== null) changes.fill = settings.color;
    }
    if (settings.strokeWidth !== undefined) changes.strokeWidth = settings.strokeWidth;
    if (settings.opacity !== undefined) changes.opacity = settings.opacity;
    if (settings.filled !== undefined && shape.kind !== 'line') changes.fill = settings.filled ? shape.stroke : null;
    bus.emit('shape:update', { shapeId: shape.id, changes });
  }

  const picker = createColorPicker({
    id: 'tool-color',
    action: 'tool:settings',
    value: store.state.session.toolSettings.color,
    recent: store.state.project.present.recentColors,
    bus,
    onChange: (color) => applySettings({ color }),
    onCommit: (color) => {
      applySettings({ color });
      bus.emit('color:commit', { color });
    },
  });

  const widthValue = h('span', { class: 'group__value', 'aria-hidden': 'true' });
  const widthSlider = createSlider({
    id: 'tool-stroke-width',
    action: 'tool:settings',
    ...LIMITS.strokeWidth,
    value: store.state.session.toolSettings.strokeWidth,
    formatValue: t.units,
    onChange: (strokeWidth) => applySettings({ strokeWidth }),
  });
  const opacityValue = h('span', { class: 'group__value', 'aria-hidden': 'true' });
  const opacitySlider = createSlider({
    id: 'tool-opacity',
    action: 'tool:settings',
    min: 10,
    max: 100,
    value: Math.round(store.state.session.toolSettings.opacity * 100),
    formatValue: t.percent,
    onChange: (percent) => applySettings({ opacity: percent / 100 }),
  });
  const styleControl = createSegmented<Style>({
    label: t.style,
    action: 'tool:settings',
    options: [
      { value: 'outline', label: t.outline },
      { value: 'filled', label: t.filled },
    ],
    value: store.state.session.toolSettings.filled ? 'filled' : 'outline',
    onChange: (style) => applySettings({ filled: style === 'filled' }),
  });
  const styleRow = h('div', { class: 'group__row group__row--stacked' }, [h('span', { class: 'group__label' }, [t.style]), styleControl.element]);

  const duplicateButton = createIconButton({
    icon: 'copy',
    label: t.duplicateShape,
    action: 'shape:duplicate',
    variant: 'filled',
    onClick: () => {
      const shape = selectedShape();
      if (shape) bus.emit('shape:duplicate', { shapeId: shape.id });
    },
  });
  const deleteButton = createIconButton({
    icon: 'trash',
    label: t.deleteShape,
    action: 'shape:remove',
    variant: 'filled',
    onClick: () => {
      const shape = selectedShape();
      if (shape) bus.emit('shape:remove', { shapeId: shape.id });
    },
  });
  const shapeActions = h('div', { class: 'environment-tab__shape-actions' }, [
    h('span', { class: 'group__label' }, [t.shapeSettings]),
    duplicateButton,
    deleteButton,
  ]);
  const hint = h('p', { class: 'appearance__caption' }, [t.selectHint]);

  const settingsTitle = h('h3', { class: 'editor-panel__section-title', id: 'environment-settings' }, [t.settings]);
  const settings = h('section', { class: 'environment-tab__settings', 'aria-labelledby': 'environment-settings' }, [
    settingsTitle,
    shapeActions,
    hint,
    h('div', { class: 'group' }, [
      h('div', { class: 'group__row group__row--stacked' }, [picker.element]),
      h('div', { class: 'group__row group__row--stacked' }, [
        h('div', { class: 'group__row-header' }, [h('label', { class: 'group__label', for: 'tool-stroke-width' }, [t.strokeWidth]), widthValue]),
        widthSlider.element,
      ]),
      h('div', { class: 'group__row group__row--stacked' }, [
        h('div', { class: 'group__row-header' }, [h('label', { class: 'group__label', for: 'tool-opacity' }, [t.opacity]), opacityValue]),
        opacitySlider.element,
      ]),
      styleRow,
    ]),
  ]);

  /** Réglages affichés : ceux de la forme sélectionnée, sinon ceux de l'outil. */
  function render(): void {
    const { tool, toolSettings } = store.state.session;
    for (const button of tools.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
    }
    const shape = selectedShape();
    const shown: ToolSettings = shape
      ? { color: shape.stroke, strokeWidth: shape.strokeWidth, opacity: shape.opacity, filled: shape.fill !== null }
      : toolSettings;
    picker.setValue(shown.color);
    widthSlider.setValue(shown.strokeWidth);
    widthValue.textContent = t.units(shown.strokeWidth);
    opacitySlider.setValue(Math.round(shown.opacity * 100));
    opacityValue.textContent = t.percent(Math.round(shown.opacity * 100));
    styleControl.setValue(shown.filled ? 'filled' : 'outline');
    // Contour / rempli n'a de sens que pour une forme (pas une ligne, pas un outil de dessin).
    const isShape = shape ? shape.kind !== 'line' : (SHAPE_TOOLS as readonly ToolId[]).includes(tool) && tool !== 'line' && tool !== 'fill';
    styleRow.hidden = !isShape;
    shapeActions.hidden = !shape;
    hint.hidden = Boolean(shape) || tool !== 'select';
    settings.querySelector('.group')?.toggleAttribute('hidden', tool === 'select' && !shape);
  }

  const root = h('div', { class: 'environment-tab' }, [tools, settings]);
  cleanups.push(
    () => picker.destroy(),
    store.watch((s) => s.session.tool, render),
    store.watch((s) => s.session.toolSettings, render),
    store.watch((s) => s.session.selectedShapeId, render),
    store.watch((s) => s.project.present.environment.shapes, render),
    store.watch((s) => s.project.present.recentColors, (colors) => picker.setRecent(colors)),
  );

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}
