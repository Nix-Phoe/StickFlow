// Icônes Lucide (licence ISC), centralisées. Ajouter ici toute nouvelle icône.

import {
  createElement,
  Download,
  Gauge,
  Infinity as InfinityIcon,
  Menu,
  Minus,
  Pause,
  PersonStanding,
  Play,
  Plus,
  Redo2,
  Repeat,
  Save,
  Sparkles,
  Undo2,
  X,
  type IconNode,
} from 'lucide';

const registry = {
  download: Download,
  fps: Gauge,
  infinity: InfinityIcon,
  menu: Menu,
  minus: Minus,
  pause: Pause,
  person: PersonStanding,
  play: Play,
  plus: Plus,
  redo: Redo2,
  repeat: Repeat,
  save: Save,
  sparkles: Sparkles,
  undo: Undo2,
  close: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof registry;

/** Crée une icône SVG décorative (masquée aux technologies d'assistance). */
export function icon(name: IconName, className = 'icon'): SVGElement {
  return createElement(registry[name], {
    class: className,
    'aria-hidden': 'true',
    focusable: 'false',
  });
}
