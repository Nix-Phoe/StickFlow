import '../styles/components/characters-tab.css';

import { LIMITS, type Character } from '../../core/types';
import { partColor, restSize } from '../../model/character';
import { normalizeHex, PRESET_COLORS } from '../../model/color';
import { STAGE_WORLD_HEIGHT } from '../../render/camera';
import { paintCharacterPreview, previewFraming } from '../../render/character-preview';
import { parseHexColor } from '../../render/color';
import type { Component, ComponentContext } from '../component';
import { createColorPicker, swatch } from '../controls/color-picker';
import { createIconButton } from '../controls/icon-button';
import { createPartChips } from '../controls/part-chips';
import { createSlider } from '../controls/slider';
import { h, ids } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.characters;
const a = strings.appearance;
/** Token de la couleur automatique (celle du thème). */
const AUTO_COLOR_TOKEN = '--color-stickman';

interface Row {
  item: HTMLLIElement;
  select: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  name: HTMLInputElement;
  visibility: HTMLButtonElement;
  lock: HTMLButtonElement;
  character: Character | null;
}

/**
 * Onglet « Personnages » du panneau flottant : liste des personnages (vignette, nom modifiable,
 * visibilité, verrou), ajout, actions sur le personnage sélectionné, puis inspecteur Apparence
 * (parties à colorer, couleur, accès à la coloration partielle, taille de 50 à 200 %).
 */
export function createCharactersTab({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  const rows = new Map<string, Row>();
  const selected = (): Character | undefined =>
    store.state.project.present.characters.find((c) => c.id === store.state.session.selectedCharacterId);

  // ---------- Liste ----------
  const list = h('ul', { class: 'character-list', 'aria-label': t.list });
  const addButton = h('button', { type: 'button', class: 'button-secondary character-list__add', 'data-action': 'character:add' }, [
    icon('addCharacter'),
    t.add,
  ]);
  addButton.addEventListener('click', () =>
    bus.emit('character:add', { name: t.defaultName(store.state.project.present.characters.length + 1) }),
  );

  function createRow(id: string): Row {
    const canvas = h('canvas', { class: 'character-row__thumb', 'aria-hidden': 'true' });
    const select = h('button', { type: 'button', class: 'character-row__select', 'data-action': 'character:select' }, [canvas]);
    select.addEventListener('click', () => bus.emit('character:select', { characterId: id }));
    const name = h('input', {
      type: 'text',
      class: 'character-row__name',
      maxlength: LIMITS.characterNameLength,
      autocomplete: 'off',
      spellcheck: false,
      'data-action': 'character:rename',
    });
    name.addEventListener('focus', () => bus.emit('character:select', { characterId: id }));
    name.addEventListener('input', () => bus.emit('character:rename', { characterId: id, name: name.value }));
    // Un nom vide est refusé : en quittant le champ, il retrouve le nom du personnage.
    name.addEventListener('change', () => (name.value = rows.get(id)?.character?.name ?? name.value));
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') name.blur();
    });
    const toggle = (action: string, onClick: () => void): HTMLButtonElement => {
      const button = h('button', { type: 'button', class: 'icon-button character-row__toggle', 'data-action': action });
      button.addEventListener('click', onClick);
      return button;
    };
    const visibility = toggle('character:visibility', () => {
      const character = rows.get(id)?.character;
      if (character) bus.emit('character:visibility', { characterId: id, visible: !character.visible });
    });
    const lock = toggle('character:lock', () => {
      const character = rows.get(id)?.character;
      if (character) bus.emit('character:lock', { characterId: id, locked: !character.locked });
    });
    const item = h('li', { class: 'character-row', 'data-character-id': id }, [select, name, visibility, lock]);
    return { item, select, canvas, name, visibility, lock, character: null };
  }

  function updateRow(row: Row, character: Character, isSelected: boolean): void {
    const changed = row.character !== character;
    row.character = character;
    row.item.classList.toggle('is-selected', isSelected);
    row.item.classList.toggle('is-hidden', !character.visible);
    row.select.setAttribute('aria-pressed', String(isSelected));
    row.select.setAttribute('aria-label', t.select(character.name));
    row.name.setAttribute('aria-label', t.name(character.name));
    if (document.activeElement !== row.name) row.name.value = character.name;
    setToggle(row.visibility, character.visible ? 'visible' : 'hidden', character.visible ? t.hide(character.name) : t.show(character.name), !character.visible);
    setToggle(row.lock, character.locked ? 'locked' : 'unlocked', character.locked ? t.unlock(character.name) : t.lock(character.name), character.locked);
    if (changed) paintRow(row);
  }

  function paintRow(row: Row): void {
    const character = row.character;
    const context = row.canvas.getContext('2d');
    if (!character || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(row.canvas.clientWidth * ratio);
    const height = Math.round(row.canvas.clientHeight * ratio);
    if (width === 0 || height === 0) return;
    row.canvas.width = width;
    row.canvas.height = height;
    context.clearRect(0, 0, width, height);
    // Vignette dans la pose de repos, agrandie, avec ses vraies couleurs et ses zones de couleur.
    const viewport = { width, height };
    const auto = parseHexColor(autoColor());
    paintCharacterPreview(context, viewport, previewFraming(character, viewport), { stickman: auto, accent: auto });
  }

  function syncList(): void {
    const { characters } = store.state.project.present;
    const selectedId = store.state.session.selectedCharacterId;
    // Le premier de la liste est le plus au-dessus de la scène, comme dans les calques d'un logiciel de dessin.
    const ordered = characters.toReversed().map((character) => {
      let row = rows.get(character.id);
      if (!row) {
        row = createRow(character.id);
        rows.set(character.id, row);
      }
      updateRow(row, character, character.id === selectedId);
      return row.item;
    });
    for (const id of rows.keys()) if (!characters.some((c) => c.id === id)) rows.delete(id);
    if (ordered.length !== list.children.length || ordered.some((item, i) => list.children[i] !== item)) list.replaceChildren(...ordered);
  }

  // ---------- Actions sur le personnage sélectionné ----------
  const action = (iconName: Parameters<typeof icon>[0], label: string, name: string, onClick: (c: Character) => void) =>
    createIconButton({ icon: iconName, label, action: name, variant: 'filled', onClick: () => {
      const character = selected();
      if (character) onClick(character);
    } });
  const duplicateButton = action('copy', t.duplicate, 'character:duplicate', (c) =>
    bus.emit('character:duplicate', { characterId: c.id, name: t.copyName(c.name) }),
  );
  const upButton = action('up', t.moveUp, 'character:reorder', (c) => bus.emit('character:reorder', { characterId: c.id, direction: 1 }));
  const downButton = action('down', t.moveDown, 'character:reorder', (c) =>
    bus.emit('character:reorder', { characterId: c.id, direction: -1 }),
  );
  const removeButton = action('trash', t.remove, 'character:remove', (c) => {
    if (window.confirm(t.confirmRemove(c.name))) bus.emit('character:remove', { characterId: c.id });
  });
  const actions = h('div', { class: 'characters-tab__actions', role: 'group', 'aria-label': t.actions }, [
    duplicateButton,
    upButton,
    downButton,
    removeButton,
  ]);

  // ---------- Apparence ----------
  const selectionLabel = h('p', { class: 'appearance__selection', 'aria-live': 'polite' });
  // Choix des parties sans passer par la scène (synchronisé avec elle).
  const partChips = createPartChips({
    label: t.parts,
    action: 'segment:select',
    name: a.part,
    wholeLabel: t.whole,
    order: Object.keys(strings.parts),
    onSelect: (nodeId, additive) => {
      const character = selected();
      if (character) bus.emit('segment:select', { characterId: character.id, nodeId, additive: additive && nodeId !== null });
    },
  });
  const autoSwatch = h('button', { type: 'button', class: 'swatch swatch--auto', 'aria-label': a.automatic, title: a.automatic, 'data-color': '' });
  const swatches = h('div', { class: 'appearance__swatches', role: 'group', 'aria-label': a.swatches }, [
    autoSwatch,
    ...PRESET_COLORS.map((hex) => swatch(hex, a.swatch)),
  ]);
  swatches.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-color]') : null;
    if (!target) return;
    applyColor(target.dataset.color ? target.dataset.color : null, true);
  });

  const hexInput = h('input', { type: 'text', class: 'appearance__hex', maxlength: 7, autocomplete: 'off', spellcheck: false, 'aria-label': a.hex, 'data-action': 'appearance:color' });
  hexInput.addEventListener('change', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) applyColor(hex, true);
    else renderAppearance();
  });
  const paletteButton = h('button', { type: 'button', class: 'button-secondary', 'aria-expanded': 'false', 'data-action': 'appearance:color' }, [icon('palette'), a.openPalette]);
  const picker = createColorPicker({
    id: 'appearance-color',
    action: 'appearance:color',
    value: '#000000',
    recent: store.state.project.present.recentColors,
    bus,
    onChange: (hex) => applyColor(hex, false),
    onCommit: (hex) => applyColor(hex, true),
  });
  picker.element.hidden = true;
  paletteButton.addEventListener('click', () => {
    picker.element.hidden = !picker.element.hidden;
    paletteButton.setAttribute('aria-expanded', String(!picker.element.hidden));
  });
  const applyAllButton = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'appearance:color' }, [a.applyToAll]);
  applyAllButton.addEventListener('click', () => {
    const character = selected();
    if (character) applyColor(currentColor(character), true, []);
  });

  // Accès à la fenêtre « Coloration partielle ».
  const paintSummary = h('span', { class: 'paint-entry__hint' });
  const paintButton = h(
    'button',
    {
      type: 'button',
      id: ids.partialPaintButton,
      class: 'paint-entry',
      'aria-haspopup': 'dialog',
      'aria-controls': ids.partialPaintWindow,
      'aria-expanded': 'false',
      'data-action': 'partialPaint:change',
    },
    [
      h('span', { class: 'paint-entry__icon', 'aria-hidden': 'true' }, [icon('outfit')]),
      h('span', { class: 'paint-entry__text' }, [h('span', { class: 'paint-entry__title' }, [strings.partialPaint.open]), paintSummary]),
      icon('down', 'icon paint-entry__chevron'),
    ],
  );
  paintButton.addEventListener('click', () => bus.emit('partialPaint:change', { open: !store.state.session.partialPaint.open }));

  const scaleSlider = createSlider({
    id: 'appearance-scale',
    action: 'appearance:scale',
    min: LIMITS.characterScale.min * 100,
    max: LIMITS.characterScale.max * 100,
    value: 100,
    formatValue: a.sizePercent,
    onChange: (percent) => applyScale(percent),
  });
  const scaleInput = h('input', {
    type: 'number',
    class: 'appearance__scale-input',
    min: LIMITS.characterScale.min * 100,
    max: LIMITS.characterScale.max * 100,
    step: 1,
    'aria-label': `${a.size} (%)`,
    'data-action': 'appearance:scale',
  });
  scaleInput.addEventListener('input', () => {
    if (Number.isFinite(scaleInput.valueAsNumber)) applyScale(scaleInput.valueAsNumber);
  });
  const originalSize = h('p', { class: 'appearance__caption' });

  const appearance = h('section', { class: 'appearance', 'aria-labelledby': 'appearance-title' }, [
    h('h3', { class: 'editor-panel__section-title', id: 'appearance-title' }, [a.title]),
    selectionLabel,
    partChips.element,
    h('div', { class: 'group' }, [
      h('div', { class: 'group__row group__row--stacked' }, [
        h('span', { class: 'group__label' }, [a.color]),
        swatches,
        h('div', { class: 'appearance__color-row' }, [hexInput, paletteButton]),
        picker.element,
        applyAllButton,
      ]),
      h('div', { class: 'group__row' }, [paintButton]),
      h('div', { class: 'group__row group__row--stacked' }, [
        h('div', { class: 'group__row-header' }, [h('label', { class: 'group__label', for: 'appearance-scale' }, [a.size]), scaleInput]),
        scaleSlider.element,
        originalSize,
      ]),
    ]),
  ]);
  const hint = h('p', { class: 'appearance__caption' }, [t.noSelection]);

  /** Applique une couleur aux parties choisies (ou à tout le personnage). */
  function applyColor(color: string | null, commit: boolean, parts = store.state.session.selectedParts): void {
    const character = selected();
    if (!character) return;
    bus.emit('appearance:color', { characterId: character.id, parts, color });
    if (commit && color) bus.emit('color:commit', { color });
  }

  function applyScale(percent: number): void {
    const character = selected();
    if (character) bus.emit('appearance:scale', { characterId: character.id, scale: percent / 100 });
  }

  const autoColor = (): string => normalizeHex(getComputedStyle(list).getPropertyValue(AUTO_COLOR_TOKEN)) ?? '#000000';

  /** Couleur affichée : celle de la première partie choisie, sinon celle du personnage. */
  function currentColor(character: Character): string {
    const [part] = store.state.session.selectedParts;
    return part ? partColor(character, part, autoColor()) : (character.appearance.defaultColor ?? autoColor());
  }

  function renderAppearance(): void {
    const character = selected();
    appearance.hidden = !character;
    hint.hidden = Boolean(character);
    actions.hidden = !character;
    if (!character) return;
    const { characters } = store.state.project.present;
    const index = characters.indexOf(character);
    upButton.disabled = index === characters.length - 1;
    downButton.disabled = index === 0;
    removeButton.disabled = characters.length <= 1;

    const parts = store.state.session.selectedParts;
    partChips.setParts(character.skeleton.filter((n) => n.length > 0).map((n) => n.id));
    partChips.setSelected(parts);
    const zones = Object.values(character.appearance.segmentBands).reduce((sum, bands) => sum + bands.length, 0);
    paintSummary.textContent = zones === 0 ? strings.partialPaint.openHint : strings.partialPaint.summary(zones);
    selectionLabel.textContent = parts.length === 0 ? a.whole : parts.length === 1 ? a.part(parts[0] ?? '') : a.parts(parts.length);
    applyAllButton.hidden = parts.length === 0;
    const color = currentColor(character);
    if (document.activeElement !== hexInput) hexInput.value = color;
    picker.setValue(color);
    for (const button of swatches.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      const isAuto = button.dataset.color === '';
      const own = parts.length === 0 ? character.appearance.defaultColor : (character.appearance.segmentColors[parts[0] ?? ''] ?? character.appearance.defaultColor);
      button.setAttribute('aria-pressed', String(isAuto ? own === null : button.dataset.color === own));
    }

    const percent = Math.round(character.appearance.scale * 100);
    scaleSlider.setValue(percent);
    if (document.activeElement !== scaleInput) scaleInput.value = String(percent);
    const size = restSize(character);
    // Pixels de l'image exportée par unité du monde : le cadre du format fait STAGE_WORLD_HEIGHT de haut.
    const pixelsPerUnit = store.state.project.present.format.height / STAGE_WORLD_HEIGHT;
    originalSize.textContent = a.originalSize(Math.round(size.width * pixelsPerUnit), Math.round(size.height * pixelsPerUnit));
  }

  const root = h('div', { class: 'characters-tab' }, [list, addButton, actions, hint, appearance]);

  const repaintRows = (): void => rows.forEach(paintRow);
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colorScheme.addEventListener('change', repaintRows);
  const observer = new ResizeObserver(repaintRows);
  observer.observe(list);
  cleanups.push(
    () => colorScheme.removeEventListener('change', repaintRows),
    () => observer.disconnect(),
    () => picker.destroy(),
    store.watch((s) => s.project.present.characters, syncList),
    store.watch((s) => s.session.selectedCharacterId, syncList),
    store.watch((s) => s.project.present.characters, renderAppearance),
    store.watch((s) => s.session.selectedCharacterId, renderAppearance),
    store.watch((s) => s.session.selectedParts, renderAppearance),
    // La taille d'origine annoncée dépend de la résolution du format.
    store.watch((s) => s.project.present.format, renderAppearance),
    store.watch((s) => s.project.present.recentColors, (colors) => picker.setRecent(colors)),
    store.watch((s) => s.session.partialPaint.open, (open) => paintButton.setAttribute('aria-expanded', String(open))),
  );

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

function setToggle(button: HTMLButtonElement, iconName: Parameters<typeof icon>[0], label: string, pressed: boolean): void {
  button.replaceChildren(icon(iconName));
  button.setAttribute('aria-label', label);
  button.title = label;
  button.classList.toggle('is-off', pressed);
}
