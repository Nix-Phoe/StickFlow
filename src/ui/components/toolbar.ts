import '../styles/components/toolbar.css';

import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../../core/types';
import { canRedo, canUndo } from '../../model/project';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { createSegmented } from '../controls/segmented';
import { h, ids } from '../dom';
import { strings } from '../strings';

const t = strings.toolbar;

/** Barre supérieure : tiroir (petits écrans), annuler / rétablir, lecture / pause, vitesse. */
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
  const playButton = createIconButton({
    icon: 'play',
    label: t.play,
    action: 'playback:play',
    variant: 'filled',
    onClick: () => bus.emit('playback:play'),
  });
  const pauseButton = createIconButton({
    icon: 'pause',
    label: t.pause,
    action: 'playback:pause',
    variant: 'filled',
    onClick: () => bus.emit('playback:pause'),
  });

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
      h('div', { class: 'toolbar__group', role: 'group', 'aria-label': `${t.undo} / ${t.redo}` }, [
        undoButton,
        redoButton,
      ]),
      h('div', { class: 'toolbar__group', role: 'group', 'aria-label': `${t.play} / ${t.pause}` }, [
        playButton,
        pauseButton,
        stopButton,
      ]),
      speedControl.element,
    ]),
    h('div', { class: 'toolbar__end' }),
  ]);

  cleanups.push(
    store.watch(
      (s) => s.session.isPlaying,
      (isPlaying) => {
        playButton.setAttribute('aria-pressed', String(isPlaying));
        pauseButton.setAttribute('aria-pressed', String(!isPlaying));
      },
    ),
    store.watch((s) => s.session.playbackSpeed, (speed) => speedControl.setValue(speed)),
    store.watch((s) => s.session.drawerOpen, (open) => menuButton.setAttribute('aria-expanded', String(open))),
    store.watch((s) => canUndo(s.project), (can) => (undoButton.disabled = !can)),
    store.watch((s) => canRedo(s.project), (can) => (redoButton.disabled = !can)),
  );

  // Raccourcis : Espace lecture / pause ; Ctrl/⌘+Z annuler, Ctrl/⌘+Maj+Z ou Ctrl+Y rétablir.
  // Les champs de saisie gardent leurs raccourcis, et Espace active toujours les autres boutons ;
  // sur les boutons de lecture, Espace bascule lecture / pause (sinon il relancerait le bouton).
  const onShortcut = (event: KeyboardEvent): void => {
    if (isEditable(event.target)) return;
    if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.target instanceof HTMLButtonElement && !event.target.dataset.action?.startsWith('playback:')) return;
      bus.emit(store.state.session.isPlaying ? 'playback:pause' : 'playback:play');
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
