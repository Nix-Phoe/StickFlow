// Client du proxy d'images (v2.1, server/image-proxy) : recherche dans la banque d'images libres
// (Pexels) et téléchargement d'images avec les en-têtes CORS qu'exigent WebGL et l'export.
// La clé d'API reste dans le proxy : le client ne connaît que son adresse, `/api` sur le même domaine
// depuis la v2.2 (VITE_IMAGE_PROXY_URL pour un autre proxy).

import type { AssetErrorCode, StockPhoto } from '../core/types';

/** Photos par page de résultats. */
export const STOCK_PAGE_SIZE = 24;
const PROVIDER = 'Pexels';

export class StockError extends Error {
  override name = 'StockError';
  constructor(readonly code: AssetErrorCode) {
    super(code);
  }
}

export interface StockClient {
  /** Un proxy est configuré (sinon l'onglet Internet l'explique). */
  readonly configured: boolean;
  /** La recherche de photos est proposée ; l'import par adresse, lui, ne demande pas de clé. */
  readonly searchEnabled: boolean;
  search(query: string, page: number): Promise<{ photos: StockPhoto[]; hasMore: boolean }>;
  /** Image d'une adresse http(s), par le proxy. */
  download(url: string): Promise<Blob>;
}

export interface StockClientOptions {
  /** Adresse du proxy ; `null` ou vide : pas configuré. */
  baseUrl: string | null;
  /** Propose la recherche de photos (par défaut). Coupée, seule reste l'adresse d'une image. */
  searchEnabled?: boolean;
  fetch?: typeof globalThis.fetch;
  /** L'appareil est en ligne (`navigator.onLine`). */
  online?: () => boolean;
}

export function createStockClient({ baseUrl, searchEnabled = true, fetch = globalThis.fetch.bind(globalThis), online = () => navigator.onLine }: StockClientOptions): StockClient {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : '';

  async function request(path: string): Promise<Response> {
    if (!base) throw new StockError('unconfigured');
    if (!online()) throw new StockError('offline');
    let response: Response;
    try {
      response = await fetch(`${base}${path}`);
    } catch {
      throw new StockError(online() ? 'failed' : 'offline');
    }
    if (response.ok) return response;
    // 503 : le proxy répond, mais sa clé d'API n'est pas configurée ; 415 / 413 : image refusée.
    const codes: Record<number, AssetErrorCode> = { 429: 'rate-limited', 503: 'unconfigured', 415: 'unsupported', 413: 'too-large' };
    throw new StockError(codes[response.status] ?? 'failed');
  }

  return {
    configured: base !== '',
    searchEnabled,
    async search(query, page) {
      if (!searchEnabled) throw new StockError('unconfigured');
      const params = new URLSearchParams({ query, page: String(page), per_page: String(STOCK_PAGE_SIZE) });
      const body: unknown = await (await request(`/search?${params.toString()}`)).json();
      const record = isRecord(body) ? body : {};
      const photos = Array.isArray(record.photos) ? record.photos.flatMap(readPhoto) : [];
      return { photos, hasMore: record.hasMore === true };
    },
    async download(url) {
      if (!isWebAddress(url)) throw new StockError('invalid-url');
      return (await request(`/image?url=${encodeURIComponent(url)}`)).blob();
    },
  };
}

/** Adresse http(s) valide. */
export function isWebAddress(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Photo renvoyée par le proxy ; une entrée incomplète est ignorée. */
function readPhoto(value: unknown): StockPhoto[] {
  if (!isRecord(value)) return [];
  const text = (key: string): string | null => (typeof value[key] === 'string' ? (value[key] as string) : null);
  const id = typeof value.id === 'number' || typeof value.id === 'string' ? String(value.id) : null;
  const [thumbnail, image, author, url] = [text('thumbnail'), text('image'), text('author'), text('url')];
  if (!id || !thumbnail || !image || !author || !url || !isWebAddress(image)) return [];
  return [
    {
      id,
      width: typeof value.width === 'number' ? value.width : 0,
      height: typeof value.height === 'number' ? value.height : 0,
      alt: text('alt') ?? '',
      color: text('color') ?? '#808080',
      thumbnail,
      image,
      author,
      authorUrl: text('authorUrl') ?? url,
      url,
      provider: PROVIDER,
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
