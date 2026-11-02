import { describe, expect, it } from 'vitest';

import { supportsWebGL2 } from './webgl-support';

/** Faux canvas : `getContext` rend le contexte donné (ou lève), et l'on note la libération. */
function fakeCanvas(context: 'ok' | 'none' | 'throws') {
  const log: string[] = [];
  const canvas = {
    getContext(type: string) {
      log.push(`get ${type}`);
      if (context === 'throws') throw new Error('bloqué');
      if (context === 'none') return null;
      return { getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext: () => log.push('lose') } : null) };
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, log };
}

describe('supportsWebGL2', () => {
  it('is true when a WebGL 2 context can be created, and frees it right away', () => {
    const { canvas, log } = fakeCanvas('ok');
    expect(supportsWebGL2(() => canvas)).toBe(true);
    expect(log).toEqual(['get webgl2', 'lose']);
  });

  it('is false when the browser has no WebGL 2, or refuses it', () => {
    expect(supportsWebGL2(() => fakeCanvas('none').canvas)).toBe(false);
    expect(supportsWebGL2(() => fakeCanvas('throws').canvas)).toBe(false);
  });
});
