# Proxy d'images de StickFlow

Petit Cloudflare Worker sans dépendance, utilisé par l'onglet **Internet** de la sous-page « Arrière-plan » :

- `GET /search?query=forêt&page=1&per_page=24` : recherche dans [Pexels](https://www.pexels.com/api/) avec la clé d'API, gardée côté serveur. La réponse ne contient que les champs utiles à l'app (vignette, image, photographe, lien de la photo).
- `GET /image?url=…` : télécharge une image publique (PNG, JPEG, WebP ou GIF, 20 Mo au plus, jamais de SVG, jamais d'adresse locale ou privée) et la renvoie avec les en-têtes CORS. Sans eux, l'image serait inutilisable dans WebGL et dans l'export.

Seules les origines listées dans `ALLOWED_ORIGINS` sont servies (403 sinon). Sans clé d'API, `/search` répond 503 et l'app affiche « recherche non configurée ».

## Déployer

Prérequis : un compte Cloudflare (gratuit) et une clé d'API Pexels (gratuite : https://www.pexels.com/api/).

```bash
cd server/image-proxy
npx wrangler login
npx wrangler secret put PEXELS_API_KEY
npx wrangler deploy
```

1. Dans `wrangler.toml`, mettez dans `ALLOWED_ORIGINS` l'adresse de l'app : `http://localhost:5173` en développement, et celle de production (par exemple `https://stickflow.pages.dev`), séparées par des virgules.
2. `wrangler deploy` affiche l'adresse du Worker, par exemple `https://stickflow-image-proxy.<compte>.workers.dev`.
3. Côté app, copiez `.env.example` en `.env.local` (à la racine du projet) et renseignez `VITE_IMAGE_PROXY_URL` avec cette adresse, puis relancez `npm run dev` ou `npm run build`.

## Développer en local

```bash
cd server/image-proxy
cp .dev.vars.example .dev.vars
npx wrangler dev
```

Mettez votre clé dans `.dev.vars` (ignoré par git). Ensuite, `VITE_IMAGE_PROXY_URL=http://localhost:8787` dans `.env.local`.

Les tests du proxy tournent avec ceux de l'app (`npm test`). La vérification des types se lance avec `npx tsc -p server/image-proxy`.

## Conditions de Pexels

- **Crédit :** l'app affiche le photographe sur chaque résultat et sous l'arrière-plan appliqué (« Photo : Nom — Pexels », avec un lien vers la photo), ainsi qu'un lien vers Pexels au-dessus des résultats.
- **Limites :** 200 requêtes par heure et 20 000 par mois par défaut. Le proxy renvoie 429 quand elles sont atteintes, et l'app l'explique. Les résultats sont mis en cache 10 minutes.
