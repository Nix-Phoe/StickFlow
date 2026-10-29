import '../styles/components/editor-panel.css';

import { EDITOR_MODES, type EditorMode } from '../../core/types';
import type { Component, ComponentContext } from '../component';
import { createIconButton } from '../controls/icon-button';
import { createSegmented } from '../controls/segmented';
import { h, ids, SHEET_MEDIA_QUERY, STACKED_MEDIA_QUERY } from '../dom';
import { strings } from '../strings';

const t = strings.editorPanel;

/**
 * Panneau flottant « Personnages & Environnement » : popover ancré sous son bouton (feuille du
 * bas sur téléphone), avec un contrôle segmenté qui choisit le mode d'édition de la scène.
 * Les onglets sont des composants à part, montés dans `ids.charactersTab` / `ids.environmentTab`.
 * Raccourcis (hors champ de saisie) : C Personnages, E Environnement, Tab bascule (quand aucun
 * élément n'a le focus, pour ne pas gêner la navigation au clavier), Échap ferme le panneau,
 * Suppr supprime et Ctrl/⌘+D duplique l'élément sélectionné sur la scène.
 */
export function createEditorPanel({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  const sheetQuery = window.matchMedia(SHEET_MEDIA_QUERY);
  const stackedQuery = window.matchMedia(STACKED_MEDIA_QUERY);

  const tabs = createSegmented<EditorMode>({
    label: t.tabs,
    action: 'editMode:change',
    className: 'editor-panel__tabs',
    options: EDITOR_MODES.map((mode) => ({ value: mode, label: strings.modes[mode] })),
    value: store.state.session.editorMode,
    onChange: (mode) => bus.emit('editMode:change', { mode }),
  });
  const closeButton = createIconButton({
    icon: 'close',
    label: t.close,
    action: 'panel:toggle',
    variant: 'filled',
    onClick: () => bus.emit('panel:toggle', { open: false }),
  });

  const slots: Record<EditorMode, HTMLElement> = {
    characters: h('div', { class: 'editor-panel__tab', id: ids.charactersTab, role: 'region', 'aria-label': strings.modes.characters }),
    environment: h('div', { class: 'editor-panel__tab', id: ids.environmentTab, role: 'region', 'aria-label': strings.modes.environment }),
  };

  const panel = h(
    'section',
    { class: 'editor-panel', id: ids.editorPanel, role: 'dialog', 'aria-label': t.title, hidden: true },
    [
      h('header', { class: 'editor-panel__header' }, [tabs.element, closeButton]),
      h('div', { class: 'editor-panel__body' }, [slots.characters, slots.environment]),
    ],
  );

  /** Ancre le popover sous son bouton, sans dépasser de la fenêtre. */
  function position(): void {
    const button = document.getElementById(ids.editorButton);
    if (!button || sheetQuery.matches) return;
    const rect = button.getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(panel).getPropertyValue('--space-2')) || 0;
    const left = Math.min(Math.max(gutter, rect.left), window.innerWidth - panel.offsetWidth - gutter);
    panel.style.setProperty('--editor-panel-top', `${rect.bottom + gutter / 2}px`);
    panel.style.setProperty('--editor-panel-left', `${Math.max(gutter, left)}px`);
  }

  function applyOpen(open: boolean): void {
    const wasOpen = !panel.hidden;
    panel.hidden = !open;
    if (open) {
      position();
      // En revenant de la fenêtre « Coloration partielle », c'est elle qui rend le focus.
      const fromPaintWindow = document.getElementById(ids.partialPaintWindow)?.contains(document.activeElement) ?? false;
      if (!wasOpen && !fromPaintWindow) panel.querySelector<HTMLElement>('.segmented__item[aria-checked="true"]')?.focus();
    } else if (wasOpen && panel.contains(document.activeElement)) {
      document.getElementById(ids.editorButton)?.focus();
    }
  }

  function applyMode(mode: EditorMode): void {
    tabs.setValue(mode);
    for (const [key, slot] of Object.entries(slots)) slot.hidden = key !== mode;
  }

  // ---------- Raccourcis ----------
  const onKeydown = (event: KeyboardEvent): void => {
    const { session } = store.state;
    // Échap ferme d'abord la fenêtre « Coloration partielle », puis le panneau, d'où que vienne la
    // touche (y compris d'un champ).
    if (event.key === 'Escape' && session.partialPaint.open) {
      bus.emit('partialPaint:change', { open: false });
      return;
    }
    if (event.key === 'Escape' && session.panelOpen) {
      bus.emit('panel:toggle', { open: false });
      return;
    }
    if (event.defaultPrevented || isEditable(event.target)) return;
    const command = event.ctrlKey || event.metaKey;
    if (command && !event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (command || event.altKey) return;

    // Suppr, Tab : seulement sur la scène (ou sans focus), pour ne pas voler ces touches aux autres contrôles.
    const onStage = event.target === document.body || (event.target instanceof HTMLElement && event.target.id === ids.stage);
    if ((event.key === 'Delete' || event.key === 'Backspace') && onStage) {
      event.preventDefault();
      deleteSelection();
    } else if (event.key === 'Tab' && !event.shiftKey && event.target === document.body) {
      event.preventDefault();
      bus.emit('editMode:change', { mode: session.editorMode === 'characters' ? 'environment' : 'characters' });
    } else if (event.key === 'c' || event.key === 'C') {
      bus.emit('editMode:change', { mode: 'characters' });
    } else if (event.key === 'e' || event.key === 'E') {
      bus.emit('editMode:change', { mode: 'environment' });
    }
  };

  function deleteSelection(): void {
    const { session, project } = store.state;
    if (session.editorMode === 'environment' && session.selectedShapeId) {
      bus.emit('shape:remove', { shapeId: session.selectedShapeId });
      return;
    }
    const character = project.present.characters.find((c) => c.id === session.selectedCharacterId);
    // Supprimer un personnage retire toutes ses poses : on demande confirmation.
    if (session.editorMode === 'characters' && character && project.present.characters.length > 1) {
      if (window.confirm(strings.characters.confirmRemove(character.name))) {
        bus.emit('character:remove', { characterId: character.id });
      }
    }
  }

  function duplicateSelection(): void {
    const { session, project } = store.state;
    if (session.editorMode === 'environment' && session.selectedShapeId) {
      bus.emit('shape:duplicate', { shapeId: session.selectedShapeId });
      return;
    }
    const character = project.present.characters.find((c) => c.id === session.selectedCharacterId);
    if (session.editorMode === 'characters' && character) {
      bus.emit('character:duplicate', { characterId: character.id, name: strings.characters.copyName(character.name) });
    }
  }

  const shown = (): boolean => store.state.session.panelOpen && !(store.state.session.partialPaint.open && stackedQuery.matches);
  const onStackedChange = (): void => applyOpen(shown());
  stackedQuery.addEventListener('change', onStackedChange);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', position);
  cleanups.push(
    () => stackedQuery.removeEventListener('change', onStackedChange),
    () => document.removeEventListener('keydown', onKeydown),
    () => window.removeEventListener('resize', position),
    // Sans place pour les deux, la fenêtre « Coloration partielle » prend la place du panneau.
    store.watch((s) => s.session.panelOpen && !(s.session.partialPaint.open && stackedQuery.matches), applyOpen),
    store.watch((s) => s.session.editorMode, applyMode),
  );

  return {
    mount(parent) {
      parent.append(panel);
      applyOpen(shown());
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      panel.remove();
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
