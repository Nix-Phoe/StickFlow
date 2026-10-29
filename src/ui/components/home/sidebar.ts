import '../../styles/components/home/sidebar.css';

import { HOME_SECTIONS, routeToHash, type HomeSection } from '../../../core/router';
import { LIMITS } from '../../../core/types';
import type { Component } from '../../component';
import { createFormatPicker } from '../../controls/format-picker';
import { createStepper } from '../../controls/stepper';
import { h } from '../../dom';
import { icon, type IconName } from '../../icons';
import { logo } from '../../logo';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home;
const SECTION_ICONS: Record<HomeSection, IconName> = { home: 'home', projects: 'projects', templates: 'templates', videos: 'videos' };

/**
 * Barre latérale de l'accueil : logo, navigation entre les sections (style liste iPadOS), section
 * « Nouveau projet » (format, IPS, Créer) et Réglages. Sous 900 px, la navigation devient une barre
 * d'onglets en bas de l'écran et le reste passe dans la feuille de création (voir sidebar.css).
 */
export function createSidebar({ bus, store }: HomeContext): Component {
  const cleanups: Array<() => void> = [];

  // ---------- Navigation ----------
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

  // ---------- Nouveau projet ----------
  // Brouillon du formulaire : il part des préférences, sans les modifier.
  let format = store.state.preferences.defaultFormat;
  let fps = store.state.preferences.defaultFps;
  const formatPicker = createFormatPicker({
    name: 'sidebar-format',
    label: strings.formats.label,
    action: 'project:create',
    value: format,
    onChange: (value) => {
      format = value;
      formatPicker.setValue(value);
    },
  });
  const fpsStepper = createStepper({
    id: 'sidebar-fps',
    label: t.fps,
    action: 'project:create',
    ...LIMITS.fps,
    value: fps,
    onChange: (value) => {
      fps = value;
      fpsStepper.setValue(value);
    },
  });
  const createButton = h('button', { type: 'button', class: 'button-primary home-sidebar__create', 'data-action': 'project:create' }, [
    icon('plus'),
    t.create,
  ]);
  createButton.addEventListener('click', () => bus.emit('project:create', { format, fps }));
  const newProject = h('section', { class: 'home-sidebar__new', 'aria-labelledby': 'home-new-project-title' }, [
    h('h2', { class: 'home-sidebar__heading', id: 'home-new-project-title' }, [t.newProject]),
    h('p', { class: 'home-sidebar__label' }, [strings.formats.label]),
    formatPicker.element,
    h('div', { class: 'home-sidebar__fps' }, [h('label', { for: 'sidebar-fps', class: 'home-sidebar__label' }, [t.fps]), fpsStepper.element]),
    createButton,
  ]);

  const settingsButton = h('button', { type: 'button', class: 'home-sidebar__settings', 'data-action': 'home:sheet' }, [
    icon('settings'),
    h('span', {}, [t.settings]),
  ]);
  settingsButton.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'settings' } }));

  const root = h('aside', { class: 'home-sidebar', 'aria-label': t.navigation }, [
    h('div', { class: 'home-sidebar__brand' }, [h('span', { class: 'home-sidebar__logo' }, [logo()]), h('span', {}, [strings.appName])]),
    nav,
    newProject,
    settingsButton,
  ]);

  cleanups.push(
    store.watch(
      (s) => s.section,
      (section) => {
        for (const [key, link] of links) {
          if (key === section) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        }
      },
    ),
    // Les valeurs par défaut changées dans les Réglages deviennent celles du formulaire.
    store.watch(
      (s) => s.preferences,
      (preferences) => {
        format = preferences.defaultFormat;
        fps = preferences.defaultFps;
        formatPicker.setValue(format);
        fpsStepper.setValue(fps);
      },
    ),
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
