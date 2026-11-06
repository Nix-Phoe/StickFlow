import type { StockPhoto } from '../../../core/types';
import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import { gridKeyboard, type BackgroundContext } from './context';

const t = strings.background;
/** Attente après la dernière frappe avant de lancer la recherche. */
const SEARCH_DELAY_MS = 400;
const PEXELS_URL = 'https://www.pexels.com';

/**
 * Onglet Internet : recherche de photos libres (Pexels, via le proxy) avec défilement infini et
 * crédit de chaque photo, si elle est activée (VITE_STOCK_SEARCH), puis import d'une image par son
 * adresse. Sans proxy configuré, ou hors ligne, un message l'explique au lieu des champs.
 */
export function createInternetPane({ bus, store, stockConfigured, stockSearch }: BackgroundContext): Component {
  const cleanups: Array<() => void> = [];

  const notice = h('p', { class: 'background-pane__notice', role: 'status' });

  // ---------- Recherche ----------
  const searchInput = h('input', {
    type: 'search',
    id: 'background-search',
    class: 'background-pane__input',
    placeholder: t.searchPlaceholder,
    autocomplete: 'off',
    enterkeyhint: 'search',
    'data-action': 'stock:search',
  });
  let searchTimer = 0;
  const search = (): void => bus.emit('stock:search', { query: searchInput.value, page: 1 });
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(search, SEARCH_DELAY_MS);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.clearTimeout(searchTimer);
    search();
  });
  cleanups.push(() => window.clearTimeout(searchTimer));

  const results = h('div', { class: 'background-grid background-grid--photos', role: 'group', 'aria-label': t.results });
  gridKeyboard(results, '.background-photo__button');
  const status = h('p', { class: 'background-pane__hint', role: 'status', 'aria-live': 'polite' });
  const more = h('button', { type: 'button', class: 'button-secondary background-pane__more', 'data-action': 'stock:search' }, [t.loadMore]);
  const loadMore = (): void => {
    const { stock } = store.state.session;
    if (stock.hasMore && stock.status === 'done') bus.emit('stock:search', { query: stock.query, page: stock.page + 1 });
  };
  more.addEventListener('click', loadMore);
  // Défilement infini : la page suivante se charge quand le bas de la grille approche.
  const sentinel = h('div', { class: 'background-pane__sentinel', 'aria-hidden': 'true' });
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '200px' }) : null;
  observer?.observe(sentinel);
  cleanups.push(() => observer?.disconnect());

  const searchSection = h('section', { class: 'background-pane__section', 'aria-labelledby': 'background-search-title' }, [
    h('h4', { class: 'editor-panel__section-title', id: 'background-search-title' }, [t.search]),
    h('div', { class: 'search-field background-pane__search', role: 'search' }, [icon('search'), searchInput]),
    h('a', { class: 'background-pane__provider', href: PEXELS_URL, target: '_blank', rel: 'noopener noreferrer' }, [t.poweredBy]),
    results,
    sentinel,
    status,
    more,
  ]);
  searchInput.setAttribute('aria-label', t.search);

  function photoItem(photo: StockPhoto): HTMLElement {
    const label = photo.alt || t.photoBy(photo.author);
    const button = h('button', { type: 'button', class: 'background-photo__button', 'data-action': 'stock:import', title: label }, [
      h('img', { class: 'background-photo__image', src: photo.thumbnail, alt: label, loading: 'lazy', decoding: 'async', crossorigin: 'anonymous' }),
    ]);
    // Couleur moyenne de la photo (donnée de Pexels), visible pendant le chargement de la vignette.
    button.style.setProperty('--photo-color', photo.color);
    button.addEventListener('click', () => bus.emit('stock:import', { photoId: photo.id }));
    return h('figure', { class: 'background-photo' }, [
      button,
      h('figcaption', { class: 'background-photo__credit' }, [
        h('a', { href: photo.url, target: '_blank', rel: 'noopener noreferrer' }, [photo.author]),
      ]),
    ]);
  }

  let shown: readonly StockPhoto[] = [];
  function renderResults(): void {
    const { stock } = store.state.session;
    // Les pages suivantes s'ajoutent à la grille, sans refaire les vignettes déjà là.
    if (stock.photos.length >= shown.length && shown.every((photo, i) => stock.photos[i] === photo)) {
      results.append(...stock.photos.slice(shown.length).map(photoItem));
    } else {
      results.replaceChildren(...stock.photos.map(photoItem));
    }
    shown = stock.photos;
    if (stock.status === 'loading') status.textContent = t.searching;
    else if (stock.status === 'error' && stock.error) status.textContent = t.errors[stock.error];
    else if (stock.status === 'done' && stock.photos.length === 0) status.textContent = t.noResults(stock.query);
    else status.textContent = '';
    more.hidden = !(stock.hasMore && stock.status === 'done');
  }

  // ---------- Adresse d'une image ----------
  const urlInput = h('input', {
    type: 'url',
    id: 'background-url',
    class: 'background-pane__input',
    placeholder: t.urlPlaceholder,
    inputmode: 'url',
    autocomplete: 'off',
    'data-action': 'url:import',
  });
  const importButton = h('button', { type: 'submit', class: 'button-secondary', 'data-action': 'url:import' }, [icon('link'), t.import]);
  const urlForm = h('form', { class: 'background-pane__url', novalidate: true }, [urlInput, importButton]);
  urlForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (urlInput.value.trim() !== '') bus.emit('url:import', { url: urlInput.value });
  });
  const urlSection = h('section', { class: 'background-pane__section', 'aria-labelledby': 'background-url-title' }, [
    h('h4', { class: 'editor-panel__section-title', id: 'background-url-title' }, [h('label', { for: 'background-url' }, [t.urlLabel])]),
    urlForm,
    h('p', { class: 'background-pane__hint' }, [t.rightsNote]),
  ]);

  const root = h('div', { class: 'background-pane' }, [notice, searchSection, urlSection]);

  /** Sans proxy ou hors ligne : le message remplace les champs. */
  function renderAvailability(): void {
    const message = !stockConfigured ? t.unconfigured : !navigator.onLine ? t.offline : '';
    notice.textContent = message;
    notice.hidden = message === '';
    searchSection.hidden = message !== '' || !stockSearch;
    urlSection.hidden = message !== '';
  }
  renderAvailability();
  window.addEventListener('online', renderAvailability);
  window.addEventListener('offline', renderAvailability);
  cleanups.push(
    () => window.removeEventListener('online', renderAvailability),
    () => window.removeEventListener('offline', renderAvailability),
    store.watch((s) => s.session.stock, renderResults),
    store.watch(
      (s) => s.session.assetImport.status === 'busy',
      (busy) => {
        importButton.disabled = busy;
        results.setAttribute('aria-busy', String(busy));
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
