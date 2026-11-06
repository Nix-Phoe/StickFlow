// Proxy d'images de StickFlow (v2.1, servi sous /api/* par le Worker du site depuis la v2.2).
// - GET /api/search?query=&page=&per_page= : recherche dans Pexels avec la clé d'API (secret
//   PEXELS_API_KEY, jamais envoyée au client), réponse réduite à ce dont l'app a besoin, gardée
//   5 minutes en cache (Cache API).
// - GET /api/image?url= : télécharge une image publique (PNG, JPEG, WebP, GIF ; 20 Mo au plus ;
//   jamais de SVG) pour l'import par adresse.
// Seules les pages de l'app (même origine) et les origines de ALLOWED_ORIGINS sont servies ; un
// appel vers Pexels ou une image abandonne au bout de 10 secondes.

export interface ApiEnv {
  PEXELS_API_KEY?: string;
  /** Origines autorisées en plus de celle du site (développement : http://localhost:5173), séparées par des virgules. */
  ALLOWED_ORIGINS?: string;
}

/** Ce que le Worker fournit (injecté : les tests n'ont ni Cache API ni contexte d'exécution). */
export interface ApiDependencies {
  /** À appeler seul : le `fetch` des Workers refuse d'être appelé comme méthode (« Illegal invocation »). */
  fetch: typeof fetch;
  cache?: Pick<Cache, 'match' | 'put'>;
  /** Prolonge le Worker après la réponse (écriture du cache). */
  waitUntil?: (promise: Promise<unknown>) => void;
}

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';
const DEFAULT_PAGE_SIZE = 24;
/** Maximum de l'API Pexels. */
const MAX_PAGE_SIZE = 80;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const UPSTREAM_TIMEOUT_MS = 10_000;
/** Durée de vie des résultats de recherche en cache, en secondes. */
const SEARCH_CACHE_SECONDS = 300;
/** Une réponse du proxy n'est jamais interprétée comme autre chose que ce qu'elle annonce. */
const SAFE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };

export async function handleApi(request: Request, env: ApiEnv, deps: ApiDependencies): Promise<Response> {
  const url = new URL(request.url);
  const send = deps.fetch;
  const access = checkOrigin(request, url.origin, env.ALLOWED_ORIGINS ?? '');
  if (access === null) return text('Origine non autorisée', 403, {});
  const cors: Record<string, string> = access === 'same-origin' ? {} : { 'Access-Control-Allow-Origin': access, Vary: 'Origin' };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } });
  }
  if (request.method !== 'GET') return text('Méthode non autorisée', 405, cors);

  try {
    if (url.pathname === '/api/search') return await search(url, env, deps, send, cors);
    if (url.pathname === '/api/image') return await image(url, send, cors);
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) return text('Délai dépassé', 504, cors);
    console.error('[api]', url.pathname, error);
    return text('Service indisponible', 502, cors);
  }
  return text('Introuvable', 404, cors);
}

/**
 * Qui appelle ? `'same-origin'` pour une page de l'app (le navigateur n'envoie pas toujours
 * `Origin` à sa propre origine, mais `Sec-Fetch-Site`), l'origine autorisée pour une autre, `null` sinon.
 */
function checkOrigin(request: Request, siteOrigin: string, allowed: string): string | null {
  const origin = request.headers.get('Origin');
  if (origin === null) return request.headers.get('Sec-Fetch-Site') === 'same-origin' ? 'same-origin' : null;
  if (origin === siteOrigin) return 'same-origin';
  const origins = allowed
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return origins.includes(origin) ? origin : null;
}

async function search(url: URL, env: ApiEnv, deps: ApiDependencies, send: typeof fetch, cors: Record<string, string>): Promise<Response> {
  if (!env.PEXELS_API_KEY) return json({ error: 'unconfigured' }, 503, cors);
  const query = (url.searchParams.get('query') ?? '').trim().slice(0, 100);
  if (query === '') return json({ error: 'empty-query' }, 400, cors);
  const page = clampInt(url.searchParams.get('page'), 1, 1000, 1);
  const perPage = clampInt(url.searchParams.get('per_page'), 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const params = new URLSearchParams({ query, page: String(page), per_page: String(perPage) });
  const headers = { ...cors, 'Cache-Control': `public, max-age=${SEARCH_CACHE_SECONDS}` };

  // Même recherche dans les 5 dernières minutes : Pexels n'est pas rappelé (limite de 200 par heure).
  const cacheKey = `${url.origin}/api/search?${params.toString()}`;
  const cached = await deps.cache?.match(cacheKey);
  if (cached) return json(await cached.json(), 200, headers);

  const upstream = await send(`${PEXELS_SEARCH}?${params.toString()}`, {
    headers: { Authorization: env.PEXELS_API_KEY },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (upstream.status === 429) return json({ error: 'rate-limited' }, 429, cors);
  if (!upstream.ok) return json({ error: 'failed' }, 502, cors);
  const body = (await upstream.json()) as PexelsPage;
  const result = {
    page: body.page ?? page,
    hasMore: Boolean(body.next_page),
    photos: (body.photos ?? []).map((photo) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? '',
      color: photo.avg_color ?? '#808080',
      thumbnail: photo.src.medium,
      // Assez grande pour un fond 4K une fois recadrée, sans télécharger l'originale.
      image: photo.src.large2x,
      author: photo.photographer,
      authorUrl: photo.photographer_url,
      url: photo.url,
    })),
  };
  if (deps.cache) {
    const stored = json(result, 200, { 'Cache-Control': `public, max-age=${SEARCH_CACHE_SECONDS}` });
    const write = deps.cache.put(cacheKey, stored);
    if (deps.waitUntil) deps.waitUntil(write);
    else await write;
  }
  return json(result, 200, headers);
}

async function image(url: URL, send: typeof fetch, cors: Record<string, string>): Promise<Response> {
  const target = parseWebAddress(url.searchParams.get('url') ?? '');
  if (!target) return text('Adresse invalide', 400, cors);
  const upstream = await send(target.toString(), {
    redirect: 'follow',
    headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!upstream.ok) return text('Image introuvable', 502, cors);
  const type = (upstream.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!IMAGE_TYPES.has(type)) return text("Ce n'est pas une image PNG, JPEG, WebP ou GIF", 415, cors);
  const length = Number(upstream.headers.get('Content-Length') ?? '0');
  if (length > MAX_IMAGE_BYTES) return text('Image trop lourde', 413, cors);
  const bytes = await readLimited(upstream, MAX_IMAGE_BYTES);
  if (!bytes) return text('Image trop lourde', 413, cors);
  return new Response(bytes, { status: 200, headers: { ...cors, ...SAFE_HEADERS, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
}

/** Lit le corps sans dépasser `max` octets ; `null` (et lecture abandonnée) au-delà. */
async function readLimited(response: Response, max: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Adresse http(s) d'un hôte public ; `null` sinon (fichier, réseau local, adresse mal formée). */
function parseWebAddress(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return isPublicHost(parsed.hostname) ? parsed : null;
  } catch {
    return null;
  }
}

/** Hôte joignable sur Internet : pas une machine locale ni un réseau privé. */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host.includes(':')) return !(host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'));
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a = 0, b = 0] = parts;
    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  return true;
}

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json; charset=utf-8' } });
}

function text(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...headers, ...SAFE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

interface PexelsPage {
  page?: number;
  next_page?: string;
  photos?: Array<{
    id: number;
    width: number;
    height: number;
    url: string;
    photographer: string;
    photographer_url: string;
    avg_color?: string;
    alt?: string;
    src: { medium: string; large2x: string };
  }>;
}
