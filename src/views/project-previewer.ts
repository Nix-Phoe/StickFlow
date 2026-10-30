// Aperçus des projets de l'accueil : l'animation jouée au survol d'une carte (une seule à la fois),
// et les vignettes manquantes, générées à la demande puis enregistrées dans l'index.

import { frameDuration } from '../animation/playback';
import type { Project } from '../core/types';
import { createDrawingSurface, type DrawingSurface } from '../drawing/surface';
import type { AssetImages } from '../environment/asset-images';
import { createBackgroundSurface } from '../environment/background-surface';
import { deriveSequence } from '../model/sequence';
import type { DrawingImage } from '../render/canvas2d';
import { paintProjectFrame, PROJECT_THUMBNAIL_SIZE, projectThumbnail } from '../render/thumbnail';
import type { ProjectLibrary } from '../storage';
import type { ProjectPreviewer } from '../ui/components/home/context';

export function createProjectPreviewer(library: ProjectLibrary, images: AssetImages): ProjectPreviewer & { destroy(): void } {
  let stopCurrent: (() => void) | null = null;
  /** Dernier projet chargé : survoler deux fois la même carte ne le relit pas. */
  let cached: { id: string; project: Promise<Project> } | null = null;

  const load = (id: string): Promise<Project> => {
    if (cached?.id !== id) cached = { id, project: library.load(id) };
    return cached.project;
  };

  /** Calque de dessin décodé, seulement si le décor en a un. */
  async function drawingOf(project: Project): Promise<{ surface: DrawingSurface; image: DrawingImage } | null> {
    if (Object.keys(project.environment.drawing.tiles).length === 0) return null;
    const surface = createDrawingSurface();
    await surface.sync(project.environment.drawing.tiles);
    return { surface, image: { image: surface.canvas, bounds: surface.bounds } };
  }

  /** Arrière-plan composé à la taille d'une carte (v2.1), s'il y en a un. */
  async function backdropOf(project: Project): Promise<DrawingImage | null> {
    const surface = createBackgroundSurface(images, PROJECT_THUMBNAIL_SIZE * 2);
    await surface.sync(project.environment.background, project.format);
    return surface.image();
  }

  return {
    play(projectId, canvas) {
      stopCurrent?.();
      let stopped = false;
      let request = 0;
      const stop = (): void => {
        stopped = true;
        cancelAnimationFrame(request);
        if (stopCurrent === stop) stopCurrent = null;
      };
      stopCurrent = stop;

      void (async () => {
        const project = await load(projectId);
        const [drawing, backdrop] = await Promise.all([drawingOf(project), backdropOf(project)]);
        if (stopped) return;
        const sequence = deriveSequence(project);
        const step = frameDuration(project.fps, 1);
        canvas.width = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
        canvas.height = Math.round(canvas.clientHeight * (window.devicePixelRatio || 1));
        const start = performance.now();
        const tick = (now: number): void => {
          if (stopped) return;
          const frame = sequence[Math.floor((now - start) / step) % sequence.length];
          if (frame) paintProjectFrame(canvas, project, frame, drawing?.image ?? null, backdrop);
          request = requestAnimationFrame(tick);
        };
        request = requestAnimationFrame(tick);
      })().catch((error: unknown) => console.warn('[home] Aperçu indisponible :', error));
      return stop;
    },

    async thumbnail(projectId) {
      const project = await load(projectId);
      const [drawing, backdrop] = await Promise.all([drawingOf(project), backdropOf(project)]);
      const thumbnail = projectThumbnail(project, drawing?.image ?? null, backdrop);
      if (thumbnail) await library.setThumbnail(projectId, thumbnail);
      return thumbnail;
    },

    destroy() {
      stopCurrent?.();
      cached = null;
    },
  };
}
