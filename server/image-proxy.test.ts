import { describe, expect, it } from 'vitest';

import { handleApi, isPublicHost, type ApiDependencies, type ApiEnv } from './image-proxy';

const SITE = 'https://stickflow.example.workers.dev';
const DEV = 'http://localhost:5173';
const ENV: ApiEnv = { PEXELS_API_KEY: 'secret-key', ALLOWED_ORIGINS: DEV };

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
function upstream(respond: (request: Request, init?: RequestInit) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request, init);
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

/** Faux cache (Cache API) et `waitUntil` qui garde les écritures à attendre. */
function deps(fetch: typeof globalThis.fetch): ApiDependencies & { settle: () => Promise<void> } {
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];
  const keyOf = (key: RequestInfo | URL): string => (key instanceof Request ? key.url : String(key));
  return {
    fetch,
    cache: {
      match: async (key) => entries.get(keyOf(key))?.clone(),
      put: async (key, response) => {
        entries.set(keyOf(key), response);
      },
    },
    waitUntil: (promise) => void pending.push(promise),
    settle: async () => {
      await Promise.all(pending);
    },
  };
}

/** Requête de l'app : même origine (le navigateur n'envoie pas Origin, mais Sec-Fetch-Site). */
const sameOrigin = (path: string, init: RequestInit = {}): Request =>
  new Request(`${SITE}${path}`, { ...init, headers: { 'Sec-Fetch-Site': 'same-origin' } });
const fromOrigin = (path: string, origin: string): Request => new Request(`${SITE}${path}`, { headers: { Origin: origin, 'Sec-Fetch-Site': 'cross-site' } });
const imageOf = (url: string): Request => sameOrigin(`/api/image?url=${encodeURIComponent(url)}`);

describe('/api/search', () => {
  it('asks Pexels with the secret key, and returns only what the app needs', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    const response = await handleApi(sameOrigin('/api/search?query=for%C3%AAt&page=1&per_page=24'), ENV, deps(fetch));
    expect(requests[0]?.url).toBe('https://api.pexels.com/v1/search?query=for%C3%AAt&page=1&per_page=24');
    expect(requests[0]?.headers.get('Authorization')).toBe('secret-key');
    expect(response.status).toBe(200);
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

  it('keeps search results a few minutes (Cache API): the same search does not reach Pexels again', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    const context = deps(fetch);
    await handleApi(sameOrigin('/api/search?query=mer&page=1&per_page=24'), ENV, context);
    await context.settle();
    const second = await handleApi(sameOrigin('/api/search?query=mer&page=1&per_page=24'), ENV, context);
    expect(requests).toHaveLength(1);
    expect(second.status).toBe(200);
    expect(second.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(((await second.json()) as { photos: unknown[] }).photos).toHaveLength(1);
  });

  it('limits the page size, and refuses an empty search', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    await handleApi(sameOrigin('/api/search?query=mer&per_page=500'), ENV, deps(fetch));
    expect(new URL(requests[0]?.url ?? '').searchParams.get('per_page')).toBe('80');
    expect((await handleApi(sameOrigin('/api/search?query=%20'), ENV, deps(fetch))).status).toBe(400);
  });

  it('answers 503 without an API key, passes on the rate limit, and gives up on a slow upstream', async () => {
    const limited = upstream(() => new Response('', { status: 429 }));
    expect((await handleApi(sameOrigin('/api/search?query=mer'), { ...ENV, PEXELS_API_KEY: '' }, deps(limited.fetch))).status).toBe(503);
    expect((await handleApi(sameOrigin('/api/search?query=mer'), ENV, deps(limited.fetch))).status).toBe(429);
    const signals: unknown[] = [];
    const slow = upstream((_request, init) => {
      signals.push(init?.signal);
      throw new DOMException('trop long', 'TimeoutError');
    });
    expect((await handleApi(sameOrigin('/api/search?query=mer'), ENV, deps(slow.fetch))).status).toBe(504);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });
});

describe('/api/image', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  it('fetches a public image and returns it, unable to be read as anything else', async () => {
    const { fetch } = upstream(() => new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    const response = await handleApi(imageOf('https://example.com/chat.png'), ENV, deps(fetch));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  });

  it('refuses SVG and non-images', async () => {
    const svg = upstream(() => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    expect((await handleApi(imageOf('https://example.com/a.svg'), ENV, deps(svg.fetch))).status).toBe(415);
    const html = upstream(() => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
    expect((await handleApi(imageOf('https://example.com/'), ENV, deps(html.fetch))).status).toBe(415);
  });

  it('refuses files over 20 MB, whether their size is announced or not', async () => {
    const announced = upstream(() => new Response(png, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(21 * 1024 * 1024) } }));
    expect((await handleApi(imageOf('https://example.com/big.png'), ENV, deps(announced.fetch))).status).toBe(413);
    // Sans taille annoncée : la lecture s'arrête dès que la limite est dépassée.
    const endless = upstream(
      () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(1024 * 1024));
            },
          }),
          { headers: { 'Content-Type': 'image/png' } },
        ),
    );
    expect((await handleApi(imageOf('https://example.com/stream.png'), ENV, deps(endless.fetch))).status).toBe(413);
  });

  it('never fetches private or non-web addresses', async () => {
    const never = upstream(() => new Response(png));
    for (const url of ['file:///etc/passwd', 'http://localhost/a.png', 'http://192.168.1.2/a.png', 'nope']) {
      expect((await handleApi(imageOf(url), ENV, deps(never.fetch))).status).toBe(400);
    }
    expect(never.requests).toEqual([]);
  });
});

describe('Workers runtime', () => {
  /** Comme le `fetch` des Workers : « Illegal invocation » s'il est appelé comme méthode d'un objet. */
  function strictFetch(respond: () => Response): typeof globalThis.fetch {
    return function (this: unknown): Promise<Response> {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(respond());
    } as typeof globalThis.fetch;
  }

  it('calls fetch on its own, for both the image and the search routes', async () => {
    const image = strictFetch(() => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } }));
    expect((await handleApi(imageOf('https://example.com/a.png'), ENV, deps(image))).status).toBe(200);
    const search = strictFetch(() => Response.json(PEXELS_PAGE));
    expect((await handleApi(sameOrigin('/api/search?query=mer'), ENV, deps(search))).status).toBe(200);
  });
});

describe('origin check', () => {
  it('serves the app itself (same origin) and the origins of ALLOWED_ORIGINS, with CORS for the latter', async () => {
    const { fetch } = upstream(() => Response.json(PEXELS_PAGE));
    expect((await handleApi(sameOrigin('/api/search?query=mer'), ENV, deps(fetch))).status).toBe(200);
    // Certains navigateurs envoient Origin même pour la même origine : c'est la nôtre.
    expect((await handleApi(fromOrigin('/api/search?query=mer', SITE), ENV, deps(fetch))).status).toBe(200);
    const dev = await handleApi(fromOrigin('/api/search?query=mer', DEV), ENV, deps(fetch));
    expect(dev.status).toBe(200);
    expect(dev.headers.get('Access-Control-Allow-Origin')).toBe(DEV);
    const preflight = await handleApi(new Request(`${SITE}/api/search`, { method: 'OPTIONS', headers: { Origin: DEV } }), ENV, deps(fetch));
    expect(preflight.status).toBe(204);
  });

  it('refuses other sites, and requests that do not come from a page of the app', async () => {
    const { fetch, requests } = upstream(() => Response.json(PEXELS_PAGE));
    expect((await handleApi(fromOrigin('/api/search?query=mer', 'https://evil.example'), ENV, deps(fetch))).status).toBe(403);
    expect((await handleApi(new Request(`${SITE}/api/search?query=mer`), ENV, deps(fetch))).status).toBe(403);
    const crossSite = new Request(`${SITE}/api/search?query=mer`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect((await handleApi(crossSite, ENV, deps(fetch))).status).toBe(403);
    expect(requests).toEqual([]);
  });

  it('answers 404 for an unknown route and 405 for another method', async () => {
    const { fetch } = upstream(() => Response.json(PEXELS_PAGE));
    expect((await handleApi(sameOrigin('/api/nothing'), ENV, deps(fetch))).status).toBe(404);
    expect((await handleApi(sameOrigin('/api/search', { method: 'POST' }), ENV, deps(fetch))).status).toBe(405);
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
