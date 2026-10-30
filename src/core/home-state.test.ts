import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT, presetFormat } from './formats';
import {
  createHomeState,
  DEFAULT_PREFERENCES,
  floatingButtonTucked,
  matchesQuery,
  normalizePreferences,
  RECENT_PROJECTS,
  shownProjects,
  sortProjects,
  isVideoType,
  storageNearlyFull,
  videosToPrune,
  type VideoSummary,
} from './home-state';
import type { ProjectSummary } from './types';

const summary = (id: string, name: string, createdAt: number, updatedAt: number): ProjectSummary => ({
  id,
  name,
  format: DEFAULT_FORMAT,
  fps: 12,
  frameCount: 5,
  createdAt,
  updatedAt,
  thumbnail: null,
});

const projects = [
  summary('a', 'Saut', 1, 30),
  summary('b', 'Élan', 3, 10),
  summary('c', 'course', 2, 20),
];

describe('sortProjects', () => {
  it('sorts by modification date, creation date or name', () => {
    expect(sortProjects(projects, 'modified').map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(sortProjects(projects, 'created').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    // Ordre alphabétique français : sans tenir compte des accents ni de la casse.
    expect(sortProjects(projects, 'az').map((p) => p.name)).toEqual(['course', 'Élan', 'Saut']);
    expect(sortProjects(projects, 'za').map((p) => p.name)).toEqual(['Saut', 'Élan', 'course']);
  });

  it('never changes the list it is given', () => {
    const copy = [...projects];
    sortProjects(projects, 'az');
    expect(projects).toEqual(copy);
  });
});

describe('matchesQuery', () => {
  it('finds a name by any part of it, ignoring case and accents', () => {
    expect(matchesQuery('Élan de course', 'elan')).toBe(true);
    expect(matchesQuery('Élan de course', '  COURSE ')).toBe(true);
    expect(matchesQuery('Saut', 'course')).toBe(false);
    expect(matchesQuery('Saut', '')).toBe(true);
  });
});

describe('shownProjects', () => {
  it('filters by the search, sorts, and keeps only the most recent ones on the home page', () => {
    const many = Array.from({ length: 12 }, (_, i) => summary(`p${i}`, `Projet ${i}`, i, i));
    expect(shownProjects(many, { query: '', sort: 'modified', limit: RECENT_PROJECTS })).toHaveLength(8);
    expect(shownProjects(many, { query: '', sort: 'modified', limit: RECENT_PROJECTS })[0]?.id).toBe('p11');
    expect(shownProjects(many, { query: '1', sort: 'az' }).map((p) => p.name)).toEqual(['Projet 1', 'Projet 10', 'Projet 11']);
  });
});

describe('normalizePreferences', () => {
  it('starts from the defaults', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences('n’importe quoi')).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ sort: 'modified', view: 'grid', theme: 'auto', defaultFormat: DEFAULT_FORMAT, defaultFps: 12 });
  });

  it('keeps the valid choices and replaces the others', () => {
    expect(
      normalizePreferences({ sort: 'za', view: 'list', theme: 'neon', defaultFormat: { preset: 'square', width: 1, height: 1 }, defaultFps: 500 }),
    ).toEqual({ sort: 'za', view: 'list', theme: 'auto', defaultFormat: presetFormat('square'), defaultFps: 60 });
  });
});

describe('stockage des vidéos', () => {
  const video = (id: string, createdAt: number, size: number): VideoSummary => ({
    id,
    projectId: null,
    projectName: id,
    type: 'mp4',
    duration: 1,
    size,
    createdAt,
    thumbnail: null,
  });

  it('says when the storage is nearly full', () => {
    expect(storageNearlyFull({ usage: 850, quota: 1000 })).toBe(true);
    expect(storageNearlyFull({ usage: 500, quota: 1000 })).toBe(false);
    expect(storageNearlyFull(null)).toBe(false);
  });

  it('picks the oldest videos to delete until enough room is free', () => {
    const videos = [video('new', 3, 100), video('old', 1, 100), video('mid', 2, 100)];
    // 900 / 1000 utilisés : il faut libérer 200 pour revenir à 70 %.
    expect(videosToPrune(videos, { usage: 900, quota: 1000 })).toEqual(['old', 'mid']);
    expect(videosToPrune(videos, { usage: 500, quota: 1000 })).toEqual([]);
  });

  it('recognises the files kept in « Mes vidéos »', () => {
    expect(['mp4', 'webm', 'gif', 'zip'].filter(isVideoType)).toEqual(['mp4', 'webm', 'gif']);
  });
});

describe('floatingButtonTucked', () => {
  // Sur ordinateur, le bouton « + » se cache tant que la bannière (et ses raccourcis) est à l'écran.
  it('tucks the button away while the home banner is on screen', () => {
    const home = createHomeState('home', DEFAULT_PREFERENCES);
    expect(home.heroVisible).toBe(true);
    expect(floatingButtonTucked(home)).toBe(true);
    expect(floatingButtonTucked({ ...home, heroVisible: false })).toBe(false);
  });

  it('shows the button in the sections without a banner', () => {
    const projects = createHomeState('projects', DEFAULT_PREFERENCES);
    expect(floatingButtonTucked(projects)).toBe(false);
    expect(floatingButtonTucked({ ...projects, heroVisible: true })).toBe(false);
  });
});
