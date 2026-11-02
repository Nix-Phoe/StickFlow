// Pied de page de l'accueil (v2.2) : pages publiques et version.

import type { Component } from '../../component';
import { h } from '../../dom';
import { strings } from '../../strings';
import { PUBLIC_PAGES } from './settings-sheet';

const t = strings.home.settingsSheet;

export function createHomeFooter(): Component {
  const element = h('footer', { class: 'home-footer' }, [
    h('a', { href: PUBLIC_PAGES.privacy }, [t.privacy]),
    h('a', { href: PUBLIC_PAGES.about }, [t.about]),
    h('span', {}, [t.version(__APP_VERSION__)]),
  ]);
  return {
    mount(parent) {
      parent.append(element);
    },
    destroy() {
      element.remove();
    },
  };
}
