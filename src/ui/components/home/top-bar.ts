import { createIconButton } from '../../controls/icon-button';
import type { Component } from '../../component';
import { h } from '../../dom';
import { logo } from '../../logo';
import { strings } from '../../strings';
import type { HomeContext } from './context';

/**
 * Barre du haut, sur téléphone et tablette seulement (sous 900 px) : la barre latérale y devient une
 * barre d'onglets, le logo et les Réglages passent ici.
 */
export function createTopBar({ bus }: HomeContext): Component {
  const root = h('header', { class: 'home-topbar' }, [
    h('span', { class: 'home-sidebar__logo', 'aria-hidden': 'true' }, [logo()]),
    h('span', { class: 'home-topbar__name' }, [strings.appName]),
    createIconButton({
      icon: 'settings',
      label: strings.home.settings,
      action: 'home:sheet',
      variant: 'filled',
      className: 'home-topbar__settings',
      onClick: () => bus.emit('home:sheet', { sheet: { kind: 'settings' } }),
    }),
  ]);
  return {
    mount(parent) {
      parent.prepend(root);
    },
    destroy() {
      root.remove();
    },
  };
}
