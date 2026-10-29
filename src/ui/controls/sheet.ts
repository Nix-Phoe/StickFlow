import '../styles/sheet.css';

import { h, type Child } from '../dom';
import { createIconButton } from './icon-button';

export interface SheetOptions {
  /** Identifiant unique (titre relié par `aria-labelledby`). */
  id: string;
  title: string;
  closeLabel: string;
  body: readonly Child[];
  /** Boutons du bas (Annuler, action principale). */
  actions?: readonly Child[];
  className?: string;
  /** Fermeture demandée (bouton, Échap, clic sur le fond). */
  onClose: () => void;
}

export interface SheetControl {
  dialog: HTMLDialogElement;
  title: HTMLHeadingElement;
  setOpen(open: boolean): void;
}

/**
 * Feuille modale de style iOS (`<dialog>` natif : focus piégé, Échap) : centrée sur ordinateur,
 * collée au bas de l'écran sur téléphone. Elle ne se ferme pas d'elle-même : elle le demande.
 */
export function createSheet(options: SheetOptions): SheetControl {
  const title = h('h2', { class: 'sheet__title', id: `${options.id}-title` }, [options.title]);
  const close = createIconButton({ icon: 'close', label: options.closeLabel, action: 'home:sheet', variant: 'filled', onClick: options.onClose });
  const dialog = h('dialog', { class: ['sheet', options.className].filter(Boolean).join(' '), 'aria-labelledby': `${options.id}-title` }, [
    h('header', { class: 'sheet__header' }, [title, close]),
    h('div', { class: 'sheet__body' }, options.body),
    ...(options.actions ? [h('footer', { class: 'sheet__actions' }, options.actions)] : []),
  ]);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    options.onClose();
  });
  // Un clic sur le fond (hors de la feuille) la ferme.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) options.onClose();
  });
  return {
    dialog,
    title,
    setOpen(open) {
      if (open && !dialog.open) dialog.showModal();
      else if (!open && dialog.open) dialog.close();
    },
  };
}
