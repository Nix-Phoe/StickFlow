// Variables d'environnement de l'app (voir .env.example).
/// <reference types="vite-plugin-pwa/client" />
interface ImportMetaEnv {
  /** Adresse du proxy d'images ; par défaut `/api`, servi par le même Worker que l'app (v2.2). */
  readonly VITE_IMAGE_PROXY_URL?: string;
}

/** Version de l'app, lue dans package.json au build (vite.config.ts). */
declare const __APP_VERSION__: string;
