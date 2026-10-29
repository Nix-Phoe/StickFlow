// Routeur minimal par hash : l'accueil (et ses sections) ou l'éditeur d'un projet.
// Sans DOM : l'emplacement (`location.hash`) passe par un port, injecté.

export type HomeSection = 'home' | 'projects' | 'templates' | 'videos';

export type Route = { name: HomeSection } | { name: 'editor'; projectId: string };

export const HOME_SECTIONS: readonly HomeSection[] = ['home', 'projects', 'templates', 'videos'];

/** Lit un hash (« #/editor/abc ») ; tout ce qui n'est pas reconnu mène à l'accueil. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [first = '', second, ...rest] = path.split('/');
  if (first === 'editor' && second && rest.length === 0) {
    try {
      return { name: 'editor', projectId: decodeURIComponent(second) };
    } catch {
      return { name: 'home' };
    }
  }
  if (second === undefined && (HOME_SECTIONS as readonly string[]).includes(first) && first !== 'home') {
    return { name: first as HomeSection };
  }
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  if (route.name === 'editor') return `#/editor/${encodeURIComponent(route.projectId)}`;
  return route.name === 'home' ? '#/' : `#/${route.name}`;
}

/** Accès à l'emplacement : `window.location` en production, faux en test. */
export interface HashPort {
  read(): string;
  /** Nouvelle entrée d'historique (le bouton retour y revient) ; annonce le changement. */
  push(hash: string): void;
  /** Remplace l'entrée courante sans l'annoncer. */
  replace(hash: string): void;
  /** Changement d'emplacement (retour, avance, lien) ; renvoie la fonction de désabonnement. */
  subscribe(listener: () => void): () => void;
}

export interface Router {
  current(): Route;
  navigate(route: Route, options?: { replace?: boolean }): void;
  /** Annonce la route actuelle, puis chaque changement ; renvoie la fonction d'arrêt. */
  start(): () => void;
}

export function createRouter(port: HashPort, onRoute: (route: Route) => void): Router {
  const announce = (): void => onRoute(parseRoute(port.read()));
  return {
    current: () => parseRoute(port.read()),
    navigate(route, { replace = false } = {}) {
      const hash = routeToHash(route);
      if (replace) port.replace(hash);
      else port.push(hash);
    },
    start() {
      const stop = port.subscribe(announce);
      announce();
      return stop;
    },
  };
}

/** Port du navigateur : `location.hash` et l'événement `hashchange`. */
export function browserHashPort(): HashPort {
  return {
    read: () => window.location.hash,
    push: (hash) => {
      // Même hash : le navigateur n'émet pas `hashchange`, il n'y a rien à annoncer.
      if (window.location.hash !== hash) window.location.hash = hash;
    },
    replace: (hash) => window.history.replaceState(window.history.state, '', hash),
    subscribe: (listener) => {
      window.addEventListener('hashchange', listener);
      return () => window.removeEventListener('hashchange', listener);
    },
  };
}
