// Logo de StickFlow (src/ui/assets/logo.svg), dessiné en `currentColor` : sa couleur vient du CSS.
import logoSource from './assets/logo.svg?raw';

/** Crée le logo SVG décoratif (masqué aux technologies d'assistance). */
export function logo(className = 'logo'): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = logoSource.trim();
  const svg = template.content.firstElementChild;
  if (!(svg instanceof SVGElement)) throw new Error('Logo SVG invalide');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
