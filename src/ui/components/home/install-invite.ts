// Invitation à installer l'app (v2.2) : une ligne discrète au bas de l'accueil, refusable
// pour de bon. Avec la fenêtre du navigateur : « Installer l'app » ; sur iPhone et iPad : la marche à suivre.

import '../../styles/components/home/install-invite.css';

import { showInstallInvite } from '../../../core/home-state';
import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.app.install;

export function createInstallInvite({ bus, store }: HomeContext): Component {
  const text = h('p', { class: 'install-invite__text' });
  const install = h('button', { type: 'button', class: 'button-primary install-invite__action', 'data-action': 'app:install' }, [icon('install'), t.action]);
  install.addEventListener('click', () => bus.emit('app:install'));
  const dismiss = h('button', { type: 'button', class: 'icon-button install-invite__dismiss', 'aria-label': t.dismiss, title: t.dismiss, 'data-action': 'settings:change' }, [icon('close')]);
  dismiss.addEventListener('click', () => bus.emit('settings:change', { installInviteDismissed: true }));
  const element = h('aside', { class: 'install-invite', 'aria-label': t.section, hidden: true }, [
    h('span', { class: 'install-invite__icon', 'aria-hidden': 'true' }, [icon('addToHome')]),
    text,
    install,
    dismiss,
  ]);

  // Le store compare par référence : une clé texte évite de redessiner à chaque mise à jour.
  const stop = store.watch(
    (s) => (showInstallInvite(s) ? s.install : 'hidden'),
    (mode) => {
      element.hidden = mode === 'hidden';
      text.textContent = mode === 'ios' ? t.ios : t.invite;
      install.hidden = mode !== 'prompt';
    },
  );
  return {
    mount(parent) {
      parent.append(element);
    },
    destroy() {
      stop();
      element.remove();
    },
  };
}
