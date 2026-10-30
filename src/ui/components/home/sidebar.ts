import '../../styles/components/home/sidebar.css';

import { HOME_SECTIONS, routeToHash, type HomeSection } from '../../../core/router';
import type { Component } from '../../component';
import { h } from '../../dom';
import { icon, type IconName } from '../../icons';
import { logo } from '../../logo';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home;
const SECTION_ICONS: Record<HomeSection, IconName> = { home: 'home', projects: 'projects', templates: 'templates', videos: 'videos' };

/**
 * Barre latérale de l'accueil : logo, navigation entre les sections (style liste iPadOS) et
 * Réglages en bas. Créer un projet passe par les raccourcis de la bannière, les modèles et le
 * bouton flottant « + » (v2.0.1). Sous 900 px, la navigation devient une barre d'onglets en bas de
 * l'écran (voir sidebar.css).
 */
export function createSidebar({ bus, store }: HomeContext): Component {
  const links = new Map<HomeSection, HTMLAnchorElement>();
  const navItems = HOME_SECTIONS.map((section) => {
    const link = h('a', { href: routeToHash({ name: section }), class: 'home-nav__link', 'data-action': 'route:change' }, [
      icon(SECTION_ICONS[section]),
      h('span', { class: 'home-nav__label' }, [t.sections[section]]),
      // Un seul des deux libellés est affiché (l'autre est en display: none, donc hors de l'arbre d'accessibilité).
      h('span', { class: 'home-nav__tab-label' }, [t.tabs[section]]),
    ]);
    // Le lien garde son adresse (ouvrir dans un onglet) ; un clic simple passe par le routeur.
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      bus.emit('route:change', { route: { name: section } });
    });
    links.set(section, link);
    return h('li', {}, [link]);
  });
  const nav = h('nav', { class: 'home-nav', 'aria-label': t.navigation }, [h('ul', { class: 'home-nav__list' }, navItems)]);

  const settingsButton = h('button', { type: 'button', class: 'home-sidebar__settings', 'data-action': 'home:sheet' }, [
    icon('settings'),
    h('span', {}, [t.settings]),
  ]);
  settingsButton.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'settings' } }));

  const root = h('aside', { class: 'home-sidebar', 'aria-label': t.navigation }, [
    h('div', { class: 'home-sidebar__brand' }, [h('span', { class: 'home-sidebar__logo' }, [logo()]), h('span', {}, [strings.appName])]),
    nav,
    settingsButton,
  ]);

  const stop = store.watch(
    (s) => s.section,
    (section) => {
      for (const [key, link] of links) {
        if (key === section) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
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
