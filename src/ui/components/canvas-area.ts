import '../styles/components/canvas-area.css';

import type { Component, ComponentContext } from '../component';
import { h, ids } from '../dom';
import { strings } from '../strings';

/**
 * Zone centrale : un `<canvas id="stage">` qui suit la taille de son conteneur
 * en pixels physiques (`devicePixelRatio`). Le rendu WebGL 2 arrive en phase 2 ;
 * il pourra écouter `canvas:resize` pour ajuster son viewport.
 */
export function createCanvasArea({ bus }: ComponentContext): Component {
  const canvas = h('canvas', {
    id: ids.stage,
    class: 'canvas-area__canvas',
    role: 'img',
    'aria-label': strings.stage.canvas,
  });
  const root = h('div', { class: 'canvas-area' }, [canvas]);

  let observer: ResizeObserver | null = null;
  let stopWatchingPixelRatio: (() => void) | null = null;

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
