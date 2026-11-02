// Transfert de projets (v2.2) : rassembler des projets enregistrés et leurs images pour une archive
// « .stickflow », et réintégrer une archive dans la bibliothèque. Sans DOM ni format de fichier :
// l'archive elle-même est écrite et relue par `project-archive.ts`.

import type { Project, ProjectSummary } from '../core/types';
import { uniqueName } from '../model/new-project';
import { backgroundAssetIds } from '../model/background';
import type { Asset, AssetStore } from './asset-store';
import type { ProjectLibrary } from './library';
import type { ArchivedProject, ProjectArchive } from './project-archive';

export interface TransferStores {
  library: ProjectLibrary;
  assets: Pick<AssetStore, 'get' | 'add'>;
}

/** Les projets demandés (avec leurs dates) et chaque image qu'ils utilisent, une seule fois. */
export async function collectProjects(ids: readonly string[], { library, assets }: TransferStores): Promise<{ projects: ArchivedProject[]; assets: Asset[] }> {
  const summaries = new Map((await library.list()).map((summary) => [summary.id, summary]));
  const projects: ArchivedProject[] = [];
  const images = new Map<string, Asset>();
  for (const id of ids) {
    const project = await library.load(id);
    const summary = summaries.get(id);
    projects.push({ id, name: project.name, createdAt: summary?.createdAt ?? 0, updatedAt: summary?.updatedAt ?? 0, project });
    for (const assetId of backgroundAssetIds(project)) {
      if (images.has(assetId)) continue;
      // Une image disparue du magasin n'empêche pas l'export : le projet garde son arrière-plan vide.
      const asset = await assets.get(assetId);
      if (asset) images.set(assetId, asset);
    }
  }
  return { projects, assets: [...images.values()] };
}

/**
 * Ajoute les projets d'une archive à la bibliothèque. Un projet garde son id et ses dates, sauf s'il
 * existe déjà : il devient alors une copie (nouvel id, nom libre suivant). Une image déjà présente
 * (même id) est réutilisée ; les autres rejoignent le magasin, et l'arrière-plan suit leur nouvel id.
 */
export async function importProjects(
  archive: ProjectArchive,
  { library, assets, thumbnail }: TransferStores & { thumbnail?: (project: Project) => string | null },
): Promise<ProjectSummary[]> {
  const assetIds = new Map<string, string>();
  for (const asset of archive.assets) {
    if (await assets.get(asset.id)) {
      assetIds.set(asset.id, asset.id);
      continue;
    }
    const { id, ...image } = asset;
    assetIds.set(id, (await assets.add(image, { id })).id);
  }

  const existing = await library.list();
  const takenIds = new Set(existing.map((summary) => summary.id));
  const takenNames = existing.map((summary) => summary.name);
  const imported: ProjectSummary[] = [];
  for (const { id, name, createdAt, updatedAt, project: original } of archive.projects) {
    const copy = takenIds.has(id);
    const project = withAssetIds({ ...original, name: copy ? uniqueName(name, takenNames) : name }, assetIds);
    const summary = await library.save(project, copy ? undefined : id, { thumbnail: thumbnail?.(project) ?? null, dates: { createdAt, updatedAt } });
    takenIds.add(summary.id);
    takenNames.push(summary.name);
    imported.push(summary);
  }
  return imported;
}

/** L'arrière-plan image suit le nouvel id de son image (inchangé si l'image n'était pas dans l'archive). */
function withAssetIds(project: Project, assetIds: ReadonlyMap<string, string>): Project {
  const { background } = project.environment;
  if (background?.type !== 'image') return project;
  const assetId = assetIds.get(background.assetId) ?? background.assetId;
  return { ...project, environment: { ...project.environment, background: { ...background, assetId } } };
}
