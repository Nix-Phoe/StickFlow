// Mises à jour de la PWA (v2.2) : le service worker d'une nouvelle version attend (registerType
// « prompt »). L'app l'annonce par une bannière ; « Mettre à jour » enregistre le projet ouvert,
// puis active la nouvelle version et recharge. Jamais de rechargement sans l'accord de l'utilisateur.

/** `registerSW` de `virtual:pwa-register` (injecté : les tests n'ont pas de service worker). */
export type RegisterServiceWorker = (options: {
  onNeedRefresh?: () => void;
  onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void;
}) => (reloadPage?: boolean) => Promise<void>;

export interface UpdateController {
  subscribe(listener: (available: boolean) => void): () => void;
  /** Enregistre le travail en cours, puis passe à la nouvelle version (la page se recharge). */
  apply(): Promise<void>;
  /** « Plus tard » : la bannière se cache ; la nouvelle version s'appliquera au prochain lancement. */
  dismiss(): void;
}

/** Fréquence à laquelle une session ouverte longtemps cherche une nouvelle version. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function createUpdateController({ register, save }: { register: RegisterServiceWorker; save: () => Promise<void> }): UpdateController {
  const listeners = new Set<(available: boolean) => void>();
  const notify = (available: boolean): void => listeners.forEach((listener) => listener(available));

  const update = register({
    onNeedRefresh: () => notify(true),
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update().catch(() => undefined), CHECK_INTERVAL_MS);
    },
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async apply() {
      try {
        await save();
      } catch (error) {
        console.error('[update] Enregistrement avant la mise à jour :', error);
      }
      await update(true);
    },
    dismiss: () => notify(false),
  };
}
