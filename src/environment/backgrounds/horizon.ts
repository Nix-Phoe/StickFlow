import { verticalGradient, type BackgroundPainter } from './painter';

/** Sol et horizon : ciel clair, sol vert à partir du tiers bas, ligne d'horizon nette. */
export const horizon: BackgroundPainter = (context, width, height) => {
  verticalGradient(context, width, height, [
    [0, '#8ec5f0'],
    [0.66, '#e3f2fb'],
  ]);
  const ground = height * 0.66;
  const soil = context.createLinearGradient(0, ground, 0, height);
  soil.addColorStop(0, '#7fb55a');
  soil.addColorStop(1, '#4f8a3a');
  context.fillStyle = soil;
  context.fillRect(0, ground, width, height - ground);
  context.fillStyle = 'rgba(0, 0, 0, 0.12)';
  context.fillRect(0, ground, width, Math.max(1, height * 0.004));
};
