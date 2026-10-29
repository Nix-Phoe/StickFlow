import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Lu sur le disque : Vitest remplace les imports CSS (même `?raw`) par une chaîne vide.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Déclarations « --nom: valeur » du premier bloc qui suit `selector`. */
function declarations(selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'));
}

describe('tokens.css: mode sombre', () => {
  it('declares the same dark colours whether automatic or forced in the settings', () => {
    const automatic = declarations(':root:not([data-theme="light"])');
    expect(automatic.length).toBeGreaterThan(20);
    expect(declarations(':root[data-theme="dark"]')).toEqual(automatic);
  });
});
