// Modèles de départ : des fichiers de projet JSON (même format que les projets enregistrés).
// Un nouveau projet en est une copie ; le modèle lui-même n'est jamais modifié.

import type { Project } from '../core/types';
import { fromProjectFile } from '../storage/project-file';
import blank from './blank.json';
import jump from './jump.json';
import punch from './punch.json';
import run from './run.json';
import walk from './walk.json';
import wave from './wave.json';

export type TemplateId = 'walk' | 'run' | 'jump' | 'punch' | 'wave' | 'blank';

/** Dans l'ordre du carrousel « Commencer avec un modèle ». */
export const TEMPLATE_IDS: readonly TemplateId[] = ['walk', 'run', 'jump', 'punch', 'wave', 'blank'];

const FILES: Record<TemplateId, unknown> = { walk, run, jump, punch, wave, blank };

export function isTemplateId(id: string): id is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(id);
}

/** Copie du modèle (lue et vérifiée comme un fichier de projet) ; `null` pour un modèle inconnu. */
export function loadTemplate(id: string): Project | null {
  return isTemplateId(id) ? fromProjectFile(structuredClone(FILES[id])) : null;
}
