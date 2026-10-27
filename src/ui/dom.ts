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
} as const;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
