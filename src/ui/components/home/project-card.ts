import '../../styles/components/home/project-card.css';

import { ratioLabel } from '../../../core/formats';
import { LIMITS, type ProjectSummary } from '../../../core/types';
import { createMenu } from '../../controls/menu';
import { h, prefersReducedMotion } from '../../dom';
import { logo } from '../../logo';
import { relativeTime } from '../../relative-time';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.card;
/** Délai avant de jouer l'aperçu au survol (un simple passage de la souris ne lance rien). */
const PREVIEW_DELAY_MS = 250;

export interface ProjectCard {
  element: HTMLLIElement;
  summary: ProjectSummary;
  /** Vignette générée après coup (projet sans vignette) : affichée sans reconstruire la carte. */
  setThumbnail(thumbnail: string): void;
  destroy(): void;
}

/**
 * Carte d'un projet : vignette (première frame) qui joue l'aperçu de l'animation au survol,
 * badge du format, nom, IPS, nombre d'images, date de modification relative, et menu « ⋮ »
 * (Ouvrir, Renommer, Dupliquer, Exporter, Supprimer).
 */
export function createProjectCard(context: HomeContext, summary: ProjectSummary): ProjectCard {
  const { bus } = context;
  const { id, name } = summary;

  const thumb = summary.thumbnail
    ? h('img', { class: 'project-card__thumb', src: summary.thumbnail, alt: '', loading: 'lazy', decoding: 'async' })
    : h('span', { class: 'project-card__placeholder', 'aria-hidden': 'true' }, [logo()]);
  const preview = h('canvas', { class: 'project-card__preview', 'aria-hidden': 'true' });
  const media = h('div', { class: 'project-card__media' }, [
    thumb,
    preview,
    h('span', { class: 'badge project-card__badge' }, [ratioLabel(summary.format)]),
  ]);
  media.style.setProperty('--card-ratio', String(summary.format.width / summary.format.height));

  const openButton = h('button', { type: 'button', class: 'project-card__open', 'aria-label': t.open(name), 'data-action': 'project:open' });
  openButton.addEventListener('click', () => bus.emit('project:open', { projectId: id }));

  const title = h('h3', { class: 'project-card__name', title: name }, [name]);
  const meta = h('p', { class: 'project-card__meta' }, [
    h('span', {}, [t.meta(summary.fps, summary.frameCount)]),
    h('time', { datetime: new Date(summary.updatedAt).toISOString() }, [relativeTime(summary.updatedAt)]),
  ]);
  const body = h('div', { class: 'project-card__body' }, [title, meta]);

  const menu = createMenu({
    label: t.actions(name),
    className: 'project-card__menu',
    items: [
      { label: t.openItem, icon: 'open', action: 'project:open', onSelect: () => bus.emit('project:open', { projectId: id }) },
      { label: t.rename, icon: 'rename', action: 'library:rename', onSelect: startRename },
      {
        label: t.duplicate,
        icon: 'copy',
        action: 'library:duplicate',
        onSelect: () => bus.emit('library:duplicate', { projectId: id, name: t.copyName(name) }),
      },
      {
        label: t.export,
        icon: 'download',
        action: 'home:sheet',
        onSelect: () => bus.emit('home:sheet', { sheet: { kind: 'export', projectId: id } }),
      },
      {
        label: t.delete,
        icon: 'trash',
        action: 'library:delete',
        destructive: true,
        onSelect: () => {
          if (window.confirm(t.confirmDelete(name))) bus.emit('library:delete', { projectId: id });
        },
      },
    ],
  });

  const element = h('li', { class: 'project-card' }, [media, openButton, body, menu.element]);

  // ---------- Renommer sur place ----------
  function startRename(): void {
    const input = h('input', {
      type: 'text',
      class: 'project-card__rename',
      value: name,
      maxlength: LIMITS.projectNameLength,
      'aria-label': t.renameField,
      'data-action': 'library:rename',
    });
    let done = false;
    const finish = (commit: boolean): void => {
      if (done) return;
      done = true;
      input.replaceWith(title);
      const next = input.value.trim();
      if (commit && next && next !== name) bus.emit('library:rename', { projectId: id, name: next });
      menu.button.focus();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true);
      else if (event.key === 'Escape') finish(false);
      else return;
      event.preventDefault();
    });
    input.addEventListener('blur', () => finish(true));
    title.replaceWith(input);
    input.select();
    input.focus();
  }

  // ---------- Aperçu animé au survol (ordinateur) ----------
  let timer = 0;
  let stopPreview: (() => void) | null = null;
  const endPreview = (): void => {
    window.clearTimeout(timer);
    stopPreview?.();
    stopPreview = null;
    element.classList.remove('is-previewing');
  };
  element.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
    timer = window.setTimeout(() => {
      element.classList.add('is-previewing');
      stopPreview = context.preview.play(id, preview);
    }, PREVIEW_DELAY_MS);
  });
  element.addEventListener('pointerleave', endPreview);

  return {
    element,
    summary,
    setThumbnail(thumbnail) {
      if (thumb instanceof HTMLImageElement) return;
      thumb.replaceWith(h('img', { class: 'project-card__thumb', src: thumbnail, alt: '', decoding: 'async' }));
    },
    destroy() {
      endPreview();
      menu.destroy();
      element.remove();
    },
  };
}
