import { seededRandom, verticalGradient, type BackgroundPainter } from './painter';

/** Nuit étoilée : bleu nuit, étoiles semées (toujours les mêmes) et croissant de lune. */
export const starryNight: BackgroundPainter = (context, width, height) => {
  verticalGradient(context, width, height, [
    [0, '#060b1f'],
    [0.6, '#122046'],
    [1, '#24365f'],
  ]);
  const random = seededRandom(42);
  const unit = Math.min(width, height);
  const count = Math.round(140 * (width / height));
  for (let star = 0; star < count; star += 1) {
    context.globalAlpha = 0.4 + 0.6 * random();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(random() * width, random() * height * 0.85, unit * (0.002 + 0.004 * random()), 0, 2 * Math.PI);
    context.fill();
  }
  context.globalAlpha = 1;
  // Croissant : un disque clair, mordu par un disque de la couleur du ciel.
  const moon = { x: width * 0.8, y: height * 0.22, r: unit * 0.07 };
  context.fillStyle = '#f4efd2';
  context.beginPath();
  context.arc(moon.x, moon.y, moon.r, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = '#0a1230';
  context.beginPath();
  context.arc(moon.x + moon.r * 0.45, moon.y - moon.r * 0.2, moon.r * 0.9, 0, 2 * Math.PI);
  context.fill();
};
