import '../styles/components/projects-dialog.css';

import type { LibraryEntry } from '../../core/types';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { h } from '../dom';
import { strings } from '../strings';

const t = strings.projects;

/**
 * Dialogue « Ouvrir un projet » : liste des projets enregistrés, du plus récent au plus ancien.
 * Ouvert tant que `session.library` contient une liste ; `<dialog>` natif (focus piégé, Échap).
 */
export function createProjectsDialog({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];

  const closeButton = createIconButton({
    icon: 'close',
    label: t.close,
    action: 'project:library:close',
    variant: 'filled',
    onClick: () => bus.emit('project:library:close'),
  });
  const list = h('ul', { class: 'projects-dialog__list' });
  const empty = h('p', { class: 'projects-dialog__empty' }, [t.empty]);
  const dialog = h('dialog', { class: 'projects-dialog', 'aria-labelledby': 'projects-dialog-title' }, [
    h('header', { class: 'projects-dialog__header' }, [
      h('h2', { class: 'projects-dialog__title', id: 'projects-dialog-title' }, [t.title]),
      closeButton,
    ]),
    list,
    empty,
  ]);

  // Échap ou clic hors du dialogue : on referme via l'état, pas directement.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    bus.emit('project:library:close');
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) bus.emit('project:library:close');
  });

  function render(entries: readonly LibraryEntry[] | null): void {
    if (entries === null) {
      if (dialog.open) dialog.close();
      return;
    }
    list.replaceChildren(...entries.map(createItem));
    empty.hidden = entries.length > 0;
    if (!dialog.open) dialog.showModal();
  }

  function createItem(entry: LibraryEntry): HTMLLIElement {
    const button = h(
      'button',
      { type: 'button', class: 'projects-dialog__item', 'data-action': 'project:open', 'data-project-id': entry.id },
      [
        h('span', { class: 'projects-dialog__name' }, [entry.name]),
        h('span', { class: 'projects-dialog__date' }, [t.savedAt(new Date(entry.savedAt))]),
      ],
    );
    button.addEventListener('click', () => bus.emit('project:open', { projectId: entry.id }));
    return h('li', {}, [button]);
  }

  cleanups.push(store.watch((s) => s.session.library, render));

  return {
    mount(parent) {
      parent.append(dialog);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      dialog.remove();
    },
  };
}
