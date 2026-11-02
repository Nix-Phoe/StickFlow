// Bannière « Nouvelle version disponible » (v2.2), discrète, au bas de l'écran, sur toutes les pages.
// « Mettre à jour » enregistre le projet ouvert avant de recharger ; « Plus tard » la cache.

import type { UpdateController } from '../../../app/pwa-update';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';

const t = strings.app.update;

export function mountUpdateBanner(parent: HTMLElement, updates: UpdateController): void {
  const apply = h('button', { type: 'button', class: 'button-primary update-banner__action' }, [icon('update'), t.action]);
  const later = h('button', { type: 'button', class: 'button-secondary update-banner__later' }, [t.later]);
  const banner = h('div', { class: 'update-banner', role: 'status', 'aria-live': 'polite', hidden: true }, [
    h('p', { class: 'update-banner__text' }, [t.text]),
    h('div', { class: 'update-banner__actions' }, [later, apply]),
  ]);
  parent.append(banner);

  apply.addEventListener('click', () => {
    apply.disabled = true;
    later.disabled = true;
    apply.lastChild!.textContent = t.updating;
    void updates.apply();
  });
  later.addEventListener('click', () => updates.dismiss());
  updates.subscribe((available) => {
    banner.hidden = !available;
  });
}
