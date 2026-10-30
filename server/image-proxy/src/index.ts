// Proxy d'images de StickFlow (v2.1) : Cloudflare Worker sans dépendance.
// - GET /search?query=&page=&per_page= : recherche dans Pexels avec la clé d'API (secret
//   PEXELS_API_KEY, jamais envoyée au client), réponse réduite à ce dont l'app a besoin.
// - GET /image?url= : télécharge une image publique (PNG, JPEG, WebP, GIF ; 20 Mo au plus ; jamais
//   de SVG) et la renvoie avec les en-têtes CORS qu'exigent WebGL et l'export de l'app.
// Seules les origines de ALLOWED_ORIGINS (liste séparée par des virgules, ou « * ») sont servies.

export interface Env {
  PEXELS_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
}

const PEXELS_SEARCH = 'https://api.pexels.com/v1/search';
const DEFAULT_PAGE_SIZE = 24;
/** Maximum de l'API Pexels. */
const MAX_PAGE_SIZE = 80;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env, fetch),
};

export async function handleRequest(request: Request, env: Env, fetchUpstream: typeof fetch): Promise<Response> {
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigin(origin, env.ALLOWED_ORIGINS ?? '');
  if (origin !== null && allowed === null) return new Response('Origine non autorisée', { status: 403 });
  const cors = corsHeaders(allowed);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '86400' } });
  }
  if (request.method !== 'GET') return text('Méthode non autorisée', 405, cors);

  const url = new URL(request.url);
  if (url.pathname === '/search') return search(url, env, fetchUpstream, cors);
  if (url.pathname === '/image') return image(url, fetchUpstream, cors);
  return text('Introuvable', 404, cors);
}

async function search(url: URL, env: Env, fetchUpstream: typeof fetch, cors: Record<string, string>): Promise<Response> {
  if (!env.PEXELS_API_KEY) return json({ error: 'unconfigured' }, 503, cors);
  const query = (url.searchParams.get('query') ?? '').trim();
  if (query === '') return json({ error: 'empty-query' }, 400, cors);
  const page = clampInt(url.searchParams.get('page'), 1, 1000, 1);
  const perPage = clampInt(url.searchParams.get('per_page'), 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const params = new URLSearchParams({ query: query.slice(0, 100), page: String(page), per_page: String(perPage) });
  const upstream = await fetchUpstream(`${PEXELS_SEARCH}?${params.toString()}`, { headers: { Authorization: env.PEXELS_API_KEY } });
  if (upstream.status === 429) return json({ error: 'rate-limited' }, 429, cors);
  if (!upstream.ok) return json({ error: 'failed' }, 502, cors);
  const body = (await upstream.json()) as PexelsPage;
  return json(
    {
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
    },
    200,
    { ...cors, 'Cache-Control': 'public, max-age=600' },
  );
}

async function image(url: URL, fetchUpstream: typeof fetch, cors: Record<string, string>): Promise<Response> {
  const target = parseWebAddress(url.searchParams.get('url') ?? '');
  if (!target) return text('Adresse invalide', 400, cors);
  let upstream: Response;
  try {
    upstream = await fetchUpstream(target.toString(), { redirect: 'follow', headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' } });
  } catch {
    return text('Image injoignable', 502, cors);
  }
  if (!upstream.ok) return text('Image introuvable', 502, cors);
  const type = (upstream.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!IMAGE_TYPES.has(type)) return text("Ce n'est pas une image PNG, JPEG, WebP ou GIF", 415, cors);
  const length = Number(upstream.headers.get('Content-Length') ?? '0');
  if (length > MAX_IMAGE_BYTES) return text('Image trop lourde', 413, cors);
  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) return text('Image trop lourde', 413, cors);
  return new Response(bytes, { status: 200, headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
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

function allowedOrigin(origin: string | null, list: string): string | null {
  if (origin === null) return null;
  const origins = list.split(',').map((entry) => entry.trim()).filter(Boolean);
  return origins.includes('*') || origins.includes(origin) ? origin : null;
}

function corsHeaders(origin: string | null): Record<string, string> {
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
}

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

function text(body: string, status: number, headers: Record<string, string>): Response {
  return new Response(body, { status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
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
