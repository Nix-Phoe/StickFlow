import { describe, expect, it } from 'vitest';

import { handleRequest, isPublicHost, type Env } from './index';

const ENV: Env = { PEXELS_API_KEY: 'secret-key', ALLOWED_ORIGINS: 'http://localhost:5173,https://stickflow.pages.dev' };
const ORIGIN = 'http://localhost:5173';

const PEXELS_PAGE = {
  page: 1,
  per_page: 24,
  total_results: 300,
  next_page: 'https://api.pexels.com/v1/search?page=2',
  photos: [
    {
      id: 7,
      width: 4000,
      height: 3000,
      url: 'https://www.pexels.com/photo/foret-7/',
      photographer: 'Ana',
      photographer_url: 'https://www.pexels.com/@ana',
      avg_color: '#335533',
      alt: 'Forêt au matin',
      src: { original: 'o', large2x: 'https://images.pexels.com/7-l2x.jpeg', large: 'l', medium: 'https://images.pexels.com/7-m.jpeg', small: 's', tiny: 't' },
    },
  ],
};

/** Faux `fetch` sortant : note les requêtes et rend la réponse donnée. */
function upstream(respond: (request: Request) => Response) {
  const requests: Request[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request);
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

const get = (path: string, origin = ORIGIN): Request => new Request(`https://proxy.example.dev${path}`, { headers: { Origin: origin } });

describe('image proxy: search', () => {
  it('asks Pexels with the secret key, and returns only what the app needs, with CORS', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    const response = await handleRequest(get('/search?query=for%C3%AAt&page=1&per_page=24'), ENV, fetch);
    expect(requests[0]?.url).toBe('https://api.pexels.com/v1/search?query=for%C3%AAt&page=1&per_page=24');
    expect(requests[0]?.headers.get('Authorization')).toBe('secret-key');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      page: 1,
      hasMore: true,
      photos: [
        {
          id: 7,
          width: 4000,
          height: 3000,
          alt: 'Forêt au matin',
          color: '#335533',
          thumbnail: 'https://images.pexels.com/7-m.jpeg',
          image: 'https://images.pexels.com/7-l2x.jpeg',
          author: 'Ana',
          authorUrl: 'https://www.pexels.com/@ana',
          url: 'https://www.pexels.com/photo/foret-7/',
        },
      ],
    });
    // La clé ne sort jamais du proxy.
    expect(JSON.stringify(body)).not.toContain('secret-key');
  });

  it('limits the page size, and refuses an empty search', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    await handleRequest(get('/search?query=mer&per_page=500'), ENV, fetch);
    expect(new URL(requests[0]?.url ?? '').searchParams.get('per_page')).toBe('80');
    expect((await handleRequest(get('/search?query=%20'), ENV, fetch)).status).toBe(400);
  });

  it('answers 503 without an API key, and passes on the rate limit', async () => {
    const { fetch } = upstream(() => new Response('', { status: 429 }));
    expect((await handleRequest(get('/search?query=mer'), { ...ENV, PEXELS_API_KEY: '' }, fetch)).status).toBe(503);
    expect((await handleRequest(get('/search?query=mer'), ENV, fetch)).status).toBe(429);
  });
});

describe('image proxy: image', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  it('fetches a public image and returns it with CORS (usable by WebGL)', async () => {
    const { fetch } = upstream(() => new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    const response = await handleRequest(get(`/image?url=${encodeURIComponent('https://example.com/chat.png')}`), ENV, fetch);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });

  it('refuses SVG, non-images, files over 20 MB, and private or non-web addresses', async () => {
    const svg = upstream(() => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    expect((await handleRequest(get(`/image?url=${encodeURIComponent('https://example.com/a.svg')}`), ENV, svg.fetch)).status).toBe(415);
    const html = upstream(() => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
    expect((await handleRequest(get(`/image?url=${encodeURIComponent('https://example.com/')}`), ENV, html.fetch)).status).toBe(415);
    const huge = upstream(() => new Response(png, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(21 * 1024 * 1024) } }));
    expect((await handleRequest(get(`/image?url=${encodeURIComponent('https://example.com/big.png')}`), ENV, huge.fetch)).status).toBe(413);
    const never = upstream(() => new Response(png));
    for (const url of ['file:///etc/passwd', 'http://localhost/a.png', 'http://192.168.1.2/a.png', 'nope']) {
      expect((await handleRequest(get(`/image?url=${encodeURIComponent(url)}`), ENV, never.fetch)).status).toBe(400);
    }
    expect(never.requests).toEqual([]);
  });
});

describe('image proxy: CORS', () => {
  it('answers the preflight of an allowed origin, and refuses other sites', async () => {
    const { fetch } = upstream(() => Response.json(PEXELS_PAGE));
    const preflight = await handleRequest(new Request('https://proxy.example.dev/search', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), ENV, fetch);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect((await handleRequest(get('/search?query=mer', 'https://evil.example'), ENV, fetch)).status).toBe(403);
    expect((await handleRequest(get('/nothing'), ENV, fetch)).status).toBe(404);
  });
});

describe('isPublicHost', () => {
  it('rejects local and private network addresses', () => {
    expect(isPublicHost('images.pexels.com')).toBe(true);
    for (const host of ['localhost', '127.0.0.1', '10.0.0.4', '172.16.0.1', '192.168.0.1', '169.254.1.1', '[::1]', 'printer.local', '0.0.0.0']) {
      expect(isPublicHost(host)).toBe(false);
    }
  });
});
