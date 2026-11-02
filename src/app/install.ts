// Installation de la PWA (v2.2). Chrome, Edge et Android proposent leur fenêtre d'installation
// (`beforeinstallprompt`), que l'on garde pour l'ouvrir depuis un bouton ; Safari sur iPhone et iPad
// n'en a pas : l'app y explique « Partager › Sur l'écran d'accueil ».

/** Ce que l'app peut proposer : déjà installée, fenêtre du navigateur, explication iOS, ou rien. */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'unavailable';

export function installMode({ standalone, ios, promptAvailable }: { standalone: boolean; ios: boolean; promptAvailable: boolean }): InstallMode {
  if (standalone) return 'installed';
  if (promptAvailable) return 'prompt';
  return ios ? 'ios' : 'unavailable';
}

/** iPhone, iPod, iPad (y compris l'iPad qui se présente comme un Mac, mais tactile). */
export function isIosDevice({ userAgent, maxTouchPoints }: { userAgent: string; maxTouchPoints: number }): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** L'événement `beforeinstallprompt` (pas encore dans les types du DOM). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface Installer {
  mode(): InstallMode;
  subscribe(listener: (mode: InstallMode) => void): () => void;
  /** Ouvre la fenêtre d'installation du navigateur ; `true` si l'utilisateur accepte. */
  prompt(): Promise<boolean>;
}

/** La partie de `window` utile ici. */
export interface InstallWindow extends EventTarget {
  matchMedia(query: string): { matches: boolean };
  navigator: { userAgent: string; maxTouchPoints: number; standalone?: boolean };
}

/** À créer au démarrage : `beforeinstallprompt` peut arriver avant que l'accueil soit affiché. */
export function createInstaller(win: InstallWindow): Installer {
  const listeners = new Set<(mode: InstallMode) => void>();
  const ios = isIosDevice(win.navigator);
  let deferred: InstallPromptEvent | null = null;
  let installed = win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true;

  const mode = (): InstallMode => installMode({ standalone: installed, ios, promptAvailable: deferred !== null });
  const changed = (): void => listeners.forEach((listener) => listener(mode()));

  win.addEventListener('beforeinstallprompt', (event) => {
    // Pas de mini-barre du navigateur : l'app propose l'installation elle-même, sans insister.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    changed();
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    changed();
  });

  return {
    mode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async prompt() {
      const event = deferred;
      if (!event) return false;
      // Une fenêtre d'installation ne sert qu'une fois.
      deferred = null;
      changed();
      await event.prompt();
      return (await event.userChoice).outcome === 'accepted';
    },
  };
}
