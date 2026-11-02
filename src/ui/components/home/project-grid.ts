import '../../styles/components/home/project-grid.css';

import { PROJECT_SORTS, PROJECT_VIEWS, RECENT_PROJECTS, shownProjects, type ProjectSort } from '../../../core/home-state';
import { routeToHash } from '../../../core/router';
import type { Component } from '../../component';
import { h } from '../../dom';
import { chooseFile, PROJECT_FILE_ACCEPT } from '../../transfer';
import { icon } from '../../icons';
import { logo } from '../../logo';
import { strings } from '../../strings';
import type { HomeContext } from './context';
import { createProjectCard, type ProjectCard } from './project-card';
import { createSearchField } from './hero-banner';

const t = strings.home;

export interface ProjectGridOptions {
  /** Accueil : les 8 plus récents et « Voir tout » ; page « Mes projets » : tous, avec la recherche. */
  variant: 'recent' | 'all';
}

/**
 * Section « Mes projets » : tri (Modifié, Créé, A-Z, Z-A) et vue (grille ou liste) mémorisés,
 * filtre de la recherche, état vide illustré. Les cartes sont gardées par id de projet ; les
 * vignettes manquantes sont générées quand leur carte devient visible.
 */
export function createProjectGrid(context: HomeContext, { variant }: ProjectGridOptions): Component {
  const { bus, store } = context;
  const cleanups: Array<() => void> = [];
  const titleId = `project-grid-title-${variant}`;

  // ---------- En-tête : titre, tri, vue, « Voir tout » ----------
  const sortSelect = h('select', { class: 'home-select', 'aria-label': t.sort, 'data-action': 'home:sort' }, [
    ...PROJECT_SORTS.map((sort) => h('option', { value: sort }, [t.sorts[sort]])),
  ]);
  sortSelect.addEventListener('change', () => bus.emit('home:sort', { sort: sortSelect.value as ProjectSort }));
  const viewButtons = PROJECT_VIEWS.map((view) => {
    const button = h('button', { type: 'button', class: 'view-toggle__button', 'aria-label': t.views[view], title: t.views[view], 'aria-pressed': 'false', 'data-action': 'home:view' }, [
      icon(view === 'grid' ? 'grid' : 'list'),
    ]);
    button.addEventListener('click', () => bus.emit('home:view', { view }));
    return [view, button] as const;
  });
  const viewToggle = h('div', { class: 'view-toggle', role: 'group', 'aria-label': t.view }, viewButtons.map(([, button]) => button));

  // Importer un fichier « .stickflow » (v2.2) : dans l'en-tête, et dans l'état vide.
  const importFile = (): void =>
    void chooseFile(PROJECT_FILE_ACCEPT).then((file) => {
      if (file) bus.emit('library:import', { file });
    });
  const importButton = h('button', { type: 'button', class: 'icon-button', 'aria-label': t.importProject, title: t.importProject, 'data-action': 'library:import' }, [icon('importFile')]);
  importButton.addEventListener('click', importFile);

  const Heading = variant === 'all' ? 'h1' : 'h2';
  const controls = h('div', { class: 'home-section__controls' }, [
    importButton,
    h('label', { class: 'home-select__label' }, [h('span', { class: 'visually-hidden' }, [t.sort]), icon('down', 'icon home-select__chevron'), sortSelect]),
    viewToggle,
  ]);
  if (variant === 'recent') {
    const seeAll = h('a', { href: routeToHash({ name: 'projects' }), class: 'home-section__see-all', 'aria-label': t.seeAllLabel(t.sections.projects) }, [t.seeAll]);
    seeAll.addEventListener('click', (event) => {
      event.preventDefault();
      bus.emit('route:change', { route: { name: 'projects' } });
    });
    controls.append(seeAll);
  }
  const search = variant === 'all' ? createSearchField(context, 'projects-search') : null;
  if (search) cleanups.push(search.destroy);
  const header = h('header', { class: 'home-section__header' }, [
    h(Heading, { class: 'home-section__title', id: titleId }, [t.sections.projects]),
    controls,
  ]);

  // ---------- Liste ----------
  const list = h('ul', { class: 'project-grid' });
  const status = h('p', { class: 'home-section__status', role: 'status' });
  const emptyButton = h('button', { type: 'button', class: 'button-primary', 'data-action': 'home:sheet' }, [icon('plus'), t.empty.action]);
  emptyButton.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'create', templateId: null } }));
  const emptyImport = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'library:import' }, [icon('importFile'), t.importProject]);
  emptyImport.addEventListener('click', importFile);
  const empty = h('div', { class: 'empty-state', hidden: true }, [
    h('span', { class: 'empty-state__art', 'aria-hidden': 'true' }, [logo('empty-state__logo')]),
    h('h3', { class: 'empty-state__title' }, [t.empty.title]),
    h('p', { class: 'empty-state__text' }, [t.empty.text]),
    h('div', { class: 'empty-state__actions' }, [emptyButton, emptyImport]),
  ]);

  const root = h('section', { class: `home-section project-section project-section--${variant}`, 'aria-labelledby': titleId }, [
    header,
    ...(search ? [h('div', { class: 'home-section__search' }, [search.element])] : []),
    list,
    status,
    empty,
  ]);

  // ---------- Cartes, gardées par id ----------
  const cards = new Map<string, ProjectCard>();
  const visible = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        visible.unobserve(entry.target);
        const card = [...cards.values()].find((c) => c.element === entry.target);
        if (!card || card.summary.thumbnail) continue;
        void context.preview.thumbnail(card.summary.id).then((thumbnail) => thumbnail && card.setThumbnail(thumbnail));
      }
    },
    { rootMargin: '200px' },
  );
  cleanups.push(() => visible.disconnect());

  function render(): void {
    const { projects, query, preferences } = store.state;
    list.classList.toggle('project-grid--list', preferences.view === 'list');
    if (projects === null) {
      status.textContent = t.loading;
      return;
    }
    const shown = shownProjects(projects, { query, sort: preferences.sort, limit: variant === 'recent' ? RECENT_PROJECTS : undefined });
    const next = new Map<string, ProjectCard>();
    for (const summary of shown) {
      const existing = cards.get(summary.id);
      // Un résumé changé (renommé, réenregistré) reconstruit sa carte.
      const card = existing && existing.summary === summary ? existing : createProjectCard(context, summary);
      if (card !== existing) {
        existing?.destroy();
        if (!summary.thumbnail) visible.observe(card.element);
      }
      next.set(summary.id, card);
    }
    for (const [id, card] of cards) if (!next.has(id)) card.destroy();
    cards.clear();
    next.forEach((card, id) => cards.set(id, card));
    list.replaceChildren(...[...next.values()].map((card) => card.element));

    const none = projects.length === 0;
    empty.hidden = !none;
    header.hidden = none && variant === 'recent';
    status.textContent = !none && shown.length === 0 ? t.noResults(query.trim()) : '';
  }

  cleanups.push(
    store.watch((s) => s.projects, render),
    store.watch(
      (s) => s.transfer,
      (transfer) => {
        importButton.disabled = transfer !== null;
        emptyImport.disabled = transfer !== null;
      },
    ),
    store.watch((s) => s.query, render),
    store.watch((s) => s.preferences, (preferences) => {
      sortSelect.value = preferences.sort;
      for (const [view, button] of viewButtons) button.setAttribute('aria-pressed', String(view === preferences.view));
      render();
    }),
  );

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      cards.forEach((card) => card.destroy());
      root.remove();
    },
  };
}
