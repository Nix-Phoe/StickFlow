// Page d'erreur globale (v2.2) : une erreur imprévue propose de recharger l'app ; le projet ouvert
// est enregistré avant (`onReload`), et les projets déjà enregistrés ne sont jamais touchés.

import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';

const t = strings.app.error;

export interface ErrorDialog {
  /** Montre la page (une seule fois à la fois) avec le détail de l'erreur. */
  show(detail: string): void;
}

export function createErrorDialog(parent: HTMLElement, { onReload }: { onReload: () => Promise<void> }): ErrorDialog {
  const detail = h('pre', { class: 'error-dialog__detail' });
  const reload = h('button', { type: 'button', class: 'button-primary' }, [icon('reload'), t.reload]);
  const dismiss = h('button', { type: 'button', class: 'button-secondary' }, [t.dismiss]);
  const dialog = h('dialog', { class: 'sheet error-dialog', role: 'alertdialog', 'aria-labelledby': 'error-dialog-title', 'aria-describedby': 'error-dialog-text' }, [
    h('div', { class: 'error-dialog__body' }, [
      h('h2', { class: 'sheet__title', id: 'error-dialog-title' }, [t.title]),
      h('p', { class: 'error-dialog__text', id: 'error-dialog-text' }, [t.text]),
      h('details', { class: 'error-dialog__details' }, [h('summary', {}, [t.detail]), detail]),
    ]),
    h('div', { class: 'sheet__actions' }, [dismiss, reload]),
  ]);
  parent.append(dialog);

  reload.addEventListener('click', () => {
    reload.disabled = true;
    void onReload().finally(() => window.location.reload());
  });
  dismiss.addEventListener('click', () => dialog.close());

  return {
    show(text) {
      detail.textContent = text;
      if (!dialog.open) dialog.showModal();
      reload.focus();
    },
  };
}
