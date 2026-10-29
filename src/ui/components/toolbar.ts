import '../styles/components/toolbar.css';

import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../core/types';
import { canRedo, canUndo } from '../../model/project';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { createSegmented } from '../controls/segmented';
import { h, ids } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.toolbar;

/** Barre supérieure : tiroir (petits écrans), bouton « Personnages & Environnement », annuler / rétablir, lecture / pause (un seul bouton), stop, vitesse. */
export function createToolbar({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];

  const menuButton = createIconButton({
    icon: 'menu',
    label: t.openDrawer,
    action: 'ui:drawer:toggle',
    variant: 'filled',
    className: 'toolbar__menu',
    onClick: () => bus.emit('ui:drawer:toggle', { open: !store.state.session.drawerOpen }),
  });
  menuButton.setAttribute('aria-controls', ids.sidePanel);

  // Ouvre le panneau « Personnages & Environnement » (ancré sous ce bouton). Bouton à libellé
  // visible, à côté des contrôles de lecture ; sur une barre étroite, il ne garde que ses icônes.
  const editorStrings = strings.editorPanel;
  const editorButton = h(
    'button',
    {
      type: 'button',
      id: ids.editorButton,
      class: 'toolbar__editor',
      // Le nom accessible commence par le libellé visible (WCAG 2.5.3), même quand il est masqué.
      'aria-label': `${editorStrings.buttonTitle} : ${editorStrings.open}`,
      title: editorStrings.open,
      'data-action': 'panel:toggle',
    },
    [
      h('span', { class: 'toolbar__editor-icons', 'aria-hidden': 'true' }, [icon('person'), icon('editor')]),
      h('span', { class: 'toolbar__editor-text' }, [
        h('span', { class: 'toolbar__editor-title' }, [editorStrings.buttonTitle]),
        h('span', { class: 'toolbar__editor-hint' }, [editorStrings.buttonHint]),
      ]),
      icon('down', 'icon toolbar__editor-chevron'),
    ],
  );
  editorButton.addEventListener('click', () => bus.emit('panel:toggle', { open: !store.state.session.panelOpen }));
  editorButton.setAttribute('aria-controls', ids.editorPanel);
  editorButton.setAttribute('aria-haspopup', 'dialog');

  const undoButton = createIconButton({
    icon: 'undo',
    label: t.undo,
    action: 'history:undo',
    variant: 'filled',
    onClick: () => bus.emit('history:undo'),
  });
  const redoButton = createIconButton({
    icon: 'redo',
    label: t.redo,
    action: 'history:redo',
    variant: 'filled',
    onClick: () => bus.emit('history:redo'),
  });
  // Bouton unique Lecture / Pause : les deux icônes sont superposées, la CSS fond l'une dans l'autre.
  const playButton = createIconButton({
    icon: 'play',
    label: t.play,
    action: 'playback:toggle',
    variant: 'filled',
    className: 'toolbar__play',
    onClick: () => bus.emit('playback:toggle'),
  });
  playButton.append(icon('pause', 'icon toolbar__pause-icon'));

  const stopButton = createIconButton({
    icon: 'stop',
    label: t.stop,
    action: 'playback:stop',
    variant: 'filled',
    onClick: () => bus.emit('playback:stop'),
  });

  const speedControl = createSegmented<PlaybackSpeed>({
    label: t.speed,
    action: 'playback:speed:change',
    className: 'toolbar__speed',
    options: PLAYBACK_SPEEDS.map((speed) => ({
      value: speed,
      label: t.speedValue(speed),
      ariaLabel: t.speedLabel(speed),
    })),
    value: store.state.session.playbackSpeed,
    onChange: (speed) => bus.emit('playback:speed:change', { speed }),
  });

  const root = h('div', { class: 'toolbar' }, [
    h('div', { class: 'toolbar__start' }, [menuButton]),
    h('div', { class: 'toolbar__center' }, [
      editorButton,
      h('div', { class: 'toolbar__controls' }, [
        h('div', { class: 'toolbar__group', role: 'group', 'aria-label': `${t.undo} / ${t.redo}` }, [
          undoButton,
          redoButton,
        ]),
        h('div', { class: 'toolbar__group', role: 'group', 'aria-label': t.playbackGroup }, [playButton, stopButton]),
        speedControl.element,
      ]),
    ]),
    h('div', { class: 'toolbar__end' }),
  ]);

  cleanups.push(
    store.watch(
      (s) => s.session.isPlaying,
      (isPlaying) => {
        const label = isPlaying ? t.pause : t.play;
        playButton.setAttribute('aria-pressed', String(isPlaying));
        playButton.setAttribute('aria-label', label);
        playButton.title = label;
      },
    ),
    store.watch((s) => s.session.playbackSpeed, (speed) => speedControl.setValue(speed)),
    store.watch((s) => s.session.drawerOpen, (open) => menuButton.setAttribute('aria-expanded', String(open))),
    store.watch((s) => s.session.panelOpen, (open) => editorButton.setAttribute('aria-expanded', String(open))),
    store.watch((s) => canUndo(s.project), (can) => (undoButton.disabled = !can)),
    store.watch((s) => canRedo(s.project), (can) => (redoButton.disabled = !can)),
  );

  // Raccourcis : Ctrl/⌘+S enregistrer, Ctrl/⌘+O ouvrir (partout, y compris dans un champ) ;
  // Espace lecture / pause ; Ctrl/⌘+Z annuler, Ctrl/⌘+Maj+Z ou Ctrl+Y rétablir.
  // Les champs de saisie gardent leurs autres raccourcis, et Espace active toujours les autres
  // boutons ; sur les boutons de lecture, Espace bascule lecture / pause (sinon il relancerait le bouton).
  const onShortcut = (event: KeyboardEvent): void => {
    const command = event.ctrlKey || event.metaKey;
    if (command && !event.shiftKey && !event.altKey && (event.key === 's' || event.key === 'o')) {
      event.preventDefault();
      bus.emit(event.key === 's' ? 'project:save' : 'project:library:request');
      return;
    }
    if (isEditable(event.target)) return;
    if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.target instanceof HTMLButtonElement && !event.target.dataset.action?.startsWith('playback:')) return;
      bus.emit('playback:toggle');
      event.preventDefault();
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) bus.emit('history:undo');
    else if ((key === 'z' && event.shiftKey) || key === 'y') bus.emit('history:redo');
    else return;
    event.preventDefault();
  };
  document.addEventListener('keydown', onShortcut);
  cleanups.push(() => document.removeEventListener('keydown', onShortcut));

  return {
    mount(parent) {
      parent.append(root);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
