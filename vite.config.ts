// Configuration de Vite : build de l'app (PWA, pages publiques) et serveur de développement.
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    // Numéro de version affiché dans les Réglages et la page « À propos ».
    __APP_VERSION__: JSON.stringify(version),
  },
});
