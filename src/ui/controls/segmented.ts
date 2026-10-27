import { h } from '../dom';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  /** Libellé accessible si `label` n'est pas assez explicite (ex. « x2 »). */
  ariaLabel?: string;
}

export interface SegmentedOptions<T extends string | number> {
  label: string;
  action: string;
  options: readonly SegmentOption<T>[];
  value: T;
  className?: string;
  onChange: (value: T) => void;
}

export interface SegmentedControl<T extends string | number> {
  element: HTMLDivElement;
  setValue(value: T): void;
  setDisabled(disabled: boolean): void;
}

/**
 * Contrôle segmenté iOS, exposé comme un groupe de boutons radio.
 * Clavier : flèches gauche / droite, Début, Fin (tabindex itinérant).
 */
export function createSegmented<T extends string | number>(
  options: SegmentedOptions<T>,
): SegmentedControl<T> {
  let current = options.value;

  const buttons = options.options.map((option) => {
    const button = h(
      'button',
      {
        type: 'button',
        class: 'segmented__item',
        role: 'radio',
        'aria-label': option.ariaLabel,
        title: option.ariaLabel,
        'data-action': options.action,
        'data-value': String(option.value),
      },
      [option.label],
    );
    button.addEventListener('click', () => select(option.value, false));
    return button;
  });

  const element = h(
    'div',
    {
      class: ['segmented', options.className].filter(Boolean).join(' '),
      role: 'radiogroup',
      'aria-label': options.label,
    },
    buttons,
  );

  element.addEventListener('keydown', (event) => {
    const index = options.options.findIndex((option) => option.value === current);
    const last = options.options.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index >= last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index <= 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const option = options.options[next];
    if (option) select(option.value, true);
  });

  function select(value: T, moveFocus: boolean): void {
    if (moveFocus) buttons[options.options.findIndex((o) => o.value === value)]?.focus();
    if (value !== current) options.onChange(value);
  }

  function render(): void {
    options.options.forEach((option, i) => {
      const button = buttons[i];
      if (!button) return;
      const selected = option.value === current;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  render();

  return {
    element,
    setValue(value) {
      current = value;
      render();
    },
    setDisabled(disabled) {
      element.setAttribute('aria-disabled', String(disabled));
      buttons.forEach((button) => (button.disabled = disabled));
    },
  };
}
