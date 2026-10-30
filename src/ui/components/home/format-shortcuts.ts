import '../../styles/components/home/format-shortcuts.css';

import { FORMAT_PRESETS, presetFormat, ratioLabel } from '../../../core/formats';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.formats;

/**
 * Raccourcis ronds par format : un clic crée tout de suite un projet dans ce format (nom et IPS par
 * défaut) et ouvre l'éditeur. Le dernier, « Libre » (+), ouvre la feuille de création complète, où
 * l'on choisit « Personnalisé » et sa taille.
 */
export function createFormatShortcuts({ bus, store }: HomeContext): HTMLUListElement {
  const items = FORMAT_PRESETS.map((preset) => {
    const format = presetFormat(preset.id);
    const ratio = format.width / format.height;
    const frame = h('span', { class: 'format-shortcut__frame', 'aria-hidden': 'true' });
    frame.style.setProperty('--frame-width', `${ratio >= 1 ? 100 : ratio * 100}%`);
    frame.style.setProperty('--frame-height', `${ratio >= 1 ? 100 / ratio : 100}%`);
    const custom = preset.id === 'custom';
    const button = h(
      'button',
      {
        type: 'button',
        class: 'format-shortcut',
        'aria-label': custom ? strings.home.hero.freeLabel : strings.home.hero.shortcut(t.names[preset.id]),
        'data-action': custom ? 'home:sheet' : 'project:create',
      },
      [
        h('span', { class: 'format-shortcut__disc' }, [custom ? icon('plus') : h('span', { class: 'format-shortcut__box' }, [frame])]),
        h('span', { class: 'format-shortcut__label' }, [custom ? strings.home.hero.free : t.names[preset.id]]),
        h('span', { class: 'format-shortcut__ratio' }, [custom ? '' : ratioLabel(format)]),
      ],
    );
    button.addEventListener('click', () => {
      if (custom) bus.emit('home:sheet', { sheet: { kind: 'create', templateId: null } });
      else bus.emit('project:create', { format, fps: store.state.preferences.defaultFps });
    });
    return h('li', {}, [button]);
  });
  return h('ul', { class: 'format-shortcuts', 'aria-label': strings.home.hero.shortcuts }, items);
}
