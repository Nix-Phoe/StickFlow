import type { BackgroundPainter } from './painter';

/** Quadrillage de studio : fond gris clair, carreaux réguliers et lignes plus marquées tous les 4. */
export const studioGrid: BackgroundPainter = (context, width, height) => {
  context.fillStyle = '#f1f2f4';
  context.fillRect(0, 0, width, height);
  const cell = height / 12;
  const line = Math.max(1, height / 900);
  const columns = Math.ceil(width / 2 / cell);
  const rows = Math.ceil(height / 2 / cell);
  // Le quadrillage part du centre : il reste symétrique quel que soit le format.
  for (let i = -columns; i <= columns; i += 1) {
    context.fillStyle = i % 4 === 0 ? '#c3c7ce' : '#dde0e5';
    context.fillRect(width / 2 + i * cell - line / 2, 0, line, height);
  }
  for (let j = -rows; j <= rows; j += 1) {
    context.fillStyle = j % 4 === 0 ? '#c3c7ce' : '#dde0e5';
    context.fillRect(0, height / 2 + j * cell - line / 2, width, line);
  }
};
