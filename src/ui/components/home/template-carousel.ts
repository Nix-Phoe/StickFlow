import '../../styles/components/home/template-carousel.css';

import { matchesQuery } from '../../../core/home-state';
import { routeToHash } from '../../../core/router';
import { TEMPLATE_IDS, type TemplateId } from '../../../templates';
import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';
import { createSearchField } from './hero-banner';

const t = strings.templates;

export interface TemplateCarouselOptions {
  /** Accueil : carrousel horizontal ; page « Modèles » : grille complète, avec la recherche. */
  variant: 'carousel' | 'all';
}

/**
 * « Commencer avec un modèle » : les projets de départ (vignette, nom, images clés). Un clic crée
 * une copie du modèle au format par défaut et ouvre l'éditeur. Flèches sur ordinateur, glissement
 * au doigt sur mobile ; la recherche filtre les modèles par nom.
 */
export function createTemplateCarousel(context: HomeContext, { variant }: TemplateCarouselOptions): Component {
  const { bus, store, templates } = context;
  const titleId = `templates-title-${variant}`;

  const cards = new Map<TemplateId, HTMLLIElement>();
  for (const id of TEMPLATE_IDS) {
    const name = t.names[id];
    const project = templates.load(id);
    const thumbnail = templates.thumbnail(id);
    const button = h('button', { type: 'button', class: 'template-card__button', 'aria-label': t.use(name), 'data-action': 'project:create' }, [
      h('span', { class: 'template-card__media' }, thumbnail ? [h('img', { src: thumbnail, alt: '', loading: 'lazy', decoding: 'async' })] : []),
      h('span', { class: 'template-card__name' }, [name]),
      h('span', { class: 'template-card__meta' }, [project ? t.frames(project.keyframes.length) : '']),
    ]);
    button.addEventListener('click', () =>
      bus.emit('project:create', { templateId: id, format: store.state.preferences.defaultFormat }),
    );
    cards.set(id, h('li', { class: 'template-card' }, [button]));
  }
  const list = h('ul', { class: `template-list template-list--${variant}` }, [...cards.values()]);
  const status = h('p', { class: 'home-section__status', role: 'status' });

  const Heading = variant === 'all' ? 'h1' : 'h2';
  const controls = h('div', { class: 'home-section__controls' });
  const cleanups: Array<() => void> = [];
  if (variant === 'carousel') {
    const scrollBy = (direction: 1 | -1): void =>
      list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    // Défilement du carrousel : une affaire d'affichage, sans événement du bus.
    const arrow = (direction: 1 | -1): HTMLButtonElement => {
      const label = direction < 0 ? t.previous : t.next;
      const button = h('button', { type: 'button', class: 'icon-button icon-button--filled template-list__arrow', 'aria-label': label, title: label }, [
        icon(direction < 0 ? 'back' : 'forward'),
      ]);
      button.addEventListener('click', () => scrollBy(direction));
      return button;
    };
    controls.append(arrow(-1), arrow(1));
    const seeAll = h('a', { href: routeToHash({ name: 'templates' }), class: 'home-section__see-all', 'aria-label': strings.home.seeAllLabel(strings.home.sections.templates) }, [strings.home.seeAll]);
    seeAll.addEventListener('click', (event) => {
      event.preventDefault();
      bus.emit('route:change', { route: { name: 'templates' } });
    });
    controls.append(seeAll);
  }
  const search = variant === 'all' ? createSearchField(context, 'templates-search') : null;
  if (search) cleanups.push(search.destroy);

  const root = h('section', { class: 'home-section', 'aria-labelledby': titleId }, [
    h('header', { class: 'home-section__header' }, [
      h(Heading, { class: 'home-section__title', id: titleId }, [variant === 'all' ? strings.home.sections.templates : t.title]),
      controls,
    ]),
    ...(search ? [h('div', { class: 'home-section__search' }, [search.element])] : []),
    list,
    status,
  ]);

  cleanups.push(
    store.watch(
      (s) => s.query,
      (query) => {
        let shown = 0;
        for (const [id, card] of cards) {
          const match = matchesQuery(t.names[id], query);
          card.hidden = !match;
          if (match) shown += 1;
        }
        status.textContent = shown === 0 ? strings.home.noResults(query.trim()) : '';
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
