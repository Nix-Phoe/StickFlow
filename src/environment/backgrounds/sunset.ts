import { verticalGradient, type BackgroundPainter } from './painter';

/** Coucher de soleil : ciel orangé vers le violet, soleil bas sur l'horizon, collines sombres. */
export const sunset: BackgroundPainter = (context, width, height) => {
  verticalGradient(context, width, height, [
    [0, '#2e1f5e'],
    [0.45, '#c2456b'],
    [0.75, '#f39a4a'],
    [1, '#ffd27a'],
  ]);
  const unit = Math.min(width, height);
  const horizon = height * 0.78;
  const sun = context.createRadialGradient(width * 0.5, horizon, 0, width * 0.5, horizon, unit * 0.22);
  sun.addColorStop(0, 'rgba(255, 244, 200, 1)');
  sun.addColorStop(0.45, 'rgba(255, 214, 120, 0.9)');
  sun.addColorStop(1, 'rgba(255, 180, 90, 0)');
  context.fillStyle = sun;
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#3b1d3f';
  context.beginPath();
  context.moveTo(0, height);
  context.lineTo(0, horizon + height * 0.04);
  context.quadraticCurveTo(width * 0.25, horizon - height * 0.05, width * 0.5, horizon + height * 0.03);
  context.quadraticCurveTo(width * 0.78, horizon + height * 0.09, width, horizon - height * 0.02);
  context.lineTo(width, height);
  context.closePath();
  context.fill();
};
