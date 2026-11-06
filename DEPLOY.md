# Déploiement de StickFlow (phase 7A : web / PWA)

StickFlow est publié comme une **Progressive Web App** sur **Cloudflare Workers**, avec Static Assets. Un seul Worker, nommé `stickflow`, sert à la fois le site et le proxy d'images.

## 1. Architecture

```
Navigateur ──► Worker « stickflow » (Cloudflare)
                ├─ /api/*  ──► code du Worker (server/worker.ts → server/image-proxy.ts)
                │               ├─ /api/search ──► API Pexels (clé secrète, recherche coupée pour l'instant)
                │               └─ /api/image  ──► image publique (PNG, JPEG, WebP, GIF ≤ 20 Mo)
                └─ tout le reste ──► fichiers de dist/ (static assets)
                                     ├─ en-têtes : public/_headers (CSP, cache…)
                                     └─ adresse inconnue : dist/404.html (statut 404)
```

- **Routage.** `run_worker_first: ["/api/*"]` : seul le proxy exécute du code, le reste est servi directement par Cloudflare. L'app utilise un routeur par hash (`#/editor/…`), donc aucune règle de repli SPA n'est nécessaire.
- **Pages.** Cloudflare sert les pages sans `.html` : `/confidentialite`, `/a-propos`. Une adresse en `.html` est redirigée vers la version sans extension.
- **Hors ligne.** Le service worker (Workbox, `vite-plugin-pwa`) met toute l'app en cache, pages publiques comprises. `/api/*` passe toujours par le réseau. Les vignettes Pexels sont gardées une semaine, 150 au plus.
- **Mises à jour.** Une nouvelle version attend l'accord de l'utilisateur. Une bannière « Nouvelle version disponible » enregistre le projet ouvert, puis recharge l'app.
- **Origine.** Le proxy ne répond qu'aux pages du site, ou aux origines listées dans `ALLOWED_ORIGINS`.
- **Recherche de photos.** Coupée pour l'instant (voir la section 10) : l'onglet Internet ne propose que l'import par adresse, qui ne demande aucune clé.

**Fichiers :**

| Fichier | Rôle |
|---|---|
| `wrangler.jsonc` | Configuration du Worker (nom, date de compatibilité, static assets, variables) |
| `server/worker.ts` | Entrée du Worker : `/api/*` vers le proxy, le reste vers les static assets |
| `server/image-proxy.ts` | Proxy d'images (testé avec Vitest : `server/image-proxy.test.ts`) |
| `public/_headers` | En-têtes de cache et de sécurité des fichiers du site |
| `vite.config.ts` | Build (pages, PWA, licences, balises de partage, robots.txt, sitemap.xml) |
| `.dev.vars.example` | Modèle des secrets locaux (copier en `.dev.vars`, ignoré par git) |
| `.env.example` | Variables de build (copier en `.env.local`, ignoré par git) |
| `.github/workflows/ci.yml` | Intégration continue : types, lint, tests, build |

## 2. Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Vite en développement (http://localhost:5173) ; `/api/*` est renvoyé vers `wrangler dev` sur le port 8787 |
| `npm run dev:api` | Le Worker seul, sur le port 8787, pour la recherche d'images en développement (après un `npm run build`) |
| `npm run preview:worker` | Build, puis le Worker sert `dist/` **exactement comme en production** (http://localhost:8787) |
| `npm run deploy` | Build, puis `wrangler deploy` (mise en production manuelle) |
| `npm test` / `npm run lint` / `npm run typecheck` | Tests, lint Biome, types de l'app et du Worker |
| `npm run icons` | Régénère les icônes depuis `public/app-icon.svg` |
| `npm run screenshots` | Captures du manifeste et image de partage. Demande un build servi sur le port 4173 (`npx vite preview --port 4173`) |

## 3. Secrets et variables

**Aucune clé dans le code ni dans le dépôt.**

| Nom | Type | Où le définir |
|---|---|---|
| `PEXELS_API_KEY` | Secret du Worker (**facultatif**, recherche seulement) | `npx wrangler secret put PEXELS_API_KEY` (la valeur est demandée au clavier, jamais en argument) ; en local : `.dev.vars` |
| `ALLOWED_ORIGINS` | Variable du Worker | `wrangler.jsonc` (vide en production : le site lui-même est toujours autorisé) ; en local : `.dev.vars` (`http://localhost:5173`) |
| `SITE_URL` | Variable de **build** | Adresse publique du site, sans « / » final. Sert aux balises de partage, à `sitemap.xml` et à `robots.txt`. Workers Builds : *Settings › Build › Variables and secrets* ; en local : `.env.local` |
| `VITE_IMAGE_PROXY_URL` | Variable de build (facultative) | Vide par défaut : `/api` sur le même domaine |
| `VITE_STOCK_SEARCH` | Variable de build (facultative) | `on` propose la recherche de photos ; vide par défaut (section 10) |

`.dev.vars`, `.env`, `.env.local` et `.wrangler/` sont ignorés par git.

Changer un secret avec `wrangler secret put` crée et déploie une nouvelle version du Worker immédiatement.

## 4. Premier déploiement (manuel)

1. **Compte Cloudflare** (gratuit) : https://dash.cloudflare.com/sign-up.
2. Dans le dossier du projet :
   ```bash
   npx wrangler login
   ```
   Le navigateur s'ouvre : autorisez Wrangler.
3. Déployez :
   ```bash
   npm run deploy
   ```
   Wrangler affiche l'adresse, par exemple `https://stickflow.<votre-sous-domaine>.workers.dev`.
4. Mettez cette adresse dans `SITE_URL` (`.env.local`), puis lancez `npm run deploy` à nouveau. Les balises de partage et `sitemap.xml` utilisent alors des adresses absolues.

## 5. Déploiement automatique (Workers Builds)

Une fois le dépôt sur GitHub :

1. Tableau de bord Cloudflare › **Workers & Pages** › Worker **stickflow** › **Settings** › **Build** › **Connect** (Git repository).
2. Autorisez l'app GitHub de Cloudflare sur le dépôt `Nix-Phoe/<dépôt>`, puis choisissez-le.
3. Réglages :
   - **Production branch** : `main`.
   - **Build command** : `npm run build`.
   - **Deploy command** : `npx wrangler deploy` (valeur par défaut).
   - **Builds for non-production branches** : activé. La commande par défaut, `npx wrangler preview`, crée une **prévisualisation** par branche, avec sa propre adresse.
   - **Root directory** : vide (la racine du dépôt).
4. **Variables de build** (*Build › Variables and secrets*) : `SITE_URL` = l'adresse de production.
5. Sauvegardez. Chaque push sur `main` déploie en production, chaque autre branche reçoit une prévisualisation. La CI GitHub (`ci.yml`) vérifie en parallèle les types, le lint, les tests et le build.

**Attention aux prévisualisations :**
- Leurs adresses sont **publiques**, sauf si vous les protégez avec Cloudflare Access (*Settings › Domains & Routes*).
- Si la recherche est réactivée, elles utilisent le même secret Pexels, donc le même quota de 200 requêtes par heure.

Node 22 est fixé par `.node-version`.

## 6. Mettre à jour

1. Développez sur une branche, puis ouvrez une pull request. La CI et la prévisualisation se lancent.
2. Ajoutez une entrée à `CHANGELOG.md` et changez la version dans `package.json` (affichée dans les Réglages et la page À propos).
3. Fusionnez dans `main` : Workers Builds déploie.
4. Les utilisateurs voient « Nouvelle version disponible — Mettre à jour » à leur prochaine visite, ou dans l'heure si l'app est déjà ouverte. Rien n'est rechargé sans leur accord.

## 7. Revenir en arrière

```bash
npx wrangler deployments list
npx wrangler rollback
```

- Sans argument, `rollback` revient à la version précédente. Avec un identifiant de version (`npx wrangler rollback <version-id>`), il revient à cette version.
- Même chose dans le tableau de bord : *Deployments* › *Rollback*.
- **Limites :**
  - Un retour en arrière ne restaure ni les secrets ni les données. Le Worker n'en stocke pas ; les projets sont chez les utilisateurs.
  - Les utilisateurs qui avaient déjà la version retirée la voient remplacée par l'ancienne, via la même bannière de mise à jour.
  - Corrigez ensuite sur `main` : le prochain déploiement automatique remplacera la version restaurée.

## 8. Tests manuels avant une mise en ligne publique

Navigateurs : **Chrome**, **Firefox** et **Safari** sur ordinateur ; **Chrome Android** ; **Safari iOS**.

- [ ] L'accueil s'affiche ; un projet se crée depuis un raccourci de format et depuis un modèle.
- [ ] L'éditeur : poser un personnage, ajouter des images, lire, annuler / rétablir.
- [ ] Arrière-plan : couleur, intégré, image de l'appareil, image par son adresse (onglet Internet).
- [ ] Export GIF, PNG (ZIP) et vidéo (MP4, ou WebM sur Firefox).
- [ ] **Installation** : Chrome (ordinateur, Android) via « Installer l'app » dans les Réglages ou l'invitation de l'accueil ; iOS via Partager › Sur l'écran d'accueil. L'app s'ouvre dans sa propre fenêtre.
- [ ] **Mode avion**, app installée et déjà ouverte une fois : créer, éditer, enregistrer, exporter. L'onglet Internet affiche son message hors ligne.
- [ ] **Mise à jour** : déployer une nouvelle version, rouvrir l'app, voir la bannière, « Mettre à jour » ; le projet ouvert est conservé.
- [ ] **Projets** :
  - exporter un projet (`.stickflow`), le supprimer, le réimporter ;
  - « Sauvegarder tous mes projets », puis « Restaurer une sauvegarde » ;
  - importer un fichier quelconque renommé en `.stickflow` : il est refusé avec un message clair.
- [ ] **Réglages** : version, « Stockage protégé » (Firefox demande l'autorisation), liens Confidentialité et À propos.
- [ ] Une adresse inconnue (`/nimporte-quoi`) affiche la page 404.

**Résultats obtenus en local** (`npm run preview:worker`, Lighthouse 13, le 2 novembre 2026) :

| Page | Profil | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|---|
| Accueil | ordinateur | 100 | 100 | 100 | 100 |
| Accueil | mobile | 93 | 100 | 100 | 100 |
| Confidentialité et À propos | ordinateur | — | 100 | 100 | 100 |

- Installabilité (Chrome) : aucune erreur.
- Hors ligne, dans Chrome sans interface : accueil, nouveau projet dans l'éditeur et pages publiques s'ouvrent.
- Exports GIF, PNG et MP4 : sans aucune violation de la CSP.

## 9. Ce qui resservira en phase 7B (Google Play, Capacitor)

- **Icônes** :
  - `public/app-icon.svg` est la source ;
  - `npm run icons` produit les PNG ;
  - l'icône maskable 512 px sert de base à l'icône adaptative Android.
- **Captures et image de la fiche** : `scripts/screenshots.mjs`, à adapter aux formats de Google Play (téléphone, tablette, bannière 1024 × 500).
- **Politique de confidentialité** : `/confidentialite`, demandée par Google Play. Il faudra y décrire l'app Android : mêmes données, stockées dans la WebView.
- **Proxy d'images** : dans l'app Android, les pages sont servies depuis `https://localhost`, l'origine par défaut de Capacitor. Il faudra :
  - construire avec `VITE_IMAGE_PROXY_URL=https://<site>/api` ;
  - ajouter `https://localhost` à `ALLOWED_ORIGINS`.
- **Données** :
  - le fichier `.stickflow` sert aussi à passer ses projets du web à Android ;
  - `navigator.storage.persist()` reste utile dans la WebView.
- **À ne pas reprendre** : le service worker et la bannière de mise à jour. Dans Capacitor, les mises à jour passent par le Play Store. Il faudra désactiver l'enregistrement du service worker dans ce build.

## 10. Réactiver la recherche de photos (Pexels)

Pexels n'émet plus de clés d'API pour l'instant : la recherche est coupée, mais tout son code est conservé. Quand vous aurez une clé :

1. Enregistrez le secret : `npx wrangler secret put PEXELS_API_KEY`.
2. Ajoutez la variable de build `VITE_STOCK_SEARCH=on` (`.env.local` et Workers Builds), puis redéployez.
3. Remettez dans la politique de confidentialité la description de ce qui est transmis à Pexels (mots recherchés, vignettes chargées depuis `images.pexels.com`), et le crédit Pexels dans la page À propos.
