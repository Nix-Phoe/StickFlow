import { seededRandom, verticalGradient, type BackgroundPainter } from './painter';

/** Ciel de jour : bleu dégradé et quelques nuages doux. */
export const daySky: BackgroundPainter = (context, width, height) => {
  verticalGradient(context, width, height, [
    [0, '#4a90d9'],
    [0.7, '#9fd0f5'],
    [1, '#d9eefc'],
  ]);
  const random = seededRandom(7);
  const unit = Math.min(width, height);
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let cloud = 0; cloud < 4; cloud += 1) {
    const cx = (0.1 + 0.25 * cloud + 0.1 * random()) * width;
    const cy = (0.15 + 0.35 * random()) * height;
    const size = unit * (0.06 + 0.04 * random());
    context.beginPath();
    for (const [dx, dy, r] of [
      [0, 0, 1],
      [1.1, 0.2, 0.8],
      [-1.1, 0.25, 0.75],
      [0.5, -0.45, 0.7],
    ] as const) {
      context.moveTo(cx + dx * size + r * size, cy + dy * size);
      context.arc(cx + dx * size, cy + dy * size, r * size, 0, 2 * Math.PI);
    }
    context.fill();
  }
};
