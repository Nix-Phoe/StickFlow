import { h } from '../dom';

export interface SwitchOptions {
  label: string;
  action: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface SwitchControl {
  element: HTMLButtonElement;
  setChecked(checked: boolean): void;
}

/** Interrupteur iOS (`role="switch"`). Contrôlé : l'état affiché vient de `setChecked`. */
export function createSwitch(options: SwitchOptions): SwitchControl {
  const element = h(
    'button',
    {
      type: 'button',
      class: 'switch',
      role: 'switch',
      'aria-label': options.label,
      'aria-checked': String(options.checked),
      'data-action': options.action,
    },
    [h('span', { class: 'switch__thumb', 'aria-hidden': 'true' })],
  );

  element.addEventListener('click', () => {
    options.onChange(element.getAttribute('aria-checked') !== 'true');
  });

  return {
    element,
    setChecked(checked) {
      element.setAttribute('aria-checked', String(checked));
    },
  };
}
