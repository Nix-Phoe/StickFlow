// Remplissage par diffusion (pot de peinture) sur une image RGBA, par lignes. Pur.

import type { PixelRect } from '../model/drawing-layer';

/**
 * Remplit avec `color` (RGBA 0-255) la zone de pixels voisins de (`x`, `y`) qui ont sa couleur,
 * à `tolerance` près sur chaque canal (bords anticrénelés). Modifie `data` sur place et renvoie
 * le rectangle repeint, ou `null` si rien n'a changé.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
  tolerance = 0,
): PixelRect | null {
  const startX = Math.floor(x);
  const startY = Math.floor(y);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return null;

  const start = (startY * width + startX) * 4;
  const target = [data[start] ?? 0, data[start + 1] ?? 0, data[start + 2] ?? 0, data[start + 3] ?? 0];
  if (target.every((value, i) => value === color[i])) return null;

  const matches = (offset: number): boolean => {
    for (let i = 0; i < 4; i += 1) if (Math.abs((data[offset + i] ?? 0) - (target[i] ?? 0)) > tolerance) return false;
    return true;
  };
  const visited = new Uint8Array(width * height);
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  const stack: Array<[number, number]> = [[startX, startY]];
  for (let next = stack.pop(); next; next = stack.pop()) {
    const [px, py] = next;
    let left = px;
    while (left > 0 && !visited[py * width + left - 1] && matches((py * width + left - 1) * 4)) left -= 1;
    let right = px;
    while (right < width - 1 && !visited[py * width + right + 1] && matches((py * width + right + 1) * 4)) right += 1;
    if (visited[py * width + px] || !matches((py * width + px) * 4)) continue;

    for (let cx = left; cx <= right; cx += 1) {
      const index = py * width + cx;
      visited[index] = 1;
      data.set(color, index * 4);
      // Les lignes voisines : on y empile un point de départ par segment encore à remplir.
      for (const ny of [py - 1, py + 1]) {
        if (ny < 0 || ny >= height) continue;
        const neighbour = ny * width + cx;
        const isStart = cx === left || visited[neighbour - 1] || !matches((neighbour - 1) * 4);
        if (!visited[neighbour] && isStart && matches(neighbour * 4)) stack.push([cx, ny]);
      }
    }
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
