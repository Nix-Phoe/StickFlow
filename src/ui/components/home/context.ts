// Dépendances injectées dans les composants de l'accueil : ils émettent sur le bus, lisent le store
// de l'accueil, et demandent les rendus (aperçu animé, vignette manquante) au lecteur d'aperçus.

import type { AppEventBus } from '../../../core/events';
import type { HomeState } from '../../../core/home-state';
import type { Store } from '../../../core/store';
import type { Project } from '../../../core/types';

export interface ProjectPreviewer {
  /** Joue l'animation du projet dans `canvas` jusqu'à l'arrêt (une seule à la fois). */
  play(projectId: string, canvas: HTMLCanvasElement): () => void;
  /** Génère et enregistre la vignette d'un projet qui n'en a pas encore (projets de la v1.0). */
  thumbnail(projectId: string): Promise<string | null>;
}

export interface TemplateCatalog {
  load(templateId: string): Project | null;
  /** Vignette (première frame) d'un modèle, en PNG (data URL). */
  thumbnail(templateId: string): string | null;
}

export interface HomeContext {
  bus: AppEventBus;
  store: Store<HomeState>;
  preview: ProjectPreviewer;
  templates: TemplateCatalog;
  /** Fichier d'une vidéo conservée (lecteur). */
  videoFile(videoId: string): Promise<Blob>;
}
