import '../../styles/components/home/floating-add-button.css';

import { floatingButtonTucked } from '../../../core/home-state';
import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

/**
 * Bouton flottant « + » (56 px, en bas à droite) : ouvre la feuille de création complète. Sur
 * ordinateur, il reste caché tant que la bannière est à l'écran et apparaît en fondu quand elle en
 * sort ; sous 900 px, il est toujours visible (voir floating-add-button.css).
 */
export function createFloatingAddButton({ bus, store }: HomeContext): Component {
  const button = h(
    'button',
    { type: 'button', class: 'fab', 'aria-label': strings.home.fab, title: strings.home.fab, 'data-action': 'home:sheet' },
    [icon('plus', 'icon fab__icon')],
  );
  button.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'create', templateId: null } }));
  const stop = store.watch(floatingButtonTucked, (tucked) => button.classList.toggle('fab--tucked', tucked));
  return {
    mount(parent) {
      parent.append(button);
    },
    destroy() {
      stop();
      button.remove();
    },
  };
}
