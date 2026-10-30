// Contexte commun de la sous-page « Arrière-plan » (v2.1) et de ses onglets.

import { createId } from '../../../core/id';
import type { DrawingImage } from '../../../render/canvas2d';
import type { ComponentContext } from '../../component';
import { createSlider, type SliderControl, type SliderOptions } from '../../controls/slider';

/** Arrière-plan composé de la scène : montré dans l'aperçu et la vignette de la ligne. */
export interface BackgroundPreviewSource {
  image(): DrawingImage | null;
  onChange(listener: () => void): () => void;
}

export interface BackgroundContext extends ComponentContext {
  preview: BackgroundPreviewSource;
  /** Le proxy d'images a une adresse (onglet Internet). */
  stockConfigured: boolean;
}

/**
 * Dessine l'arrière-plan composé dans `canvas`, à sa taille affichée ; sans arrière-plan, le
 * canvas reste transparent (la couleur de la scène, du thème, se voit dessous).
 */
export function paintPreview(canvas: HTMLCanvasElement, source: BackgroundPreviewSource): void {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (width === 0 || height === 0) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const image = source.image();
  if (image) context.drawImage(image.image, 0, 0, width, height);
}

/**
 * Jeton d'un geste (glisser de slider, de la roue ou de l'aperçu) : tous les changements d'un même
 * geste forment une seule étape d'annulation. Un nouveau geste commence après `end()`.
 */
export function createGesture(): { token(): string; end(): void } {
  let current: string | null = null;
  return {
    token: () => (current ??= createId()),
    end: () => {
      current = null;
    },
  };
}

/** Slider dont un glisser complet ne crée qu'une étape d'annulation (jeton rendu au relâchement). */
export function createGestureSlider(
  options: Omit<SliderOptions, 'onChange'> & { onChange: (value: number, gesture: string) => void },
): SliderControl {
  const gesture = createGesture();
  const slider = createSlider({ ...options, onChange: (value) => options.onChange(value, gesture.token()) });
  slider.element.addEventListener('change', gesture.end);
  return slider;
}

/** Flèches, Début et Fin pour passer d'un bouton à l'autre dans une grille (tabindex itinérant). */
export function gridKeyboard(grid: HTMLElement, selector = 'button'): void {
  grid.addEventListener('keydown', (event) => {
    const items = [...grid.querySelectorAll<HTMLElement>(selector)].filter((item) => !item.hidden);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    const columns = Math.max(1, Math.round(grid.clientWidth / (items[0]?.offsetWidth || 1)));
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let next = index;
    if (event.key in moves) next = index + (moves[event.key] ?? 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    items[Math.min(items.length - 1, Math.max(0, next))]?.focus();
  });
}
