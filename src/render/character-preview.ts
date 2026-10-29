// Aperçu d'un personnage seul, dans sa pose de repos, agrandi pour remplir une petite zone
// (vignettes de la liste, fenêtre « Coloration partielle ») : ses vraies couleurs et ses zones
// de couleur, et en option le contour des parties choisies. Le cadrage est pur ; le dessin, Canvas 2D.

import type { Character, FramePose, Vec2 } from '../core/types';
import { characterBounds } from '../model/character';
import { STAGE_WORLD_HEIGHT, screenToWorld, type Viewport } from './camera';
import { paintCapsules } from './canvas2d';
import type { Rgba } from './color';
import { DEFAULT_STICKMAN_STYLE } from './scene';
import { buildSceneLayers } from './scene-layers';

/** Part de l'aperçu occupée par le personnage, le reste servant de marge. */
const DEFAULT_FILL = 0.88;
const PREVIEW_FRAME_ID = 'preview';

export interface PreviewFraming {
  /** Le personnage, visible, à la taille qui remplit l'aperçu. */
  character: Character;
  /** Pose de repos, la racine placée pour centrer le personnage. */
  pose: FramePose;
}

/** Taille et position qui centrent le personnage (pose de repos) et lui font remplir `fill` de l'aperçu. */
export function previewFraming(character: Character, viewport: Viewport, fill = DEFAULT_FILL): PreviewFraming {
  const atScale = (scale: number): Character => ({ ...character, visible: true, locked: false, appearance: { ...character.appearance, scale } });
  const rest: FramePose = { pose: {}, rootPosition: { x: 0, y: 0 } };
  const stroke = DEFAULT_STICKMAN_STYLE.strokeWidth;

  // L'épaisseur des traits suit la taille : l'encombrement est proportionnel à la taille.
  const unit = characterBounds(atScale(1), rest, stroke);
  const visibleWidth = (STAGE_WORLD_HEIGHT * viewport.width) / (viewport.height || 1);
  const scale = fill * Math.min(STAGE_WORLD_HEIGHT / (unit.maxY - unit.minY || 1), visibleWidth / (unit.maxX - unit.minX || 1));

  const framed = atScale(scale);
  const box = characterBounds(framed, rest, stroke);
  return { character: framed, pose: { pose: {}, rootPosition: { x: -(box.minX + box.maxX) / 2, y: -(box.minY + box.maxY) / 2 } } };
}

/** Point de l'aperçu (pixels CSS depuis le coin haut-gauche) dans le monde de l'aperçu. */
export function previewPointToWorld(point: Vec2, viewport: Viewport): Vec2 {
  return screenToWorld(point, viewport, STAGE_WORLD_HEIGHT);
}

export interface PreviewPalette {
  /** Couleur automatique (personnage sans couleur). */
  stickman: Rgba;
  /** Contour des parties choisies. */
  accent: Rgba;
}

/** Dessine l'aperçu dans `context` (zone de `viewport` pixels), parties choisies entourées d'accent. */
export function paintCharacterPreview(
  context: CanvasRenderingContext2D,
  viewport: Viewport,
  framing: PreviewFraming,
  palette: PreviewPalette,
  selectedParts: readonly string[] = [],
): void {
  const { character, pose } = framing;
  const layers = buildSceneLayers({
    project: {
      name: '',
      fps: 1,
      characters: [character],
      keyframes: [],
      environment: { background: null, shapes: [], drawing: { tiles: {} } },
      recentColors: [],
      ai: {
        smoothing: { enabled: false, intensity: 1, curve: 'linear' },
        loop: { enabled: false, repeatCount: 1, infinite: false, transitionFrames: 1 },
      },
    },
    frame: { kind: 'keyframe', id: PREVIEW_FRAME_ID, poses: { [character.id]: pose } },
    onion: null,
    mode: selectedParts.length > 0 ? 'characters' : null,
    selection: { selectedCharacterId: character.id, selectedNodeId: null, selectedParts, selectedShapeId: null },
    palette,
  });
  for (const layer of layers) {
    if (layer.kind === 'capsules' && (layer.role === 'highlight' || layer.role === 'characters')) {
      // Le contour d'accent seul, sans le halo d'une poignée (aucun nœud n'est choisi ici).
      paintCapsules(context, viewport, layer.capsules);
    }
  }
}
