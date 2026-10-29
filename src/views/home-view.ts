// Vue « Accueil » : retrouver ses projets et en créer de nouveaux.

import type { Route } from '../core/router';
import { createInitialState } from '../core/store';
import { createDefaultSkeleton, sortSkeleton } from '../model';
import type { ProjectLibrary } from '../storage';
import { h } from '../ui/dom';
import { strings } from '../ui/strings';
import type { View } from './view-host';

export interface HomeViewOptions {
  library: ProjectLibrary;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
}

export function createHomeView({ library, navigate }: HomeViewOptions): View {
  const list = h('ul', { class: 'home__list' });
  const create = h('button', { type: 'button', class: 'button-primary' }, [strings.home.create]);
  create.addEventListener('click', async () => {
    const { project } = createInitialState(strings.defaultProjectName, sortSkeleton(createDefaultSkeleton()), strings.characters.defaultName(1));
    const { id } = await library.save(project.present);
    navigate({ name: 'editor', projectId: id });
  });
  const root = h('main', { class: 'home' }, [h('h1', {}, [strings.appName]), create, list]);

  async function refresh(): Promise<void> {
    const entries = await library.list();
    list.replaceChildren(
      ...entries.map((entry) => {
        const open = h('button', { type: 'button', class: 'button-secondary' }, [entry.name]);
        open.addEventListener('click', () => navigate({ name: 'editor', projectId: entry.id }));
        return h('li', {}, [open]);
      }),
    );
  }

  return {
    mount(parent) {
      parent.append(root);
      document.title = strings.documentTitle.home;
      void refresh();
    },
    update: (route) => route.name !== 'editor',
    destroy() {
      root.remove();
    },
  };
}
