import '../styles/components/partial-paint-window.css';

import { LIMITS, type Character, type ColorBand } from '../../core/types';
import { partColor } from '../../model/character';
import { bandStops, mirrorPart, OUTFITS, outfitBands } from '../../model/color-bands';
import { normalizeHex, PRESET_COLORS } from '../../model/color';
import { pickPart } from '../../interaction/hit-test';
import { STAGE_WORLD_HEIGHT } from '../../render/camera';
import { paintCharacterPreview, previewFraming, previewPointToWorld } from '../../render/character-preview';
import { parseHexColor } from '../../render/color';
import type { Component, ComponentContext } from '../component';
import { createColorPicker, swatch } from '../controls/color-picker';
import { createIconButton } from '../controls/icon-button';
import { createPartChips } from '../controls/part-chips';
import { createSlider, type SliderControl } from '../controls/slider';
import { createSwitch } from '../controls/switch';
import { h, ids, SHEET_MEDIA_QUERY, STACKED_MEDIA_QUERY } from '../dom';
import { icon } from '../icons';
import { strings } from '../strings';

const t = strings.partialPaint;
/** Rayon de saisie d'une partie sur l'aperçu, en pixels CSS. */
const PICK_RADIUS_PX = 8;
/** Écart minimal entre le début et la fin d'une zone (5 %). */
const MIN_ZONE = 0.05;

interface ZoneRow {
  item: HTMLLIElement;
  colorButton: HTMLButtonElement;
  from: SliderControl;
  to: SliderControl;
  fromValue: HTMLOutputElement;
  toValue: HTMLOutputElement;
  remove: HTMLButtonElement;
}

/**
 * Fenêtre « Coloration partielle » : aperçu cliquable du personnage sélectionné, tenues toutes
 * faites, choix des parties (avec symétrie gauche / droite) et zones de couleur de la partie
 * choisie (début, fin, couleur). Ouverte depuis l'onglet Personnages ; à droite de la scène sur un
 * grand écran, à la place du panneau flottant sinon (feuille du bas sur téléphone).
 */
export function createPartialPaintWindow({ bus, store }: ComponentContext): Component {
  const cleanups: Array<() => void> = [];
  const sheetQuery = window.matchMedia(SHEET_MEDIA_QUERY);
  const stackedQuery = window.matchMedia(STACKED_MEDIA_QUERY);
  /** Zone dont la palette modifie la couleur ; `null` : la palette choisit la couleur des nouvelles zones. */
  let activeZone: number | null = null;

  const selected = (): Character | undefined =>
    store.state.project.present.characters.find((c) => c.id === store.state.session.selectedCharacterId);
  const token = (name: string, fallback: string): string => normalizeHex(getComputedStyle(root).getPropertyValue(name)) ?? fallback;
  const autoColor = (): string => token('--color-stickman', '#000000');

  // ---------- En-tête ----------
  const subtitle = h('p', { class: 'paint-window__subtitle' });
  const closeButton = createIconButton({
    icon: 'close',
    label: t.close,
    action: 'partialPaint:change',
    variant: 'filled',
    onClick: () => bus.emit('partialPaint:change', { open: false }),
  });
  const header = h('header', { class: 'editor-panel__header paint-window__header' }, [
    h('span', { class: 'paint-window__badge', 'aria-hidden': 'true' }, [icon('outfit')]),
    h('div', { class: 'paint-window__heading' }, [h('h2', { class: 'paint-window__title', id: 'paint-window-title' }, [t.title]), subtitle]),
    closeButton,
  ]);

  // ---------- Aperçu ----------
  const canvas = h('canvas', { class: 'paint-window__canvas', role: 'img' });
  const previewViewport = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  canvas.addEventListener('pointerdown', (event) => {
    const character = selected();
    const viewport = previewViewport();
    if (!character || viewport.height === 0) return;
    const rect = canvas.getBoundingClientRect();
    const framing = previewFraming(character, viewport);
    const world = previewPointToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewport);
    const unitsPerPixel = STAGE_WORLD_HEIGHT / viewport.height;
    const part = pickPart(framing.character, framing.pose, world, PICK_RADIUS_PX * unitsPerPixel);
    if (part) bus.emit('segment:select', { characterId: character.id, nodeId: part, additive: event.shiftKey });
  });
  const preview = h('div', { class: 'paint-window__preview' }, [canvas, h('p', { class: 'appearance__caption' }, [t.previewHint])]);

  function paintPreview(): void {
    const character = selected();
    const context = canvas.getContext('2d');
    const { width, height } = previewViewport();
    if (!context || width === 0 || height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!character) return;
    const viewport = { width: canvas.width, height: canvas.height };
    const palette = { stickman: parseHexColor(autoColor()), accent: parseHexColor(token('--color-accent', '#0a84ff')) };
    paintCharacterPreview(context, viewport, previewFraming(character, viewport), palette, store.state.session.selectedParts);
  }

  // ---------- Couleur ----------
  const swatches = h('div', { class: 'appearance__swatches', role: 'group', 'aria-label': t.color }, PRESET_COLORS.map((hex) => swatch(hex, t.swatch)));
  swatches.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-color]') : null;
    if (target?.dataset.color) chooseColor(target.dataset.color, true);
  });
  const hexInput = h('input', { type: 'text', class: 'appearance__hex', maxlength: 7, autocomplete: 'off', spellcheck: false, 'aria-label': t.hex, 'data-action': 'partialPaint:change' });
  hexInput.addEventListener('change', () => {
    const hex = normalizeHex(hexInput.value);
    if (hex) chooseColor(hex, true);
    else render();
  });
  const paletteButton = h('button', { type: 'button', class: 'button-secondary', 'aria-expanded': 'false', 'data-action': 'partialPaint:change' }, [icon('palette'), t.palette]);
  const picker = createColorPicker({
    id: 'partial-paint-color',
    action: 'partialPaint:change',
    value: store.state.session.partialPaint.color,
    recent: store.state.project.present.recentColors,
    bus,
    onChange: (hex) => chooseColor(hex, false),
    onCommit: (hex) => chooseColor(hex, true),
  });
  picker.element.hidden = true;
  paletteButton.addEventListener('click', () => {
    picker.element.hidden = !picker.element.hidden;
    paletteButton.setAttribute('aria-expanded', String(!picker.element.hidden));
  });
  const colorLabel = h('span', { class: 'group__label' }, [t.color]);
  const colorChip = h('span', { class: 'paint-window__color-chip', 'aria-hidden': 'true' });

  /** Couleur choisie : celle des nouvelles zones et des tenues, et celle de la zone active s'il y en a une. */
  function chooseColor(hex: string, commit: boolean): void {
    bus.emit('partialPaint:change', { color: hex });
    const bands = currentBands();
    const band = activeZone === null ? undefined : bands[activeZone];
    if (activeZone !== null && band) emitBands(bands.with(activeZone, { ...band, color: hex }));
    if (commit) bus.emit('color:commit', { color: hex });
  }

  // ---------- Tenues rapides ----------
  const outfitButtons = OUTFITS.map((outfit) => {
    const button = h('button', { type: 'button', class: 'paint-outfit', 'data-action': 'appearance:bands' }, [
      h('span', { class: 'paint-outfit__dot', 'aria-hidden': 'true' }),
      t.outfit[outfit] ?? outfit,
    ]);
    button.addEventListener('click', () => {
      const character = selected();
      const { color } = store.state.session.partialPaint;
      if (!character) return;
      bus.emit('appearance:bands', { characterId: character.id, bands: outfitBands(outfit, character, color) });
      bus.emit('color:commit', { color });
    });
    return { outfit, button };
  });
  const outfits = h('div', { class: 'paint-outfits' }, outfitButtons.map(({ button }) => button));

  // ---------- Parties ----------
  const partChips = createPartChips({
    label: t.partsLabel,
    action: 'segment:select',
    name: strings.appearance.part,
    wholeLabel: null,
    order: Object.keys(strings.parts),
    onSelect: (nodeId, additive) => {
      const character = selected();
      if (character && nodeId) bus.emit('segment:select', { characterId: character.id, nodeId, additive });
    },
  });
  const symmetricSwitch = createSwitch({
    label: t.symmetric,
    action: 'partialPaint:change',
    checked: store.state.session.partialPaint.symmetric,
    onChange: (symmetric) => bus.emit('partialPaint:change', { symmetric }),
  });

  /** Parties modifiées : les parties choisies et, avec la symétrie, leurs jumelles de l'autre côté. */
  function targetParts(): string[] {
    const character = selected();
    if (!character) return [];
    const { selectedParts, partialPaint } = store.state.session;
    const mirrors = partialPaint.symmetric ? selectedParts.flatMap((p) => mirrorPart(p, character.skeleton) ?? []) : [];
    return [...new Set([...selectedParts, ...mirrors])];
  }

  /** Zones affichées : celles de la première partie choisie. */
  function currentBands(): readonly ColorBand[] {
    const part = store.state.session.selectedParts[0];
    return (part && selected()?.appearance.segmentBands[part]) || [];
  }

  function emitBands(bands: readonly ColorBand[]): void {
    const character = selected();
    const parts = targetParts();
    if (!character || parts.length === 0) return;
    bus.emit('appearance:bands', { characterId: character.id, bands: Object.fromEntries(parts.map((p) => [p, bands])) });
  }

  // ---------- Zones de la partie ----------
  const appliedTo = h('p', { class: 'appearance__caption', 'aria-live': 'polite' });
  const strip = h('div', { class: 'paint-strip', role: 'img' });
  const stripStart = h('span');
  const stripEnd = h('span');
  const zoneList = h('ol', { class: 'paint-zones', 'aria-label': t.zones });
  const noZone = h('p', { class: 'appearance__caption' }, [t.noZone]);
  const zoneRows: ZoneRow[] = [];
  const addButton = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'appearance:bands' }, [icon('plus'), t.addZone]);
  addButton.addEventListener('click', () => {
    const bands = currentBands();
    const last = bands.at(-1);
    // Une nouvelle zone prend la moitié restée libre après la dernière, sinon la première moitié.
    const range = last && last.from === 0 && last.to < 1 ? { from: last.to, to: 1 } : { from: 0, to: 0.5 };
    activeZone = bands.length;
    emitBands([...bands, { ...range, color: store.state.session.partialPaint.color }]);
  });
  const clearButton = h('button', { type: 'button', class: 'button-secondary', 'data-action': 'appearance:bands' }, [icon('trash'), t.clear]);
  clearButton.addEventListener('click', () => {
    activeZone = null;
    emitBands([]);
  });
  const noPart = h('p', { class: 'appearance__caption' }, [t.noPart]);
  const editor = h('div', { class: 'paint-editor' }, [
    appliedTo,
    h('div', { class: 'paint-strip__frame' }, [strip, h('div', { class: 'paint-strip__ends', 'aria-hidden': 'true' }, [stripStart, stripEnd])]),
    zoneList,
    noZone,
    h('div', { class: 'paint-editor__actions' }, [addButton, clearButton]),
  ]);

  function createZoneRow(index: number): ZoneRow {
    const n = index + 1;
    const colorButton = h('button', { type: 'button', class: 'swatch paint-zone__color', 'aria-label': t.zoneColor(n), 'aria-pressed': 'false', 'data-action': 'appearance:bands' });
    colorButton.addEventListener('click', () => {
      activeZone = activeZone === index ? null : index;
      // La palette s'ouvre pour modifier la couleur de la zone.
      if (activeZone !== null && picker.element.hidden) paletteButton.click();
      render();
    });
    const slider = (end: 'from' | 'to'): SliderControl =>
      createSlider({
        id: `paint-zone-${index}-${end}`,
        action: 'appearance:bands',
        min: 0,
        max: 100,
        value: end === 'from' ? 0 : 100,
        formatValue: t.percent,
        onChange: (percent) => {
          const bands = currentBands();
          const band = bands[index];
          if (!band) return;
          const value = percent / 100;
          const next = end === 'from' ? { ...band, from: Math.min(value, band.to - MIN_ZONE) } : { ...band, to: Math.max(value, band.from + MIN_ZONE) };
          emitBands(bands.with(index, next));
        },
      });
    const from = slider('from');
    const to = slider('to');
    const fromValue = h('output', { class: 'paint-zone__value', for: from.element.id });
    const toValue = h('output', { class: 'paint-zone__value', for: to.element.id });
    const remove = createIconButton({
      icon: 'trash',
      label: t.removeZone(n),
      action: 'appearance:bands',
      onClick: () => {
        activeZone = null;
        emitBands(currentBands().filter((_, i) => i !== index));
      },
    });
    const range = (label: string, control: SliderControl, value: HTMLOutputElement): HTMLElement =>
      h('div', { class: 'paint-zone__range' }, [h('label', { class: 'paint-zone__label', for: control.element.id }, [label]), control.element, value]);
    const item = h('li', { class: 'paint-zone' }, [
      h('div', { class: 'paint-zone__header' }, [colorButton, h('span', { class: 'paint-zone__name' }, [t.zone(n)]), remove]),
      range(t.from, from, fromValue),
      range(t.to, to, toValue),
    ]);
    return { item, colorButton, from, to, fromValue, toValue, remove };
  }

  function renderZones(character: Character, bands: readonly ColorBand[]): void {
    while (zoneRows.length < bands.length) {
      const row = createZoneRow(zoneRows.length);
      zoneRows.push(row);
      zoneList.append(row.item);
    }
    while (zoneRows.length > bands.length) zoneRows.pop()?.item.remove();
    if (activeZone !== null && activeZone >= bands.length) activeZone = null;
    bands.forEach((band, i) => {
      const row = zoneRows[i];
      if (!row) return;
      row.colorButton.style.setProperty('--swatch-color', band.color);
      row.colorButton.setAttribute('aria-pressed', String(activeZone === i));
      row.item.classList.toggle('is-active', activeZone === i);
      row.from.setValue(Math.round(band.from * 100));
      row.to.setValue(Math.round(band.to * 100));
      row.fromValue.textContent = t.percent(Math.round(band.from * 100));
      row.toValue.textContent = t.percent(Math.round(band.to * 100));
    });
    noZone.hidden = bands.length > 0;
    addButton.disabled = bands.length >= LIMITS.bandsPerPart;
    clearButton.hidden = bands.length === 0;

    const part = store.state.session.selectedParts[0] ?? '';
    const base = partColor(character, part, autoColor());
    const stops = bandStops(base, bands);
    strip.style.setProperty('--paint-strip', `linear-gradient(to right, ${stops.map((s) => `${s.color} ${s.from * 100}% ${s.to * 100}%`).join(', ')})`);
    const name = strings.appearance.part(part);
    strip.setAttribute('aria-label', t.strip(name));
    const isHead = character.skeleton.find((n) => n.id === part)?.shape === 'circle';
    stripStart.textContent = isHead ? t.headStart : t.start;
    stripEnd.textContent = isHead ? t.headEnd : t.end;
  }

  // ---------- Fenêtre ----------
  const body = h('div', { class: 'editor-panel__body paint-window__body' }, [
    preview,
    h('div', { class: 'group' }, [
      h('div', { class: 'group__row group__row--stacked' }, [
        h('div', { class: 'group__row-header' }, [h('span', { class: 'paint-window__color-label' }, [colorChip, colorLabel])]),
        swatches,
        h('div', { class: 'appearance__color-row' }, [hexInput, paletteButton]),
        picker.element,
      ]),
    ]),
    h('h3', { class: 'editor-panel__section-title' }, [t.outfits]),
    outfits,
    h('h3', { class: 'editor-panel__section-title' }, [t.parts]),
    partChips.element,
    h('div', { class: 'group paint-window__symmetry' }, [
      h('div', { class: 'group__row' }, [h('span', { class: 'group__label' }, [t.symmetric]), symmetricSwitch.element]),
    ]),
    h('h3', { class: 'editor-panel__section-title' }, [t.zones]),
    noPart,
    editor,
  ]);
  const root = h(
    'section',
    { class: 'editor-panel paint-window', id: ids.partialPaintWindow, role: 'dialog', 'aria-labelledby': 'paint-window-title', hidden: true },
    [header, body],
  );

  function render(): void {
    const character = selected();
    const { selectedParts, partialPaint } = store.state.session;
    subtitle.textContent = character?.name ?? strings.characters.noSelection;
    canvas.setAttribute('aria-label', t.preview(character?.name ?? ''));
    for (const { outfit, button } of outfitButtons) {
      button.disabled = !character;
      button.style.setProperty('--swatch-color', partialPaint.color);
      button.setAttribute('aria-label', t.outfitLabel(t.outfit[outfit] ?? outfit, partialPaint.color));
    }
    partChips.setParts(character ? character.skeleton.filter((n) => n.length > 0).map((n) => n.id) : []);
    partChips.setSelected(selectedParts);
    symmetricSwitch.setChecked(partialPaint.symmetric);

    const bands = currentBands();
    const zone = activeZone === null ? undefined : bands[activeZone];
    const color = zone?.color ?? partialPaint.color;
    colorLabel.textContent = zone && activeZone !== null ? `${t.color} · ${t.zone(activeZone + 1)}` : t.color;
    colorChip.style.setProperty('--swatch-color', color);
    if (document.activeElement !== hexInput) hexInput.value = color;
    picker.setValue(color);
    for (const button of swatches.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      button.setAttribute('aria-pressed', String(button.dataset.color === color));
    }

    const hasPart = Boolean(character) && selectedParts.length > 0;
    noPart.hidden = hasPart;
    editor.hidden = !hasPart;
    if (character && hasPart) {
      appliedTo.textContent = t.appliedTo(targetParts().map(strings.appearance.part).join(', '));
      renderZones(character, bands);
    }
    paintPreview();
  }

  /** À droite de la scène sur grand écran ; sinon à la place du panneau flottant, sous son bouton. */
  function position(): void {
    if (root.hidden || sheetQuery.matches) return;
    const button = document.getElementById(ids.editorButton);
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(root).getPropertyValue('--space-2')) || 0;
    const left = stackedQuery.matches ? Math.min(Math.max(gutter, rect.left), window.innerWidth - root.offsetWidth - gutter) : window.innerWidth - root.offsetWidth - gutter;
    root.style.setProperty('--editor-panel-top', `${rect.bottom + gutter / 2}px`);
    root.style.setProperty('--editor-panel-left', `${Math.max(gutter, left)}px`);
  }

  function applyOpen(open: boolean): void {
    const wasOpen = !root.hidden;
    root.hidden = !open;
    if (open) {
      position();
      render();
      if (!wasOpen) closeButton.focus();
    } else if (wasOpen && root.contains(document.activeElement)) {
      document.getElementById(ids.partialPaintButton)?.focus();
    }
  }

  const repaint = (): void => paintPreview();
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colorScheme.addEventListener('change', repaint);
  stackedQuery.addEventListener('change', position);
  window.addEventListener('resize', position);
  const observer = new ResizeObserver(repaint);
  observer.observe(canvas);
  const whenOpen = (): void => {
    if (!root.hidden) render();
  };
  cleanups.push(
    () => colorScheme.removeEventListener('change', repaint),
    () => stackedQuery.removeEventListener('change', position),
    () => window.removeEventListener('resize', position),
    () => observer.disconnect(),
    () => picker.destroy(),
    store.watch((s) => s.session.partialPaint.open, applyOpen),
    store.watch((s) => s.project.present.characters, whenOpen),
    store.watch((s) => s.session.selectedCharacterId, () => {
      activeZone = null;
      whenOpen();
    }),
    store.watch((s) => s.session.selectedParts, () => {
      activeZone = null;
      whenOpen();
    }),
    store.watch((s) => s.session.partialPaint, whenOpen),
    store.watch((s) => s.project.present.recentColors, (colors) => picker.setRecent(colors)),
  );

  return {
    mount(parent) {
      parent.append(root);
      applyOpen(store.state.session.partialPaint.open);
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      root.remove();
    },
  };
}
