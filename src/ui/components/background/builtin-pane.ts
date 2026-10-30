import { BUILTIN_BACKGROUND_IDS, type BuiltinBackgroundId } from '../../../core/types';
import { paintBackground } from '../../../environment/paint-background';
import type { Component } from '../../component';
import { h } from '../../dom';
import { strings } from '../../strings';
import { gridKeyboard, type BackgroundContext } from './context';

const t = strings.background;
/** Taille des vignettes, en pixels du canvas (16:9). */
const PREVIEW = { width: 192, height: 108 };

/** Onglet Intégrés : grille des arrière-plans dessinés par le code, avec leur aperçu. */
export function createBuiltinPane({ bus, store }: BackgroundContext): Component {
  const buttons = BUILTIN_BACKGROUND_IDS.map((id) => {
    const canvas = h('canvas', { class: 'background-tile__preview', width: PREVIEW.width, height: PREVIEW.height, 'aria-hidden': 'true' });
    const context = canvas.getContext('2d');
    if (context) paintBackground(context, { type: 'builtin', id }, PREVIEW, { image: null, scale: PREVIEW.width / 1920 });
    const button = h('button', { type: 'button', class: 'background-tile', 'aria-pressed': 'false', 'data-action': 'background:set' }, [
      canvas,
      h('span', { class: 'background-tile__label' }, [t.builtins[id]]),
    ]);
    button.addEventListener('click', () => bus.emit('background:set', { background: { type: 'builtin', id } }));
    return [id, button] as const;
  });
  const grid = h('div', { class: 'background-grid', role: 'group', 'aria-label': t.builtinsLabel }, buttons.map(([, button]) => button));
  gridKeyboard(grid);
  const root = h('div', { class: 'background-pane' }, [grid]);

  const stop = store.watch(
    (s) => s.project.present.environment.background,
    (background) => {
      const selected: BuiltinBackgroundId | null = background?.type === 'builtin' ? background.id : null;
      for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === selected));
    },
  );

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
