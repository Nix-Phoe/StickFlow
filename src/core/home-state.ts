// État de l'accueil : projets et vidéos enregistrés, recherche, préférences mémorisées, feuilles
// ouvertes. Fonctions pures de tri, de filtre et de validation des préférences.

import { DEFAULT_FORMAT, normalizeFormat, type VideoFormat } from './formats';
import type { HomeSection } from './router';
import { clamp, LIMITS, type ProjectSummary } from './types';

export type ProjectSort = 'modified' | 'created' | 'az' | 'za';
export type ProjectView = 'grid' | 'list';
export type ThemePreference = 'auto' | 'light' | 'dark';

export const PROJECT_SORTS: readonly ProjectSort[] = ['modified', 'created', 'az', 'za'];
export const PROJECT_VIEWS: readonly ProjectView[] = ['grid', 'list'];
export const THEMES: readonly ThemePreference[] = ['auto', 'light', 'dark'];

/** Nombre de projets montrés sur la page d'accueil (« Voir tout » mène aux autres). */
export const RECENT_PROJECTS = 8;

/** Choix mémorisés d'une visite à l'autre (préférences de l'appareil, hors projets). */
export interface Preferences {
  sort: ProjectSort;
  view: ProjectView;
  theme: ThemePreference;
  /** Format et IPS proposés pour un nouveau projet. */
  defaultFormat: VideoFormat;
  defaultFps: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  sort: 'modified',
  view: 'grid',
  theme: 'auto',
  defaultFormat: DEFAULT_FORMAT,
  defaultFps: 12,
};

/** Vidéo exportée conservée dans l'app (sans son contenu, lu à la demande). */
export interface VideoSummary {
  id: string;
  projectId: string | null;
  projectName: string;
  type: VideoFileType;
  /** Durée, en secondes. */
  duration: number;
  /** Taille du fichier, en octets. */
  size: number;
  createdAt: number;
  thumbnail: string | null;
}

export type VideoFileType = 'mp4' | 'webm' | 'gif';

/** Feuille ouverte par-dessus l'accueil. */
export type HomeSheet =
  | { kind: 'create'; templateId: string | null }
  | { kind: 'export'; projectId: string }
  | { kind: 'settings' }
  | { kind: 'video'; videoId: string };

export type HomeNoticeCode = 'duplicated' | 'deleted' | 'exported' | 'export-failed' | 'action-failed' | 'video-deleted' | 'videos-cleared';

/** Message bref après une action (affiché, puis effacé). */
export interface HomeNotice {
  kind: 'success' | 'error';
  code: HomeNoticeCode;
  /** Détail technique (message d'erreur, nom de fichier exporté). */
  detail?: string;
}

export interface HomeState {
  section: HomeSection;
  /** `null` pendant le chargement. */
  projects: ProjectSummary[] | null;
  videos: VideoSummary[] | null;
  query: string;
  preferences: Preferences;
  sheet: HomeSheet | null;
  /** Export lancé depuis une carte de projet. */
  exporting: { projectId: string; progress: number } | null;
  /** Espace utilisé et disponible pour l'app, en octets (`navigator.storage.estimate()`). */
  storage: { usage: number; quota: number } | null;
  notice: HomeNotice | null;
}

export function createHomeState(section: HomeSection, preferences: Preferences): HomeState {
  return { section, projects: null, videos: null, query: '', preferences, sheet: null, exporting: null, storage: null, notice: null };
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function sortProjects(projects: readonly ProjectSummary[], sort: ProjectSort): ProjectSummary[] {
  const sorted = [...projects];
  switch (sort) {
    case 'modified':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'created':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'az':
      return sorted.sort((a, b) => collator.compare(a.name, b.name));
    case 'za':
      return sorted.sort((a, b) => collator.compare(b.name, a.name));
  }
}

const simplify = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Le nom contient-il la recherche (sans tenir compte de la casse ni des accents) ? */
export function matchesQuery(name: string, query: string): boolean {
  return simplify(name).includes(simplify(query));
}

/** Projets affichés : filtrés par la recherche, triés, puis limités (accueil). */
export function shownProjects(
  projects: readonly ProjectSummary[],
  { query, sort, limit }: { query: string; sort: ProjectSort; limit?: number },
): ProjectSummary[] {
  const sorted = sortProjects(
    projects.filter((p) => matchesQuery(p.name, query)),
    sort,
  );
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/** Préférences relues (stockage local) : les valeurs inconnues reprennent leur valeur par défaut. */
export function normalizePreferences(value: unknown): Preferences {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const pick = <T extends string>(options: readonly T[], candidate: unknown, fallback: T): T =>
    options.includes(candidate as T) ? (candidate as T) : fallback;
  const format = raw.defaultFormat as { preset?: unknown; width?: unknown; height?: unknown } | undefined;
  const defaultFormat =
    format && typeof format.preset === 'string' && typeof format.width === 'number' && typeof format.height === 'number'
      ? normalizeFormat({ preset: format.preset, width: format.width, height: format.height })
      : DEFAULT_PREFERENCES.defaultFormat;
  return {
    sort: pick(PROJECT_SORTS, raw.sort, DEFAULT_PREFERENCES.sort),
    view: pick(PROJECT_VIEWS, raw.view, DEFAULT_PREFERENCES.view),
    theme: pick(THEMES, raw.theme, DEFAULT_PREFERENCES.theme),
    defaultFormat,
    defaultFps:
      typeof raw.defaultFps === 'number' && Number.isFinite(raw.defaultFps)
        ? clamp(Math.round(raw.defaultFps), LIMITS.fps.min, LIMITS.fps.max)
        : DEFAULT_PREFERENCES.defaultFps,
  };
}
