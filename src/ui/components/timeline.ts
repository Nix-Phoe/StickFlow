import '../styles/components/timeline.css';

import type { Frame } from '../../core/types';
import type { Component, ComponentContext } from '../component';
import { h, prefersReducedMotion } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.timeline;

/**
 * Barre inférieure : vignettes numérotées, frame active surlignée,
 * frames générées par l'IA distinguées, bouton « + ».
 * Clavier : flèches gauche / droite, Début, Fin pour changer de frame.
 */
export function createTimeline({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  let thumbs: HTMLButtonElement[] = [];

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
    scroller,
  ]);

  list.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.frame-thumb') : null;
    if (target) bus.emit('frame:select', { index: Number(target.dataset.index) });
  });

  list.addEventListener('keydown', (event) => {
    const last = store.state.project.present.frames.length - 1;
    const current = store.state.session.activeFrameIndex;
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
      default:
        return;
    }
    event.preventDefault();
    bus.emit('frame:select', { index: next });
    thumbs[next]?.focus();
  });

  function renderFrames(frames: readonly Frame[]): void {
    thumbs = frames.map((frame, index) => createThumb(frame, index));
    list.replaceChildren(...thumbs.map((thumb) => h('li', { class: 'timeline__item' }, [thumb])));
    count.textContent = t.count(frames.length);
    renderActive(store.state.session.activeFrameIndex);
  }

  function renderActive(activeIndex: number): void {
    thumbs.forEach((thumb, index) => {
      const active = index === activeIndex;
      thumb.classList.toggle('is-active', active);
      thumb.tabIndex = active ? 0 : -1;
      if (active) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
    thumbs[activeIndex]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  cleanups.push(
    store.watch((s) => s.project.present.frames, renderFrames),
    store.watch((s) => s.session.activeFrameIndex, renderActive),
  );

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}

function createThumb(frame: Frame, index: number): HTMLButtonElement {
  const number = index + 1;
  return h(
    'button',
    {
      type: 'button',
      class: frame.generated ? 'frame-thumb frame-thumb--generated' : 'frame-thumb',
      'aria-label': t.frameLabel(number, frame.generated),
      'data-action': 'frame:select',
      'data-index': index,
      'data-frame-id': frame.id,
    },
    [
      h('span', { class: 'frame-thumb__preview', 'aria-hidden': 'true' }, [icon('person', 'icon frame-thumb__figure')]),
      h('span', { class: 'frame-thumb__number', 'aria-hidden': 'true' }, [String(number)]),
      ...(frame.generated
        ? [h('span', { class: 'frame-thumb__badge', 'aria-hidden': 'true' }, [icon('sparkles')])]
        : []),
    ],
  );
}
