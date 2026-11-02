# Audit avant déploiement (phase 7A)

État des lieux de la version 2.1 (commit `ecfb2c2`), fait le 2 novembre 2026 avant toute modification de la phase 7A.

## 1. TypeScript, code mort, journaux

**TypeScript** : `tsc` (mode strict, `noUnused*`, `noUncheckedIndexedAccess`) ne signale aucune erreur ni aucun avertissement. Le proxy (`server/image-proxy`) se vérifie lui aussi sans erreur.

**Tests** : les 637 tests Vitest passent.

**Lint** : le projet n'a pas encore d'outil de lint.
- `typescript-eslint` ne prend pas en charge TypeScript 7 (sa dépendance s'arrête avant TypeScript 6.1).
- Le lint de la phase 7A se fera donc avec **Biome**, qui ne dépend pas de TypeScript.

**Code mort** : `knip` en relève peu.
- Deux fichiers ne sont importés nulle part : `src/ai/index.ts` (vide) et `src/model/index.ts`.
- Quelques fonctions ne sont appelées nulle part, même pas dans leur propre fichier ni dans les tests. Les autres « exports inutilisés » relevés par `knip` sont des constantes ou des types utilisés dans leur propre fichier ; ce n'est pas du code mort.

**Journaux restants** :

| Fichier | Journal | Décision |
|---|---|---|
| `views/editor-view.ts`, `views/home-view.ts` | `console.info('[event] …')` : journal de **tous les événements du bus** (phase 1) | Seulement en développement |
| `environment/asset-images.ts` | image illisible | Garder, en `console.error` |
| `environment/asset-importer.ts` | import échoué | Garder, en `console.error` |
| `render/stage-view.ts` | contexte WebGL perdu ou restauré | Garder, en `console.error` |
| `views/editor-view.ts` | vidéo non conservée | Garder, en `console.error` |
| `views/project-previewer.ts` | aperçu de carte indisponible | Garder, en `console.error` |

**Dépendances** :
- `npm audit --omit=dev` : 0 vulnérabilité dans ce qui part en production.
- Les 10 alertes « moderate » ou « low » viennent des outils de build de la PWA (`workbox-build` : `glob`, `minimatch`, `deepmerge`). Elles ne sont jamais envoyées au navigateur. La seule « correction » proposée rétrograde `vite-plugin-pwa` en 1.1.0, incompatible avec Vite 8. On la laisse de côté.

## 2. Taille du bundle de production

Avant découpage, tout part dans un seul fichier :

| Fichier | Taille | gzip |
|---|---|---|
| `index-[hash].js` | 277,7 kB | 89,1 kB |
| `index-[hash].css` | 85,7 kB | 12,8 kB |
| `image-worker-[hash].js` | 1,3 kB | — |
| `index.html` | 0,7 kB | 0,4 kB |

Répartition du JavaScript, avant minification, selon `rollup-plugin-visualizer` :

| Origine | Taille | gzip |
|---|---|---|
| `src/ui` (accueil et éditeur mélangés) | 188,4 kB | 65,0 kB |
| `src/model` | 42,8 kB | 14,5 kB |
| `src/render` (WebGL, vignettes) | 39,5 kB | 14,7 kB |
| `src/core` | 26,6 kB | 9,3 kB |
| `src/environment` | 22,9 kB | 9,8 kB |
| `gifenc` (export GIF) | 20,5 kB | 5,3 kB |
| `src/storage` | 20,4 kB | 7,4 kB |
| `src/templates` (modèles JSON) | 19,2 kB | 5,1 kB |
| `lucide` | 16,4 kB | 11,5 kB |
| `fflate` (ZIP) | 15,3 kB | 5,5 kB |
| `src/drawing`, `src/interaction`, `src/views`, `src/export`… | ≈ 48 kB | ≈ 18 kB |

**Constats** :
- L'accueil charge l'éditeur, le rendu WebGL, le dessin, l'interaction et les encodeurs d'export, alors qu'il n'en a pas besoin pour s'afficher.
- Les noms de fichiers ont déjà une empreinte (`[hash]`, par défaut dans Vite).

## 3. API absentes de certains navigateurs

| API | Utilisée pour | Comportement actuel | Repli prévu |
|---|---|---|---|
| **WebGL 2** | scène de l'éditeur | `WebGLUnavailableError` non attrapée : l'éditeur reste vide, sans explication | **À faire** : détection au démarrage, page « navigateur non compatible » |
| `EyeDropper` | pipette | déjà géré : clic sur la scène (lecture d'un pixel WebGL) | rien à faire |
| `MediaRecorder` | export vidéo | MP4 si possible, sinon WebM ; sans `MediaRecorder` : message « Ce navigateur ne sait pas enregistrer de vidéo » | rien à faire (GIF et PNG restent possibles) |
| `OffscreenCanvas`, `Worker` | traitement des images importées | déjà géré : traitement sur le fil principal | rien à faire |
| `canvas.convertToBlob` en WebP | compression des images | déjà géré : JPEG si le WebP n'est pas produit (Safari) | rien à faire |
| `CanvasRenderingContext2D.filter` | flou et luminosité de l'arrière-plan | ignoré par Safari < 18 : image sans effet | rien à faire (documenté dans l'ADR 0005) |
| Web Share (fichiers) | « Partager » une vidéo | bouton caché si `navigator.canShare` refuse | rien à faire |
| `requestFullscreen` | plein écran du lecteur | appel facultatif (`?.`) | rien à faire |
| `navigator.storage.estimate()` | espace utilisé | non affiché si absent | rien à faire |
| `navigator.storage.persist()` | stockage protégé | pas encore utilisé | **À faire** (étape 4 du prompt) |
| IndexedDB | projets, vidéos, images | magasin en mémoire si absent (navigation privée) | **À ajouter** : avertissement dans les Réglages |
| `<dialog>` | feuilles et dialogues | Safari 15.4+, Firefox 98+ | rien à faire (navigateurs compatibles WebGL 2) |
| `createImageBitmap` | décodage des images | Safari 15+ | rien à faire |
| `backdrop-filter` | matériaux translucides | préfixe `-webkit-` présent ; panneaux opaques sinon | rien à faire |
| `IntersectionObserver`, `ResizeObserver` | vignettes, bannière, scène | partout où c'est facultatif, l'absence est déjà vérifiée | rien à faire |
| `beforeinstallprompt` | installation de la PWA | absent de Safari et Firefox | **À faire** : explication iOS (« Partager › Sur l'écran d'accueil ») |

**Remarque** : le prompt cite `gif.js` et son worker. L'app utilise **gifenc**, sans worker, depuis la phase 6 (voir CLAUDE.md §4). La CSP n'a donc pas à autoriser de worker pour le GIF. `worker-src 'self'` suffit pour le service worker et le worker de traitement d'images.
