import type { AppEventBus } from '../core/events';
import type { Store } from '../core/store';

/** Contrat commun des composants d'interface. */
export interface Component {
  mount(parent: HTMLElement): void;
  destroy(): void;
}

/** Dépendances injectées dans chaque composant : il émet sur le bus et lit le store. */
export interface ComponentContext {
  bus: AppEventBus;
  store: Store;
}
