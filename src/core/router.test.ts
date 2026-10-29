import { describe, expect, it } from 'vitest';

import { createRouter, parseRoute, routeToHash, type HashPort, type Route } from './router';

/** Faux `location.hash` : `push` ajoute une entrée d'historique, `back` y revient, comme le navigateur. */
function fakeLocation(initial = '') {
  const entries = [initial];
  let index = 0;
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());
  const port: HashPort = {
    read: () => entries[index] ?? '',
    push: (hash) => {
      if (hash === entries[index]) return;
      entries.splice(index + 1, Infinity, hash);
      index += 1;
      notify();
    },
    replace: (hash) => {
      entries[index] = hash;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    port,
    entries,
    back: () => {
      index = Math.max(0, index - 1);
      notify();
    },
  };
}

describe('parseRoute', () => {
  it('reads the home page and its sections', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/projects')).toEqual({ name: 'projects' });
    expect(parseRoute('#/templates')).toEqual({ name: 'templates' });
    expect(parseRoute('#/videos')).toEqual({ name: 'videos' });
  });

  it('reads the editor of a project', () => {
    expect(parseRoute('#/editor/abc-123')).toEqual({ name: 'editor', projectId: 'abc-123' });
    expect(parseRoute('#/editor/caf%C3%A9')).toEqual({ name: 'editor', projectId: 'café' });
  });

  it('falls back to the home page for anything else', () => {
    expect(parseRoute('#/editor/')).toEqual({ name: 'home' });
    expect(parseRoute('#/nowhere')).toEqual({ name: 'home' });
    expect(parseRoute('#/editor/%E0%A4%A')).toEqual({ name: 'home' });
  });
});

describe('routeToHash', () => {
  it('is the inverse of parseRoute', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'projects' },
      { name: 'templates' },
      { name: 'videos' },
      { name: 'editor', projectId: 'p 1/é' },
    ];
    for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
    expect(routeToHash({ name: 'home' })).toBe('#/');
  });
});

describe('createRouter', () => {
  it('announces the current route when it starts', () => {
    const { port } = fakeLocation('#/videos');
    const seen: Route[] = [];
    createRouter(port, (route) => seen.push(route)).start();
    expect(seen).toEqual([{ name: 'videos' }]);
  });

  it('navigates by adding a history entry, so that « back » returns', () => {
    const location = fakeLocation('#/');
    const seen: Route[] = [];
    const router = createRouter(location.port, (route) => seen.push(route));
    router.start();
    router.navigate({ name: 'editor', projectId: 'p1' });
    expect(router.current()).toEqual({ name: 'editor', projectId: 'p1' });
    location.back();
    expect(seen).toEqual([{ name: 'home' }, { name: 'editor', projectId: 'p1' }, { name: 'home' }]);
  });

  it('can replace the current entry without announcing it again', () => {
    const location = fakeLocation('#/editor/p1');
    const seen: Route[] = [];
    const router = createRouter(location.port, (route) => seen.push(route));
    router.start();
    router.navigate({ name: 'editor', projectId: 'p2' }, { replace: true });
    expect(location.entries).toEqual(['#/editor/p2']);
    expect(router.current()).toEqual({ name: 'editor', projectId: 'p2' });
    expect(seen).toHaveLength(1);
  });

  it('stops listening once stopped', () => {
    const location = fakeLocation('#/');
    const seen: Route[] = [];
    const stop = createRouter(location.port, (route) => seen.push(route)).start();
    stop();
    location.port.push('#/projects');
    expect(seen).toHaveLength(1);
  });
});
