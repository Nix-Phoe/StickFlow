// Configuration de Vite : build de l'app (PWA, pages publiques) et serveur de développement.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Couleurs du manifeste, tirées des tokens (`--color-bg` clair : fond de l'app et de l'écran de lancement). */
const THEME_COLOR = '#f2f2f7';
const BACKGROUND_COLOR = '#f2f2f7';

export default defineConfig({
  define: {
    // Numéro de version affiché dans les Réglages et la page « À propos ».
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    // En développement, `/api/*` (proxy d'images) est servi par `wrangler dev` (npm run dev:api).
    proxy: { '/api': 'http://localhost:8787' },
  },
  plugins: [
    VitePWA({
      // Une nouvelle version attend l'accord de l'utilisateur (bannière), jamais de rechargement imposé.
      registerType: 'prompt',
      // L'enregistrement se fait dans src/app/pwa-update.ts (virtual:pwa-register).
      injectRegister: null,
      includeAssets: ['favicon.ico', 'app-icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'StickFlow',
        short_name: 'StickFlow',
        description: 'Animez des stickmans image par image, avec une IA qui assiste sans décider à votre place : frames intermédiaires, boucles fluides, export GIF et vidéo.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['entertainment', 'education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/editor-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'L’éditeur : scène, timeline et améliorations IA' },
          { src: 'screenshots/home-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'L’accueil : projets, modèles et vidéos' },
          { src: 'screenshots/home-narrow.png', sizes: '540x1170', type: 'image/png', form_factor: 'narrow', label: 'L’accueil sur téléphone' },
        ],
      },
      workbox: {
        // Toute l'app est pré-cachée : création, édition, sauvegarde et export marchent hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Les captures du manifeste et l'image de partage ne servent pas hors ligne.
        globIgnores: ['screenshots/**', 'og-image.png'],
        navigateFallback: 'index.html',
        // Le proxy d'images n'est jamais remplacé par l'app ; les pages publiques sont pré-cachées.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Recherche et import d'images : toujours le réseau ; hors ligne, l'onglet Internet le dit.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // Vignettes des résultats de recherche (Pexels, CORS autorisé) : gardées une semaine.
            urlPattern: ({ url }) => url.origin === 'https://images.pexels.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'stock-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
