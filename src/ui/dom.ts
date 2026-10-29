// Petits utilitaires DOM partagés par les composants.

export type Attributes = Record<string, string | number | boolean | undefined>;
export type Child = Node | string;

/** Crée un élément HTML avec ses attributs et ses enfants. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  element.append(...children);
  return element;
}

/** Media query sous laquelle le panneau gauche devient un tiroir (voir layout.css). */
export const DRAWER_MEDIA_QUERY = '(max-width: 899px)';

/** Identifiants partagés (ex. `aria-controls`) sans que les composants s'importent entre eux. */
export const ids = {
  sidePanel: 'side-panel',
  stage: 'stage',
  editorButton: 'editor-panel-button',
  editorPanel: 'editor-panel',
  /** Emplacements des onglets du panneau flottant, remplis par leurs composants. */
  charactersTab: 'editor-panel-characters',
  environmentTab: 'editor-panel-environment',
  partialPaintWindow: 'partial-paint-window',
  partialPaintButton: 'partial-paint-button',
} as const;

/** Media query sous laquelle le panneau flottant devient une feuille du bas (voir editor-panel.css). */
export const SHEET_MEDIA_QUERY = '(max-width: 599px)';

/**
 * Media query sous laquelle la fenêtre « Coloration partielle » prend la place du panneau flottant
 * (pas assez de largeur pour les deux côte à côte).
 */
export const STACKED_MEDIA_QUERY = '(max-width: 1099px)';

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
