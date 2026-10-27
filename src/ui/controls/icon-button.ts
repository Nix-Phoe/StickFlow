import { h } from '../dom';
import { icon, type IconName } from '../icons';

export interface IconButtonOptions {
  icon: IconName;
  label: string;
  action: string;
  variant?: 'plain' | 'filled' | 'accent';
  className?: string;
  onClick: () => void;
}

/** Bouton circulaire 44 × 44 px ne contenant qu'une icône (libellé via `aria-label`). */
export function createIconButton(options: IconButtonOptions): HTMLButtonElement {
  const classes = ['icon-button'];
  if (options.variant && options.variant !== 'plain') classes.push(`icon-button--${options.variant}`);
  if (options.className) classes.push(options.className);

  const button = h(
    'button',
    {
      type: 'button',
      class: classes.join(' '),
      'aria-label': options.label,
      title: options.label,
      'data-action': options.action,
    },
    [icon(options.icon)],
  );
  button.addEventListener('click', options.onClick);
  return button;
}
