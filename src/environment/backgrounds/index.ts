// Arrière-plans intégrés (v2.1) : chacun est une fonction de dessin, sans image externe (pas de
// droits à gérer, fonctionne hors ligne). Leurs noms sont dans `strings.background.builtins`.

import type { BuiltinBackgroundId } from '../../core/types';
import { daySky } from './day-sky';
import { horizon } from './horizon';
import type { BackgroundPainter } from './painter';
import { room } from './room';
import { starryNight } from './starry-night';
import { studioGrid } from './studio-grid';
import { sunset } from './sunset';

export type { BackgroundPainter };

export const BUILTIN_BACKGROUNDS: Record<BuiltinBackgroundId, BackgroundPainter> = {
  'day-sky': daySky,
  sunset,
  'starry-night': starryNight,
  horizon,
  'studio-grid': studioGrid,
  room,
};
