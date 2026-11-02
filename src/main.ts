// Point d'entrée : vérifie que le navigateur est compatible, ouvre la bibliothèque de projets et
// affiche la vue de la route (accueil, ou éditeur chargé à la demande).
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/controls.css';
import './ui/styles/sheet.css';
import './ui/styles/components/app.css';

import { registerSW } from 'virtual:pwa-register';

import { isReportableError, type GlobalErrorInfo } from './app/errors';
import { createInstaller } from './app/install';
import { createUpdateController } from './app/pwa-update';
import { browserHashPort, createRouter } from './core/router';
import { normalizePreferences } from './core/home-state';
import { supportsWebGL2 } from './render/webgl-support';
import { createIdbStore, createMemoryStore, createProjectLibrary } from './storage';
import { createAssetStore } from './storage/asset-store';
import { createLocalPreferences } from './storage/preferences';
import { createStorageProtection, protectOnSave } from './storage/storage-protection';
import { createVideoLibrary } from './storage/video-store';
import { createErrorDialog } from './ui/components/app/error-dialog';
import { showUnsupportedScreen } from './ui/components/app/unsupported-screen';
import { mountUpdateBanner } from './ui/components/app/update-banner';
import { applyTheme } from './ui/theme';
import { createHomeView } from './views/home-view';
import { createViewHost } from './views/view-host';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Élément #app introuvable');

// Préférences de l'appareil (thème, tri, vue, format par défaut) : le thème s'applique dès le départ.
const preferences = createLocalPreferences();
applyTheme(normalizePreferences(preferences.load()).theme);

if (supportsWebGL2()) start(root);
else showUnsupportedScreen(root);

function start(root: HTMLElement): void {
  // IndexedDB si le navigateur l'autorise (absent en navigation privée sur certains navigateurs) ;
  // sinon les projets ne vivent que le temps de la session.
  const persistent = typeof indexedDB !== 'undefined';
  // Le navigateur peut vider IndexedDB s'il manque de place : après la première sauvegarde, on lui
  // demande de garder les données de l'app (stockage protégé, v2.2).
  const protection = createStorageProtection(persistent ? navigator.storage : undefined);
  const library = protectOnSave(
    createProjectLibrary(persistent ? createIdbStore() : createMemoryStore(), {
      index: persistent ? createIdbStore('stickflow-index', 'projects') : createMemoryStore(),
    }),
    protection,
  );
  // Vidéos exportées, gardées en Blob dans une base à part.
  const videos = createVideoLibrary(persistent ? createIdbStore('stickflow-videos', 'videos') : createMemoryStore());
  // Images d'arrière-plan (v2.1), elles aussi en Blob dans leur propre base.
  const assets = createAssetStore(persistent ? createIdbStore('stickflow-assets', 'assets') : createMemoryStore());

  // `beforeinstallprompt` peut arriver avant l'affichage de l'accueil : l'installeur l'attend dès maintenant.
  const installer = createInstaller(window);

  const router = createRouter(browserHashPort(), (route) => void host.show(route));
  const navigate = router.navigate;
  // L'éditeur (rendu WebGL, dessin, export) n'est chargé qu'à son ouverture : l'accueil s'affiche plus vite.
  const host = createViewHost(root, async (route) =>
    route.name === 'editor'
      ? (await import('./views/editor-view')).createEditorView({ projectId: route.projectId, library, videos, assets, navigate })
      : createHomeView({ section: route.name, library, preferences, videos, assets, protection, installer, navigate }),
  );

  // Erreur imprévue : proposer de recharger, après avoir enregistré le projet ouvert.
  const errorDialog = createErrorDialog(document.body, { onReload: () => host.save().catch(() => undefined) });
  const report = (info: GlobalErrorInfo, error: unknown): void => {
    if (!isReportableError(info)) return;
    console.error('[app]', error);
    errorDialog.show(error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? info.message));
  };
  window.addEventListener('error', (event) => report({ message: event.message, filename: event.filename }, event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => report({ reason: event.reason }, event.reason));

  // Nouvelle version (service worker en attente) : bannière, puis enregistrement avant de recharger.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    mountUpdateBanner(document.body, createUpdateController({ register: registerSW, save: () => host.save() }));
  }

  router.start();
}
