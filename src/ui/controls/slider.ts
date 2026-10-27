import { h } from '../dom';

export interface SliderOptions {
  id: string;
  action: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Texte lu par les lecteurs d'écran (ex. « 3 images »). */
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
}

export interface SliderControl {
  element: HTMLInputElement;
  setValue(value: number): void;
  setDisabled(disabled: boolean): void;
}

/** Slider natif (`input[type=range]`) stylé façon iOS. L'étiquette est fournie par l'appelant. */
export function createSlider(options: SliderOptions): SliderControl {
  const element = h('input', {
    type: 'range',
    id: options.id,
    class: 'slider',
    min: options.min,
    max: options.max,
    step: options.step ?? 1,
    value: options.value,
    'data-action': options.action,
  });

  element.addEventListener('input', () => {
    updateProgress();
    options.onChange(element.valueAsNumber);
  });

  function updateProgress(): void {
    const value = element.valueAsNumber;
    const ratio = (value - options.min) / (options.max - options.min || 1);
    element.style.setProperty('--slider-progress', `${ratio * 100}%`);
    element.setAttribute('aria-valuetext', options.formatValue(value));
  }

  updateProgress();

  return {
    element,
    setValue(value) {
      if (element.valueAsNumber !== value) element.valueAsNumber = value;
      updateProgress();
    },
    setDisabled(disabled) {
      element.disabled = disabled;
    },
  };
}
