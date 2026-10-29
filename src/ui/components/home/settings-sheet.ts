import { THEMES, type ThemePreference } from '../../../core/home-state';
import { LIMITS } from '../../../core/types';
import type { Component } from '../../component';
import { createFormatPicker } from '../../controls/format-picker';
import { createSegmented } from '../../controls/segmented';
import { createSheet } from '../../controls/sheet';
import { createStepper } from '../../controls/stepper';
import { h } from '../../dom';
import { formatBytes } from '../../format';
import { icon } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.settingsSheet;

/** Réglages : thème, format et IPS par défaut des nouveaux projets, vidéos stockées. */
export function createSettingsSheet({ bus, store }: HomeContext): Component {
  const { preferences } = store.state;
  const theme = createSegmented<ThemePreference>({
    label: t.theme,
    action: 'settings:change',
    options: THEMES.map((value) => ({ value, label: t.themes[value] })),
    value: preferences.theme,
    onChange: (value) => bus.emit('settings:change', { theme: value }),
  });
  const format = createFormatPicker({
    name: 'settings-format',
    label: t.defaultFormat,
    action: 'settings:change',
    value: preferences.defaultFormat,
    onChange: (value) => bus.emit('settings:change', { defaultFormat: value }),
  });
  const fps = createStepper({
    id: 'settings-fps',
    label: t.defaultFps,
    action: 'settings:change',
    ...LIMITS.fps,
    value: preferences.defaultFps,
    onChange: (value) => bus.emit('settings:change', { defaultFps: value }),
  });
  const videosInfo = h('p', { class: 'sheet__label' });
  const clearVideos = h('button', { type: 'button', class: 'button-secondary settings__clear', 'data-action': 'videos:clear' }, [icon('trash'), t.clearVideos]);
  clearVideos.addEventListener('click', () => {
    if (window.confirm(strings.home.videos.confirmClear)) bus.emit('videos:clear');
  });

  const done = h('button', { type: 'button', class: 'button-primary', 'data-action': 'home:sheet' }, [t.close]);
  done.addEventListener('click', () => bus.emit('home:sheet', { sheet: null }));

  const sheet = createSheet({
    id: 'settings-sheet',
    title: t.title,
    closeLabel: t.close,
    body: [
      h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [t.theme]), theme.element]),
      h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [t.defaultFormat]), format.element]),
      h('div', { class: 'sheet__row' }, [h('label', { class: 'sheet__label', for: 'settings-fps' }, [t.defaultFps]), fps.element]),
      h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [t.videos]), videosInfo, clearVideos]),
    ],
    actions: [done],
    onClose: () => bus.emit('home:sheet', { sheet: null }),
  });

  const stops = [
    store.watch((s) => s.sheet?.kind === 'settings', (open) => sheet.setOpen(open)),
    store.watch(
      (s) => s.preferences,
      (value) => {
        theme.setValue(value.theme);
        format.setValue(value.defaultFormat);
        fps.setValue(value.defaultFps);
      },
    ),
    store.watch(
      (s) => s.videos,
      (videos) => {
        const count = videos?.length ?? 0;
        const size = (videos ?? []).reduce((total, video) => total + video.size, 0);
        videosInfo.textContent = count === 0 ? t.noVideos : `${strings.units.videos(count)} · ${formatBytes(size)}`;
        clearVideos.disabled = count === 0;
      },
    ),
  ];

  return {
    mount(parent) {
      parent.append(sheet.dialog);
    },
    destroy() {
      stops.forEach((stop) => stop());
      sheet.setOpen(false);
      sheet.dialog.remove();
    },
  };
}
