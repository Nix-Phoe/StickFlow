import '../styles/components/canvas-area.css';

import type { StagePointer } from '../../core/events';
import { NUDGE_FINE_STEP, NUDGE_STEP } from '../../interaction';
import type { Component, ComponentContext } from '../component';
import { h, ids } from '../dom';
import { strings } from '../strings';

/**
 * Zone centrale : un `<canvas id="stage">` qui suit la taille de son conteneur
 * en pixels physiques (`devicePixelRatio`). L'UI n'y dessine jamais : elle émet le pointeur
 * (`stage:pointer:*`) et les touches (`node:*`) ; le rendu et la manipulation s'en chargent.
 */
export function createCanvasArea({ bus }: ComponentContext): Component {
  const canvas = h('canvas', {
    id: ids.stage,
    class: 'canvas-area__canvas',
    role: 'application',
    tabindex: 0,
    'aria-label': strings.stage.canvas,
  });
  const root = h('div', { class: 'canvas-area' }, [canvas]);

  let observer: ResizeObserver | null = null;
  let stopWatchingPixelRatio: (() => void) | null = null;

  // ---------- Pointeur ----------
  function toStagePointer(event: PointerEvent): StagePointer {
    const rect = canvas.getBoundingClientRect();
    return {
      pointerId: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    // Un seul doigt (ou le bouton principal) manipule la scène.
    if (!event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
    bus.emit('stage:pointer:down', toStagePointer(event));
  });

  canvas.addEventListener('pointermove', (event) => {
    if (canvas.hasPointerCapture(event.pointerId)) bus.emit('stage:pointer:move', toStagePointer(event));
  });

  const release = (event: PointerEvent): void => {
    if (!canvas.classList.contains('is-dragging')) return;
    canvas.classList.remove('is-dragging');
    bus.emit('stage:pointer:up', toStagePointer(event));
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  // ---------- Clavier ----------
  canvas.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? NUDGE_FINE_STEP : NUDGE_STEP;
    switch (event.key) {
      case 'ArrowDown':
        bus.emit('node:cycle', { direction: 1 });
        break;
      case 'ArrowUp':
        bus.emit('node:cycle', { direction: -1 });
        break;
      // y vers le haut : un angle positif tourne dans le sens antihoraire.
      case 'ArrowLeft':
        bus.emit('node:nudge', { radians: step });
        break;
      case 'ArrowRight':
        bus.emit('node:nudge', { radians: -step });
        break;
      case 'Escape':
        bus.emit('node:select', { nodeId: null });
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  // ---------- Taille ----------
  function applySize(width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio || 1;
    if (width === 0 || height === 0) return;
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    bus.emit('canvas:resize', { width, height, pixelRatio });
  }

  function measureFromCss(): void {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    applySize(Math.round(rect.width * pixelRatio), Math.round(rect.height * pixelRatio));
  }

  function onResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    // Taille exacte en pixels physiques quand le navigateur la fournit (Chrome, Firefox).
    const devicePixels = entry.devicePixelContentBoxSize?.[0];
    if (devicePixels) {
      applySize(devicePixels.inlineSize, devicePixels.blockSize);
      return;
    }
    const box = entry.contentBoxSize[0];
    const pixelRatio = window.devicePixelRatio || 1;
    if (box) applySize(Math.round(box.inlineSize * pixelRatio), Math.round(box.blockSize * pixelRatio));
  }

  /** Suit les changements de `devicePixelRatio` (zoom, changement d'écran). */
  function watchPixelRatio(): () => void {
    let query: MediaQueryList | null = null;
    const listen = (): void => {
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener('change', onChange, { once: true });
    };
    const onChange = (): void => {
      measureFromCss();
      listen();
    };
    listen();
    return () => query?.removeEventListener('change', onChange);
  }

  return {
    mount(parent) {
      parent.append(root);
      observer = new ResizeObserver(onResize);
      try {
        observer.observe(canvas, { box: 'device-pixel-content-box' });
      } catch {
        observer.observe(canvas, { box: 'content-box' });
      }
      stopWatchingPixelRatio = watchPixelRatio();
    },
    destroy() {
      observer?.disconnect();
      stopWatchingPixelRatio?.();
      root.remove();
    },
  };
}
