import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT, presetFormat } from './formats';
import {
  DEFAULT_PREFERENCES,
  matchesQuery,
  normalizePreferences,
  RECENT_PROJECTS,
  shownProjects,
  sortProjects,
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
