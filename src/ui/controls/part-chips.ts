import { h } from '../dom';

export interface PartChipsOptions {
  /** Nom du groupe, lu par les lecteurs d'écran. */
  label: string;
  action: string;
  /** Nom affiché d'une partie. */
  name: (nodeId: string) => string;
  /** Pastille « personnage entier » en tête (`null` : aucune). */
  wholeLabel: string | null;
  /** Ordre d'affichage (lecture du corps, de la tête aux pieds) ; les parties absentes viennent à la fin. */
  order?: readonly string[];
  /** `nodeId` `null` : personnage entier ; `additive` : Maj, pour en choisir plusieurs. */
  onSelect: (nodeId: string | null, additive: boolean) => void;
}

export interface PartChipsControl {
  element: HTMLElement;
  /** Parties proposées (rangées selon `order`). */
  setParts(parts: readonly string[]): void;
  setSelected(selected: readonly string[]): void;
}

/** Rangée de pastilles qui choisit les parties d'un personnage (boutons bascule, défilement horizontal). */
export function createPartChips(options: PartChipsOptions): PartChipsControl {
  const element = h('div', { class: 'part-chips', role: 'group', 'aria-label': options.label });
  let parts: readonly string[] = [];
  let selected: readonly string[] = [];

  element.addEventListener('click', (event) => {
    const chip = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.part-chip') : null;
    if (!chip) return;
    options.onSelect(chip.dataset.part || null, event.shiftKey);
  });

  function chip(nodeId: string | null, text: string): HTMLButtonElement {
    return h('button', { type: 'button', class: 'chip part-chip', 'data-part': nodeId ?? '', 'data-action': options.action, 'aria-pressed': 'false' }, [text]);
  }

  function render(): void {
    for (const button of element.querySelectorAll<HTMLButtonElement>('.part-chip')) {
      const part = button.dataset.part ?? '';
      button.setAttribute('aria-pressed', String(part === '' ? selected.length === 0 : selected.includes(part)));
    }
  }

  return {
    element,
    setParts(next) {
      if (next.length === parts.length && next.every((p, i) => p === parts[i])) return;
      const rank = (part: string): number => {
        const index = options.order?.indexOf(part) ?? -1;
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      parts = next;
      const ordered = next.toSorted((a, b) => rank(a) - rank(b));
      element.replaceChildren(
        ...(options.wholeLabel === null ? [] : [chip(null, options.wholeLabel)]),
        ...ordered.map((part) => chip(part, options.name(part))),
      );
      render();
    },
    setSelected(next) {
      selected = next;
      render();
    },
  };
}
