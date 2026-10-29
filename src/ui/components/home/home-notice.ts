import type { HomeNotice } from '../../../core/home-state';
import type { Component } from '../../component';
import { h } from '../../dom';
import { strings } from '../../strings';
import type { HomeContext } from './context';

/** Durée d'affichage d'un message, en millisecondes. */
const NOTICE_DURATION_MS = 4000;

/** Message bref après une action (dupliqué, supprimé, exporté…), annoncé aux lecteurs d'écran. */
export function createHomeNotice({ store }: HomeContext): Component {
  const element = h('p', { class: 'home-notice', role: 'status', 'aria-live': 'polite' });
  let timer = 0;
  const stop = store.watch(
    (s) => s.notice,
    (notice) => {
      window.clearTimeout(timer);
      element.textContent = notice ? noticeText(notice) : '';
      element.dataset.kind = notice?.kind ?? '';
      element.classList.toggle('is-visible', notice !== null);
      if (notice) timer = window.setTimeout(() => element.classList.remove('is-visible'), NOTICE_DURATION_MS);
    },
  );
  return {
    mount(parent) {
      parent.append(element);
    },
    destroy() {
      stop();
      window.clearTimeout(timer);
      element.remove();
    },
  };
}

function noticeText({ code, detail = '' }: HomeNotice): string {
  const text = strings.home.notices[code];
  return typeof text === 'function' ? text(detail) : text;
}
