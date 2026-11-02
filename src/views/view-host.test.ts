import { describe, expect, it } from 'vitest';

import type { Route } from '../core/router';
import { createViewHost, type View } from './view-host';

const parent = {} as HTMLElement;

/** Vue factice qui journalise son cycle de vie. */
function setup({ slowLeave = false } = {}) {
  const log: string[] = [];
  // Sortie lente : elle se termine quand le test la libère (avant ou après son début).
  let releaseLeave: () => void = () => undefined;
  const released = new Promise<void>((resolve) => (releaseLeave = resolve));
  const create = (route: Route): View => {
    const name = route.name === 'editor' ? `editor:${route.projectId}` : 'home';
    return {
      mount: () => log.push(`mount ${name}`),
      destroy: () => log.push(`destroy ${name}`),
      // L'accueil affiche toutes ses sections lui-même ; l'éditeur ne garde que son projet.
      update: (next) =>
        route.name === 'editor' ? next.name === 'editor' && next.projectId === route.projectId : next.name !== 'editor',
      leave: async () => {
        log.push(`leave ${name}`);
        if (slowLeave) await released;
      },
    };
  };
  const host = createViewHost(parent, create);
  return { host, log, releaseLeave: () => releaseLeave() };
}

describe('createViewHost', () => {
  it('mounts the view of the first route', async () => {
    const { host, log } = setup();
    await host.show({ name: 'home' });
    expect(log).toEqual(['mount home']);
  });

  it('keeps the same view when it can show the new route itself', async () => {
    const { host, log } = setup();
    await host.show({ name: 'home' });
    await host.show({ name: 'projects' });
    expect(log).toEqual(['mount home']);
  });

  it('lets the old view finish leaving (auto-save) before destroying it and mounting the next one', async () => {
    const { host, log } = setup();
    await host.show({ name: 'editor', projectId: 'p1' });
    await host.show({ name: 'home' });
    expect(log).toEqual(['mount editor:p1', 'leave editor:p1', 'destroy editor:p1', 'mount home']);
  });

  it('handles route changes one after the other, the last one winning', async () => {
    const { host, log, releaseLeave } = setup({ slowLeave: true });
    await host.show({ name: 'editor', projectId: 'p1' });
    const toHome = host.show({ name: 'home' });
    const toOther = host.show({ name: 'editor', projectId: 'p2' });
    releaseLeave();
    await toHome;
    await toOther;
    expect(log).toEqual(['mount editor:p1', 'leave editor:p1', 'destroy editor:p1', 'mount editor:p2']);
  });

  it('waits for a view loaded on demand, and drops it if a newer route arrived meanwhile', async () => {
    const log: string[] = [];
    let release: () => void = () => undefined;
    const loaded = new Promise<void>((resolve) => (release = resolve));
    const host = createViewHost(parent, async (route) => {
      const name = route.name === 'editor' ? 'editor' : 'home';
      if (name === 'editor') await loaded;
      return { mount: () => log.push(`mount ${name}`), destroy: () => log.push(`destroy ${name}`) };
    });
    const toEditor = host.show({ name: 'editor', projectId: 'p1' });
    const toHome = host.show({ name: 'home' });
    release();
    await toEditor;
    await toHome;
    expect(log).toEqual(['mount home']);
  });

  it('saves the work of the shown view without leaving it (before a reload)', async () => {
    const { host, log } = setup();
    await host.save();
    await host.show({ name: 'editor', projectId: 'p1' });
    await host.save();
    expect(log).toEqual(['mount editor:p1', 'leave editor:p1']);
  });
});
