// Variables d'environnement de l'app (voir .env.example).
interface ImportMetaEnv {
  /** Adresse du proxy d'images (server/image-proxy) ; absente : recherche non configurée. */
  readonly VITE_IMAGE_PROXY_URL?: string;
}
