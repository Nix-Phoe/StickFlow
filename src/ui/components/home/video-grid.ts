import '../../styles/components/home/video-grid.css';

import { storageNearlyFull } from '../../../core/home-state';
import { routeToHash } from '../../../core/router';
import type { Component } from '../../component';
import { h } from '../../dom';
import { formatBytes, formatDuration } from '../../format';
import { icon } from '../../icons';
import { relativeTime } from '../../relative-time';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.videos;
/** Vidéos montrées sur la page d'accueil (« Voir tout » mène aux autres). */
const RECENT_VIDEOS = 4;

export interface VideoGridOptions {
  /** Accueil : les plus récentes ; page « Mes vidéos » : toutes, avec l'espace de stockage. */
  variant: 'recent' | 'all';
}

/**
 * « Mes vidéos » : les GIF et vidéos exportés, conservés dans l'app (vignette, type de fichier,
 * durée, icône lecture). Un clic ouvre le lecteur. La page complète montre l'espace utilisé et
 * propose de supprimer les plus anciennes quand il est presque plein.
 */
export function createVideoGrid({ bus, store }: HomeContext, { variant }: VideoGridOptions): Component {
  const titleId = `video-grid-title-${variant}`;
  const Heading = variant === 'all' ? 'h1' : 'h2';
  const controls = h('div', { class: 'home-section__controls' });
  if (variant === 'recent') {
    const seeAll = h('a', { href: routeToHash({ name: 'videos' }), class: 'home-section__see-all', 'aria-label': strings.home.seeAllLabel(strings.home.sections.videos) }, [strings.home.seeAll]);
    seeAll.addEventListener('click', (event) => {
      event.preventDefault();
      bus.emit('route:change', { route: { name: 'videos' } });
    });
    controls.append(seeAll);
  }

  // ---------- Espace de stockage (page « Mes vidéos ») ----------
  const meter = h('meter', { class: 'video-storage__meter', min: 0, max: 1, low: 0.6, high: 0.8, optimum: 0, 'aria-label': t.storageLabel });
  const usage = h('p', { class: 'video-storage__usage' });
  const warning = h('p', { class: 'video-storage__warning', role: 'status' });
  const prune = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'videos:prune' }, [t.prune]);
  prune.addEventListener('click', () => bus.emit('videos:prune'));
  const clear = h('button', { type: 'button', class: 'button-secondary video-storage__clear', 'data-action': 'videos:clear' }, [icon('trash'), t.clear]);
  clear.addEventListener('click', () => {
    if (window.confirm(t.confirmClear)) bus.emit('videos:clear');
  });
  const storage = h('div', { class: 'video-storage', hidden: true }, [
    h('div', { class: 'video-storage__row' }, [icon('storage'), usage]),
    meter,
    h('div', { class: 'video-storage__actions' }, [warning, prune, clear]),
  ]);

  const list = h('ul', { class: 'video-grid' });
  const empty = h('p', { class: 'home-section__status' }, [t.empty]);
  const root = h('section', { class: 'home-section', 'aria-labelledby': titleId }, [
    h('header', { class: 'home-section__header' }, [h(Heading, { class: 'home-section__title', id: titleId }, [strings.home.sections.videos]), controls]),
    ...(variant === 'all' ? [storage] : []),
    list,
    empty,
  ]);

  function render(): void {
    const videos = store.state.videos ?? [];
    const shown = variant === 'recent' ? videos.slice(0, RECENT_VIDEOS) : videos;
    list.replaceChildren(
      ...shown.map((video) => {
        const type = t.types[video.type];
        const button = h('button', { type: 'button', class: 'video-card__open', 'aria-label': t.open(video.projectName, type), 'data-action': 'home:sheet' }, [
          h('span', { class: 'video-card__media' }, [
            ...(video.thumbnail ? [h('img', { src: video.thumbnail, alt: '', loading: 'lazy', decoding: 'async' })] : []),
            h('span', { class: 'video-card__play', 'aria-hidden': 'true' }, [icon('play')]),
            h('span', { class: 'badge video-card__type' }, [type]),
            h('span', { class: 'badge video-card__duration' }, [formatDuration(video.duration)]),
          ]),
          h('span', { class: 'video-card__name' }, [video.projectName]),
          h('span', { class: 'video-card__meta' }, [`${relativeTime(video.createdAt)} · ${formatBytes(video.size)}`]),
        ]);
        button.addEventListener('click', () => bus.emit('home:sheet', { sheet: { kind: 'video', videoId: video.id } }));
        return h('li', { class: 'video-card' }, [button]);
      }),
    );
    empty.hidden = store.state.videos === null || videos.length > 0;

    const space = store.state.storage;
    storage.hidden = space === null && videos.length === 0;
    usage.textContent = space ? t.storage(formatBytes(space.usage), formatBytes(space.quota)) : '';
    meter.hidden = space === null;
    meter.value = space && space.quota > 0 ? space.usage / space.quota : 0;
    const full = storageNearlyFull(space) && videos.length > 0;
    warning.textContent = full ? t.nearlyFull : '';
    prune.hidden = !full;
    clear.hidden = videos.length === 0;
  }

  const stops = [store.watch((s) => s.videos, render), store.watch((s) => s.storage, render)];

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      stops.forEach((stop) => stop());
      root.remove();
    },
  };
}
