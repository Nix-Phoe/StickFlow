// Worker de StickFlow (v2.2) : sert le site (fichiers de dist/, « static assets ») et le proxy
// d'images sous /api/*. Seul /api/* passe par ce code (`run_worker_first`) ; le reste est servi
// directement par Cloudflare, avec les en-têtes de public/_headers et la page 404 de dist/404.html.

import { handleApi } from './image-proxy';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env, { fetch, cache: caches.default, waitUntil: (promise) => ctx.waitUntil(promise) });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
