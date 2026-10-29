import '../../styles/components/home/floating-add-button.css';

import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

/** Bouton flottant « + » (56 px, en bas à droite) : ouvre la feuille de création. */
export function createFloatingAddButton({ bus }: HomeContext): Component {
  const button = h(
    'button',
    { type: 'button', class: 'fab', 'aria-label': strings.home.fab, title: strings.home.fab, 'data-action': 'home:sheet' },
    [icon('plus', 'icon fab__icon')],
  );
  button.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'create', templateId: null } }));
  return {
    mount(parent) {
      parent.append(button);
    },
    destroy() {
      button.remove();
    },
  };
}
