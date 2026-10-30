import type { Component } from '../../component';
import { h } from '../../dom';
import { icon } from '../../icons';
import { strings } from '../../strings';
import { imageFileOf } from '../../transfer';
import { gridKeyboard, type BackgroundContext } from './context';

const t = strings.background;
/** Types proposés par le sélecteur de fichiers (le contenu est revérifié à l'import). */
export const IMAGE_ACCEPT = 'image/png, image/jpeg, image/webp';

/**
 * Onglet Appareil : « Choisir une image » (galerie et appareil photo sur mobile), glisser-déposer
 * sur l'onglet, et les 8 images récentes à réappliquer. Le collage (Ctrl/⌘+V) et le dépôt sur la
 * scène sont gérés par la zone de la scène.
 */
export function createDevicePane({ bus, store }: BackgroundContext): Component {
  const input = h('input', { type: 'file', accept: IMAGE_ACCEPT, class: 'visually-hidden', tabindex: -1, 'aria-hidden': 'true' });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) bus.emit('asset:import', { file, source: 'device' });
    input.value = '';
  });
  const choose = h('button', { type: 'button', class: 'button-primary background-pane__choose', 'data-action': 'asset:import' }, [icon('upload'), t.choose]);
  choose.addEventListener('click', () => input.click());

  const drop = h('div', { class: 'background-drop' }, [
    choose,
    input,
    h('p', { class: 'background-pane__hint' }, [t.dropHint]),
    h('p', { class: 'background-pane__hint' }, [t.formatsHint]),
  ]);
  drop.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    drop.classList.add('is-dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
    const file = imageFileOf(event.dataTransfer);
    if (file) bus.emit('asset:import', { file, source: 'device' });
  });

  const recents = h('div', { class: 'background-grid background-grid--recents', role: 'group', 'aria-labelledby': 'background-recents' });
  gridKeyboard(recents);
  const empty = h('p', { class: 'background-pane__hint' }, [t.noRecents]);
  const root = h('div', { class: 'background-pane' }, [
    drop,
    h('h4', { class: 'editor-panel__section-title', id: 'background-recents' }, [t.recents]),
    recents,
    empty,
  ]);

  function renderRecents(): void {
    const { recentAssets } = store.state.session;
    const background = store.state.project.present.environment.background;
    const current = background?.type === 'image' ? background.assetId : null;
    recents.replaceChildren(
      ...recentAssets.map((asset, i) => {
        const button = h('button', { type: 'button', class: 'background-tile background-tile--recent', 'aria-pressed': String(asset.id === current), 'data-action': 'asset:apply' }, [
          asset.thumbnail ? h('img', { class: 'background-tile__image', src: asset.thumbnail, alt: t.recent(i + 1) }) : h('span', { 'aria-label': t.recent(i + 1) }, [icon('image')]),
        ]);
        button.addEventListener('click', () => bus.emit('asset:apply', { assetId: asset.id }));
        return button;
      }),
    );
    empty.hidden = recentAssets.length > 0;
  }

  const stops = [
    store.watch((s) => s.session.recentAssets, renderRecents),
    store.watch((s) => s.project.present.environment.background, renderRecents),
    store.watch(
      (s) => s.session.assetImport.status === 'busy',
      (busy) => {
        choose.disabled = busy;
        root.setAttribute('aria-busy', String(busy));
      },
    ),
  ];

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      stops.forEach((stop) => stop());
      root.remove();
    },
  };
}
