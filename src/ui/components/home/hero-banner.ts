import '../../styles/components/home/hero-banner.css';

import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { logo } from '../../logo';
import { strings } from '../../strings';
import type { HomeContext } from './context';
import { createFormatShortcuts } from './format-shortcuts';

const t = strings.home.hero;

/**
 * Bannière d'accueil : question d'accroche, recherche en direct des projets et des modèles,
 * raccourcis par format. Un petit stickman décoratif se balance doucement (sauf mouvement réduit).
 */
export function createHeroBanner(context: HomeContext): Component {
  const { bus, store } = context;
  const search = createSearchField(context, 'hero-search');
  const root = h('section', { class: 'hero', 'aria-labelledby': 'hero-title' }, [
    h('span', { class: 'hero__stickman', 'aria-hidden': 'true' }, [logo('hero__logo')]),
    h('h1', { class: 'hero__title', id: 'hero-title' }, [t.title]),
    search.element,
    createFormatShortcuts({ ...context, bus, store }),
  ]);

  // Le bouton flottant « + » ne s'affiche (sur ordinateur) qu'une fois la bannière sortie de l'écran.
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          const entry = entries[entries.length - 1];
          if (entry && entry.isIntersecting !== store.state.heroVisible) bus.emit('home:hero:visibility', { visible: entry.isIntersecting });
        })
      : null;

  return {
    mount(parent) {
      parent.append(root);
      if (observer) observer.observe(root);
      else bus.emit('home:hero:visibility', { visible: false });
    },
    destroy() {
      observer?.disconnect();
      search.destroy();
      root.remove();
    },
  };
}

/** Champ de recherche relié à `query` (accueil, et en-tête des sections Projets et Modèles). */
export function createSearchField({ bus, store }: HomeContext, id: string): { element: HTMLElement; destroy(): void } {
  const input = h('input', {
    type: 'search',
    id,
    class: 'search-field__input',
    placeholder: t.search,
    'aria-label': t.search,
    autocomplete: 'off',
    spellcheck: false,
    enterkeyhint: 'search',
    'data-action': 'home:search',
  });
  input.addEventListener('input', () => bus.emit('home:search', { query: input.value }));
  const stop = store.watch(
    (s) => s.query,
    (query) => {
      if (input.value !== query) input.value = query;
    },
  );
  return { element: h('div', { class: 'search-field', role: 'search' }, [icon('search'), input]), destroy: stop };
}
