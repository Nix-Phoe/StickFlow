import '../styles/components/timeline.css';

import { activeFrame, sequenceOf } from '../../core/selectors';
import type { SequenceFrame } from '../../model/sequence';
import { paintThumbnail } from '../../render/thumbnail';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { h, prefersReducedMotion } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.timeline;

/** Tokens CSS des vignettes : image clé, ou frame générée (couleur d'accent). */
const THUMB_COLOR_TOKENS = { keyframe: '--color-stickman', generated: '--color-accent' } as const;

interface Thumb {
  item: HTMLLIElement;
  button: HTMLButtonElement;
  number: HTMLSpanElement;
  canvas: HTMLCanvasElement;
  frame: SequenceFrame;
}

/**
 * Barre inférieure : actions sur la frame active, vignettes de la séquence (images clés et
 * frames générées, distinguées), bouton « + ».
 * Clavier : flèches gauche / droite, Début, Fin pour changer de frame ; Suppr pour supprimer une image clé.
 */
export function createTimeline({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  /** Vignettes conservées d'un rendu à l'autre, par id de frame : seules celles qui changent sont repeintes. */
  const thumbsById = new Map<string, Thumb>();
  let order: Thumb[] = [];
  let repaintRequest = 0;

  // ---------- Actions ----------
  const copyButton = createIconButton({
    icon: 'copy',
    label: t.copyPose,
    action: 'frame:copy',
    onClick: () => bus.emit('frame:copy'),
  });
  const pasteButton = createIconButton({
    icon: 'paste',
    label: t.pastePose,
    action: 'frame:paste',
    onClick: () => bus.emit('frame:paste'),
  });
  const deleteButton = createIconButton({
    icon: 'trash',
    label: t.deleteFrame,
    action: 'frame:delete',
    onClick: () => bus.emit('frame:delete'),
  });
  const actions = h('div', { class: 'timeline__actions', role: 'group', 'aria-label': t.actions }, [
    copyButton,
    pasteButton,
    deleteButton,
  ]);

  // ---------- Vignettes ----------
  const count = h('span', { class: 'timeline__count' });
  const list = h('ol', { class: 'timeline__frames', 'aria-label': t.frames });
  const addButton = h(
    'button',
    { type: 'button', class: 'timeline__add', 'aria-label': t.addFrame, title: t.addFrame, 'data-action': 'frame:add' },
    [icon('plus', 'icon timeline__add-icon')],
  );
  addButton.addEventListener('click', () => bus.emit('frame:add'));

  const scroller = h('div', { class: 'timeline__scroller' }, [list, addButton]);
  const root = h('div', { class: 'timeline' }, [
    h('div', { class: 'timeline__header' }, [
      h('h2', { class: 'timeline__title' }, [t.title]),
      count,
      h('span', { class: 'timeline__legend' }, [
        h('span', { class: 'timeline__legend-swatch', 'aria-hidden': 'true' }, [icon('sparkles')]),
        t.generatedLegend,
      ]),
    ]),
    h('div', { class: 'timeline__body' }, [actions, scroller]),
  ]);

  const activeIndex = (): number => activeFrame(store.state)?.index ?? 0;

  list.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.frame-thumb') : null;
    if (target) bus.emit('frame:select', { index: Number(target.dataset.index) });
  });

  list.addEventListener('keydown', (event) => {
    const last = order.length - 1;
    const current = activeIndex();
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(last, current + 1);
        break;
      case 'ArrowLeft':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        bus.emit('frame:delete');
        order[activeIndex()]?.button.focus();
        return;
      default:
        return;
    }
    event.preventDefault();
    bus.emit('frame:select', { index: next });
    order[next]?.button.focus();
  });

  function syncFrames(sequence: readonly SequenceFrame[]): void {
    const dirty: Thumb[] = [];
    const next = sequence.map((frame, index) => {
      let thumb = thumbsById.get(frame.id);
      // Le badge et le style dépendent de la sorte de frame : on recrée la vignette si elle change.
      if (!thumb || thumb.frame.kind !== frame.kind) {
        thumb = createThumb(frame);
        thumbsById.set(frame.id, thumb);
        dirty.push(thumb);
      } else if (thumb.frame !== frame) {
        thumb.frame = frame;
        dirty.push(thumb);
      }
      setThumbIndex(thumb, index);
      return thumb;
    });

    const ids = new Set(sequence.map((f) => f.id));
    for (const id of thumbsById.keys()) if (!ids.has(id)) thumbsById.delete(id);
    if (next.length !== order.length || next.some((thumb, i) => thumb !== order[i])) {
      list.replaceChildren(...next.map((thumb) => thumb.item));
    }
    order = next;

    count.textContent = t.count(sequence.length);
    dirty.forEach(paint);
    renderActive();
  }

  function paint(thumb: Thumb): void {
    const token = thumb.frame.kind === 'generated' ? THUMB_COLOR_TOKENS.generated : THUMB_COLOR_TOKENS.keyframe;
    const color = getComputedStyle(root).getPropertyValue(token).trim();
    paintThumbnail(thumb.canvas, store.state.project.present.skeleton, thumb.frame, color);
  }

  /** Repeint toutes les vignettes (squelette, thème ou taille modifiés), une fois par image d'affichage. */
  function repaintAll(): void {
    if (repaintRequest !== 0) return;
    repaintRequest = requestAnimationFrame(() => {
      repaintRequest = 0;
      order.forEach(paint);
    });
  }

  function renderActive(): void {
    const active = activeFrame(store.state);
    const index = active?.index ?? 0;
    order.forEach((thumb, i) => {
      const isActive = i === index;
      thumb.button.classList.toggle('is-active', isActive);
      thumb.button.tabIndex = isActive ? 0 : -1;
      if (isActive) thumb.button.setAttribute('aria-current', 'true');
      else thumb.button.removeAttribute('aria-current');
    });
    // Seules les images clés se suppriment, et jamais la dernière.
    deleteButton.disabled = active?.frame.kind !== 'keyframe' || store.state.project.present.keyframes.length <= 1;
    const smooth = !prefersReducedMotion() && !store.state.session.isPlaying;
    order[index]?.button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }

  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colorScheme.addEventListener('change', repaintAll);
  window.addEventListener('resize', repaintAll);

  cleanups.push(
    () => colorScheme.removeEventListener('change', repaintAll),
    () => window.removeEventListener('resize', repaintAll),
    () => cancelAnimationFrame(repaintRequest),
    store.watch(sequenceOf, syncFrames),
    store.watch((s) => s.project.present.skeleton, repaintAll),
    store.watch((s) => s.session.activeFrameId, renderActive),
    store.watch((s) => s.session.clipboard, (clipboard) => (pasteButton.disabled = clipboard === null)),
  );

  return {
    mount(parent) {
      parent.append(root);
      // Les vignettes n'ont une taille qu'une fois dans le document.
      repaintAll();
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}

function createThumb(frame: SequenceFrame): Thumb {
  const generated = frame.kind === 'generated';
  const number = h('span', { class: 'frame-thumb__number', 'aria-hidden': 'true' });
  const canvas = h('canvas', { class: 'frame-thumb__canvas', 'aria-hidden': 'true' });
  const button = h(
    'button',
    {
      type: 'button',
      class: generated ? 'frame-thumb frame-thumb--generated' : 'frame-thumb',
      'data-action': 'frame:select',
      'data-frame-id': frame.id,
    },
    [
      canvas,
      number,
      ...(generated ? [h('span', { class: 'frame-thumb__badge', 'aria-hidden': 'true' }, [icon('sparkles')])] : []),
    ],
  );
  return { item: h('li', { class: 'timeline__item' }, [button]), button, number, canvas, frame };
}

function setThumbIndex(thumb: Thumb, index: number): void {
  const label = String(index + 1);
  if (thumb.number.textContent === label) return;
  thumb.number.textContent = label;
  thumb.button.dataset.index = String(index);
  thumb.button.setAttribute('aria-label', t.frameLabel(index + 1, thumb.frame.kind === 'generated'));
}
