import { describe, expect, it } from 'vitest';

import { DEFAULT_FORMAT } from '../core/formats';
import { createHistory } from '../model/project';
import { deriveSequence } from '../model/sequence';
import { loadTemplate, TEMPLATE_IDS } from '.';

describe('templates (projets de départ)', () => {
  it('offers the six starting projects, in order', () => {
    expect(TEMPLATE_IDS).toEqual(['walk', 'run', 'jump', 'punch', 'wave', 'blank']);
  });

  it('are all valid project files, in 16:9 with one character', () => {
    for (const id of TEMPLATE_IDS) {
      const project = loadTemplate(id);
      expect(project, id).not.toBeNull();
      if (!project) continue;
      expect(project.format, id).toEqual(DEFAULT_FORMAT);
      expect(project.characters, id).toHaveLength(1);
      // Déjà dans les bornes du module Projet : l'ouvrir ne change rien.
      expect(createHistory(project).present, id).toEqual(project);
    }
  });

  it('move: several keyframes, the cyclic ones looping', () => {
    for (const id of ['walk', 'run', 'punch', 'wave'] as const) {
      const project = loadTemplate(id);
      expect(project?.keyframes.length, id).toBeGreaterThanOrEqual(3);
      expect(project?.ai.loop.enabled, id).toBe(true);
    }
    expect(loadTemplate('jump')?.keyframes.length).toBeGreaterThanOrEqual(4);
    expect(loadTemplate('jump')?.ai.loop.enabled).toBe(false);
    expect(loadTemplate('blank')?.keyframes).toHaveLength(1);
  });

  it('every pose changes something between consecutive keyframes', () => {
    for (const id of TEMPLATE_IDS.filter((t) => t !== 'blank')) {
      const project = loadTemplate(id);
      if (!project) continue;
      const poses = deriveSequence(project).map((f) => JSON.stringify(f.poses));
      poses.slice(1).forEach((p, i) => expect(p, `${id} #${i + 1}`).not.toBe(poses[i]));
    }
  });

  it('gives a fresh copy each time, and nothing for an unknown template', () => {
    const first = loadTemplate('walk');
    if (first) first.name = 'Modifié';
    expect(loadTemplate('walk')?.name).not.toBe('Modifié');
    expect(loadTemplate('moonwalk')).toBeNull();
  });
});
