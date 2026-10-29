import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './memory-store';
import { createVideoLibrary } from './video-store';

function setup() {
  let now = 1000;
  let id = 0;
  const videos = createVideoLibrary(createMemoryStore(), { now: () => now, newId: () => `v${++id}` });
  return { videos, later: () => (now += 1000) };
}

const video = (projectName: string, bytes = 10) => ({
  projectId: 'p1',
  projectName,
  type: 'mp4' as const,
  blob: new Blob([new Uint8Array(bytes)], { type: 'video/mp4' }),
  duration: 2.5,
  thumbnail: 'data:t',
});

describe('createVideoLibrary', () => {
  it('keeps an exported video and lists its summary, without the file', async () => {
    const { videos } = setup();
    const summary = await videos.add(video('Saut', 42));
    expect(summary).toEqual({ id: 'v1', projectId: 'p1', projectName: 'Saut', type: 'mp4', duration: 2.5, size: 42, createdAt: 1000, thumbnail: 'data:t' });
    expect(await videos.list()).toEqual([summary]);
  });

  it('gives back the file of a video', async () => {
    const { videos } = setup();
    const { id } = await videos.add(video('Saut', 7));
    expect((await videos.file(id)).size).toBe(7);
    await expect(videos.file('ghost')).rejects.toThrow();
  });

  it('lists the most recent first', async () => {
    const { videos, later } = setup();
    await videos.add(video('Ancienne'));
    later();
    await videos.add(video('Récente'));
    expect((await videos.list()).map((v) => v.projectName)).toEqual(['Récente', 'Ancienne']);
  });

  it('removes one video, several, or all of them', async () => {
    const { videos } = setup();
    for (const name of ['a', 'b', 'c', 'd']) await videos.add(video(name));
    await videos.remove('v1');
    await videos.removeMany(['v2', 'v3']);
    expect((await videos.list()).map((v) => v.id)).toEqual(['v4']);
    await videos.clear();
    expect(await videos.list()).toEqual([]);
  });
});
