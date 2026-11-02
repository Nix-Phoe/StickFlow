// Hôte des vues : monte la vue de la route, et passe d'une vue à l'autre proprement
// (sauvegarde de la vue qui part, puis destruction, puis montage de la suivante).

import type { Route } from '../core/router';

/** Une page de l'application (accueil, éditeur). */
export interface View {
  mount(parent: HTMLElement): void;
  /** Libère tout : écouteurs, boucle de rendu, contexte WebGL. */
  destroy(): void;
  /** La vue affiche-t-elle elle-même cette route (section de l'accueil, même projet) ? */
  update?(route: Route): boolean;
  /** Avant la destruction : la vue finit son travail (sauvegarde automatique). */
  leave?(): Promise<void>;
}

export interface ViewHost {
  /** Affiche la route ; les appels se suivent, et une route dépassée par une plus récente est ignorée. */
  show(route: Route): Promise<void>;
  /** La vue affichée finit son travail (sauvegarde) sans être quittée : avant un rechargement de la page. */
  save(): Promise<void>;
}

/** Crée la vue d'une route ; une vue chargée à la demande (l'éditeur, v2.2) arrive par une promesse. */
export type ViewFactory = (route: Route) => View | Promise<View>;

export function createViewHost(parent: HTMLElement, create: ViewFactory): ViewHost {
  let current: View | null = null;
  let latest: Route | null = null;
  let queue: Promise<void> = Promise.resolve();

  async function apply(route: Route): Promise<void> {
    if (route !== latest) return;
    if (current?.update?.(route)) return;
    if (current) {
      try {
        await current.leave?.();
      } catch (error) {
        console.error('[views] Sortie de la vue :', error);
      }
      current.destroy();
      current = null;
    }
    // Une route plus récente est arrivée pendant la sortie : c'est elle qu'on montera.
    if (latest !== route) return;
    const view = await create(route);
    // … ou pendant le chargement de la vue : celle-ci n'est jamais montée.
    if (latest !== route) return;
    current = view;
    current.mount(parent);
  }

  return {
    show(route) {
      latest = route;
      queue = queue.then(() => apply(route));
      return queue;
    },
    async save() {
      await current?.leave?.();
    },
  };
}
