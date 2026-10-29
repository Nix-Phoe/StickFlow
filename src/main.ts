// Point d'entrée : ouvre la bibliothèque de projets et affiche la vue de la route (accueil ou éditeur).
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/controls.css';

import { browserHashPort, createRouter } from './core/router';
import { createIdbStore, createMemoryStore, createProjectLibrary } from './storage';
import { createEditorView } from './views/editor-view';
import { createHomeView } from './views/home-view';
import { createViewHost } from './views/view-host';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Élément #app introuvable');

// IndexedDB si le navigateur l'autorise (absent en navigation privée sur certains navigateurs) ;
// sinon les projets ne vivent que le temps de la session.
const persistent = typeof indexedDB !== 'undefined';
const library = createProjectLibrary(persistent ? createIdbStore() : createMemoryStore(), {
  index: persistent ? createIdbStore('stickflow-index', 'projects') : createMemoryStore(),
});

const router = createRouter(browserHashPort(), (route) => void host.show(route));
const navigate = router.navigate;
const host = createViewHost(root, (route) =>
  route.name === 'editor'
    ? createEditorView({ projectId: route.projectId, library, navigate })
    : createHomeView({ library, navigate }),
);
router.start();
