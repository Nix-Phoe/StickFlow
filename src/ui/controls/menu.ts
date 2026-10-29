import '../styles/menu.css';

import { h } from '../dom';
import { icon, type IconName } from '../icons';

export interface MenuItem {
  label: string;
  icon: IconName;
  action: string;
  /** Action irréversible (Supprimer) : en rouge. */
  destructive?: boolean;
  onSelect: () => void;
}

export interface MenuOptions {
  /** Libellé accessible du bouton « ⋮ ». */
  label: string;
  items: readonly MenuItem[];
  className?: string;
}

export interface MenuControl {
  element: HTMLDivElement;
  button: HTMLButtonElement;
  close(): void;
  destroy(): void;
}

/**
 * Menu « ⋮ » (bouton + liste d'actions), utilisable au clavier : Entrée, Espace ou ↓ l'ouvre sur la
 * première action, ↑ / ↓ / Début / Fin s'y déplacent, Échap ou Tab le referment.
 */
export function createMenu(options: MenuOptions): MenuControl {
  const button = h(
    'button',
    { type: 'button', class: 'menu__button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': options.label, title: options.label },
    [icon('more')],
  );
  const items = options.items.map((item) => {
    const entry = h(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        tabindex: -1,
        class: `menu__item${item.destructive ? ' menu__item--destructive' : ''}`,
        'data-action': item.action,
      },
      [icon(item.icon), h('span', {}, [item.label])],
    );
    entry.addEventListener('click', () => {
      close(true);
      item.onSelect();
    });
    return entry;
  });
  const list = h('div', { class: 'menu__list', role: 'menu', 'aria-label': options.label, hidden: true }, items);
  const element = h('div', { class: ['menu', options.className].filter(Boolean).join(' ') }, [button, list]);

  const isOpen = (): boolean => !list.hidden;

  function open(focusIndex = 0): void {
    list.hidden = false;
    // S'ouvre vers le haut quand la place manque en dessous (dernière rangée de cartes).
    const below = window.innerHeight - button.getBoundingClientRect().bottom;
    element.classList.toggle('opens-up', below < list.offsetHeight + button.offsetHeight);
    button.setAttribute('aria-expanded', 'true');
    element.classList.add('is-open');
    items[focusIndex]?.focus();
    document.addEventListener('pointerdown', onOutside, true);
  }

  function close(restoreFocus = false): void {
    if (!isOpen()) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    element.classList.remove('is-open');
    document.removeEventListener('pointerdown', onOutside, true);
    if (restoreFocus) button.focus();
  }

  function onOutside(event: PointerEvent): void {
    if (!element.contains(event.target as Node)) close();
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowUp' ? items.length - 1 : 0);
    }
  });
  list.addEventListener('keydown', (event) => {
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const last = items.length - 1;
    const focus = (i: number): void => items[i]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        focus(index >= last ? 0 : index + 1);
        break;
      case 'ArrowUp':
        focus(index <= 0 ? last : index - 1);
        break;
      case 'Home':
        focus(0);
        break;
      case 'End':
        focus(last);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close();
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  return {
    element,
    button,
    close: () => close(),
    destroy: () => document.removeEventListener('pointerdown', onOutside, true),
  };
}
