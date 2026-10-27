import { clamp } from '../../core/types';
import { h } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

export interface StepperOptions {
  id: string;
  label: string;
  action: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

export interface StepperControl {
  element: HTMLDivElement;
  setValue(value: number): void;
  setDisabled(disabled: boolean): void;
}

/**
 * Stepper « − valeur + ». La valeur est aussi saisissable au clavier
 * (champ numérique : flèches haut / bas, saisie directe).
 */
export function createStepper(options: StepperOptions): StepperControl {
  let current = options.value;
  let disabled = false;

  const decrease = h(
    'button',
    {
      type: 'button',
      class: 'stepper__button',
      'aria-label': strings.stepper.decrease(options.label),
      'data-action': options.action,
      'data-step': -1,
    },
    [icon('minus')],
  );
  const increase = h(
    'button',
    {
      type: 'button',
      class: 'stepper__button',
      'aria-label': strings.stepper.increase(options.label),
      'data-action': options.action,
      'data-step': 1,
    },
    [icon('plus')],
  );
  const input = h('input', {
    type: 'number',
    id: options.id,
    class: 'stepper__value',
    inputmode: 'numeric',
    min: options.min,
    max: options.max,
    step: 1,
    value: current,
    'data-action': options.action,
  });

  const element = h('div', { class: 'stepper', role: 'group', 'aria-label': options.label }, [
    decrease,
    input,
    increase,
  ]);

  const commit = (value: number): void => {
    const next = clamp(Math.round(value), options.min, options.max);
    if (Number.isNaN(next)) return render();
    if (next !== current) options.onChange(next);
    else render();
  };

  decrease.addEventListener('click', () => commit(current - 1));
  increase.addEventListener('click', () => commit(current + 1));
  input.addEventListener('change', () => commit(input.valueAsNumber));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(input.valueAsNumber);
  });

  function render(): void {
    input.value = String(current);
    input.disabled = disabled;
    decrease.disabled = disabled || current <= options.min;
    increase.disabled = disabled || current >= options.max;
  }

  render();

  return {
    element,
    setValue(value) {
      current = value;
      render();
    },
    setDisabled(value) {
      disabled = value;
      render();
    },
  };
}
