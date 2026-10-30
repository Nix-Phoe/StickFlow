import type { BackgroundPainter } from './painter';

/** Salle simple : mur clair, plinthe, parquet en perspective légère et une fenêtre. */
export const room: BackgroundPainter = (context, width, height) => {
  context.fillStyle = '#efe6d8';
  context.fillRect(0, 0, width, height);
  const floor = height * 0.72;

  // Fenêtre : cadre, vitre bleutée et croisillon.
  const window = { x: width * 0.62, y: height * 0.16, w: Math.min(width, height) * 0.36, h: height * 0.32 };
  context.fillStyle = '#ffffff';
  context.fillRect(window.x, window.y, window.w, window.h);
  context.fillStyle = '#bfe0f4';
  const frame = window.h * 0.06;
  context.fillRect(window.x + frame, window.y + frame, window.w - 2 * frame, window.h - 2 * frame);
  context.fillStyle = '#ffffff';
  context.fillRect(window.x + window.w / 2 - frame / 2, window.y, frame, window.h);
  context.fillRect(window.x, window.y + window.h / 2 - frame / 2, window.w, frame);

  // Parquet : lames de plus en plus larges vers le bas.
  context.fillStyle = '#b98a5a';
  context.fillRect(0, floor, width, height - floor);
  context.fillStyle = 'rgba(80, 50, 20, 0.18)';
  let y = floor;
  for (let plank = 1; y < height; plank += 1) {
    y += (height - floor) * 0.06 * plank;
    context.fillRect(0, y, width, Math.max(1, height / 600));
  }
  // Plinthe.
  context.fillStyle = '#ffffff';
  context.fillRect(0, floor - height * 0.03, width, height * 0.03);
};
