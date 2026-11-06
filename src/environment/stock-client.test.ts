import { describe, expect, it } from 'vitest';

import { createStockClient, StockError } from './stock-client';

const BASE = 'https://images.example.workers.dev';
const PHOTO = {
  id: 1,
  width: 4000,
  height: 3000,
  alt: 'Forêt au matin',
  color: '#335533',
  thumbnail: 'https://images.pexels.com/photos/1/a.jpeg?h=350',
  image: 'https://images.pexels.com/photos/1/a.jpeg?w=1920',
  author: 'Ana',
  authorUrl: 'https://www.pexels.com/@ana',
  url: 'https://www.pexels.com/photo/1/',
};

/** Faux `fetch` : note les adresses demandées et rend la réponse donnée. */
function fakeFetch(respond: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    urls.push(String(input));
    return respond(String(input));
  };
  return { fetch: fetch as typeof globalThis.fetch, urls };
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createStockClient', () => {
  it('searches through the proxy and reads the photos with their credit', async () => {
    const { fetch, urls } = fakeFetch(() => json({ photos: [PHOTO, { broken: true }], page: 2, hasMore: true }));
    const client = createStockClient({ baseUrl: `${BASE}/`, fetch, online: () => true });
    const result = await client.search('forêt la nuit', 2);
    expect(urls).toEqual([`${BASE}/search?query=for%C3%AAt+la+nuit&page=2&per_page=24`]);
    expect(result).toEqual({
      hasMore: true,
      photos: [{ ...PHOTO, id: '1', provider: 'Pexels' }],
    });
  });

  it('says so when the proxy is not configured, or the device is offline', async () => {
    const { fetch, urls } = fakeFetch(() => json({}));
    await expect(createStockClient({ baseUrl: null, fetch, online: () => true }).search('a', 1)).rejects.toMatchObject({ code: 'unconfigured' });
    await expect(createStockClient({ baseUrl: BASE, fetch, online: () => false }).search('a', 1)).rejects.toMatchObject({ code: 'offline' });
    expect(urls).toEqual([]);
    expect(createStockClient({ baseUrl: '', fetch, online: () => true }).configured).toBe(false);
  });

  it('offers the photo search only when it is switched on, and always the import by address', async () => {
    const { fetch, urls } = fakeFetch(() => new Response(new Blob(['img'], { type: 'image/png' })));
    const client = createStockClient({ baseUrl: BASE, searchEnabled: false, fetch, online: () => true });
    expect(client.searchEnabled).toBe(false);
    await expect(client.search('mer', 1)).rejects.toMatchObject({ code: 'unconfigured' });
    expect(urls).toEqual([]);
    expect((await client.download('https://example.com/a.png')).type).toBe('image/png');
    expect(createStockClient({ baseUrl: BASE, fetch, online: () => true }).searchEnabled).toBe(true);
  });

  it('turns network and server failures into clear errors', async () => {
    const failing = (status: number) => createStockClient({ baseUrl: BASE, fetch: fakeFetch(() => json({}, status)).fetch, online: () => true });
    await expect(failing(429).search('a', 1)).rejects.toMatchObject({ code: 'rate-limited' });
    await expect(failing(500).search('a', 1)).rejects.toMatchObject({ code: 'failed' });
    await expect(failing(503).search('a', 1)).rejects.toMatchObject({ code: 'unconfigured' });
    // Le proxy refuse un SVG ou un type inconnu (415), et une image de plus de 20 Mo (413).
    await expect(failing(415).download('https://example.com/a.svg')).rejects.toMatchObject({ code: 'unsupported' });
    await expect(failing(413).download('https://example.com/big.png')).rejects.toMatchObject({ code: 'too-large' });
    const down = createStockClient({ baseUrl: BASE, fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch, online: () => true });
    await expect(down.search('a', 1)).rejects.toBeInstanceOf(StockError);
  });

  it('downloads an image through the proxy (CORS allowed, usable by WebGL and the export)', async () => {
    const { fetch, urls } = fakeFetch(() => new Response(new Blob(['img'], { type: 'image/jpeg' })));
    const client = createStockClient({ baseUrl: BASE, fetch, online: () => true });
    const blob = await client.download('https://example.com/a b.jpg');
    expect(urls).toEqual([`${BASE}/image?url=${encodeURIComponent('https://example.com/a b.jpg')}`]);
    expect(blob.type).toBe('image/jpeg');
  });

  it('refuses an address that is not a web address', async () => {
    const { fetch, urls } = fakeFetch(() => json({}));
    const client = createStockClient({ baseUrl: BASE, fetch, online: () => true });
    await expect(client.download('javascript:alert(1)')).rejects.toMatchObject({ code: 'invalid-url' });
    await expect(client.download('pas une adresse')).rejects.toMatchObject({ code: 'invalid-url' });
    expect(urls).toEqual([]);
  });
});
