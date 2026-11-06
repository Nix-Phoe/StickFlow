# 0006 : un seul Worker pour le site et le proxy, PWA à mise à jour consentie

- Statut : accepté (version 2.2, phase 7A)
- Contexte : ADR 0005 (proxy d'images), `DEPLOY.md`

## Contexte

La phase 7A met StickFlow en ligne. Il faut :

- héberger l'app, qui est statique : HTML, JS, CSS et icônes après `vite build` ;
- héberger le proxy d'images de la v2.1, qui garde la clé Pexels ;
- faire fonctionner l'app hors ligne, sans jamais perdre le travail en cours au moment d'une mise à jour.

## Décision

**Un seul Cloudflare Worker, `stickflow`, avec Static Assets** (`wrangler.jsonc`). Les fichiers de `dist/` sont servis directement par Cloudflare. Seul `/api/*` passe par le code du Worker (`run_worker_first`), qui appelle `server/image-proxy.ts`. Une adresse inconnue reçoit `dist/404.html`. Pas de repli SPA : le routeur de l'app utilise le hash.

- Le proxy est sur **le même domaine** que l'app. L'app l'appelle sur `/api`, la CSP garde `connect-src 'self'`, et aucune adresse de proxy n'est à configurer.
- Le proxy n'accepte que :
  - les pages du site : `Sec-Fetch-Site: same-origin`, ou un en-tête `Origin` égal à celui du site ;
  - les origines listées dans `ALLOWED_ORIGINS` : Vite en développement, Capacitor plus tard.
- **Les en-têtes des fichiers** sont dans `public/_headers`. Les réponses du Worker ne les reçoivent pas : le proxy pose les siens (`nosniff`, `sandbox`).
- **La CSP** est réduite à ce que l'app utilise vraiment : aucun script ni style en ligne, `worker-src 'self'`. GIF et ZIP sont encodés sans worker `blob:` (gifenc, fflate synchrone).

**Une PWA dont la mise à jour se fait avec l'accord de l'utilisateur.**

- `vite-plugin-pwa` en `registerType: 'prompt'` :
  - toute l'app est pré-cachée ;
  - les pages HTML le sont sous l'adresse que sert Cloudflare (`/`, `/confidentialite`), sans redirection.
- Une nouvelle version attend dans le service worker. La bannière « Mettre à jour » appelle `ViewHost.save()`, qui enregistre le projet ouvert, puis active la nouvelle version.

## Conséquences

- Un seul déploiement (`npm run deploy`, ou Workers Builds depuis `main`), un seul domaine, aucun secret obligatoire. `npm run preview:worker` reproduit la production en local.
- Un retour en arrière (`wrangler rollback`) ramène le site et le proxy ensemble.
- Les utilisateurs gardent l'ancienne version tant qu'ils n'ont pas choisi « Mettre à jour ». La nouvelle s'applique d'elle-même quand tous les onglets de l'app sont fermés.
- Les adresses `.html` sont redirigées (307) par Cloudflare : les liens de l'app pointent vers les adresses sans extension.
- En phase 7B, l'app Android chargera ses fichiers localement. Elle appellera le proxy par son adresse absolue, avec `https://localhost` dans `ALLOWED_ORIGINS`, sans service worker.
- La recherche Pexels est coupée à la mise en ligne, car Pexels n'émet plus de clés d'API pour l'instant. `VITE_STOCK_SEARCH=on` et le secret `PEXELS_API_KEY` la réactivent sans changer le code ; `/api/image` n'en dépend pas.
- **Écarts assumés avec le prompt de la phase 7A :**
  - `worker-src 'self'` sans `blob:` : gif.js n'est pas utilisé.
  - Lint avec Biome, et non ESLint : typescript-eslint ne prend pas en charge TypeScript 7.
  - Pas de limite de débit par adresse IP : le binding Rate Limiting n'est pas documenté pour le plan gratuit. La protection repose sur l'origine, la taille, le type, le délai d'attente et le cache de 5 minutes.
