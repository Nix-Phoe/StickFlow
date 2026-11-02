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
import { chooseFile, PROJECT_FILE_ACCEPT } from '../../transfer';
import type { HomeContext } from './context';

const t = strings.home.settingsSheet;

/** Pages publiques (v2.2), servies à côté de l'app. */
export const PUBLIC_PAGES = { privacy: '/confidentialite', about: '/a-propos' } as const;

/**
 * Réglages : thème, format et IPS par défaut des nouveaux projets, vidéos stockées ; protection du
 * stockage, sauvegarde et restauration de tous les projets, pages publiques et version (v2.2).
 */
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

  // ---------- Mes projets : stockage protégé, sauvegarde, restauration (v2.2) ----------
  const protectionIcon = h('span', { class: 'settings__status-icon' });
  const protectionTitle = h('span', { class: 'settings__status-title' });
  const protectionText = h('span', { class: 'settings__status-text' });
  const protect = h('button', { type: 'button', class: 'button-secondary settings__action', 'data-action': 'storage:protect' }, [icon('protected'), t.protect]);
  protect.addEventListener('click', () => bus.emit('storage:protect'));
  const backup = h('button', { type: 'button', class: 'button-secondary settings__action', 'data-action': 'library:backup' }, [icon('backup'), t.backup]);
  backup.addEventListener('click', () => bus.emit('library:backup'));
  const restore = h('button', { type: 'button', class: 'button-secondary settings__action', 'data-action': 'library:import' }, [icon('restore'), t.restore]);
  restore.addEventListener('click', () => {
    void chooseFile(PROJECT_FILE_ACCEPT).then((file) => {
      if (file) bus.emit('library:import', { file });
    });
  });
  const dataSection = h('div', { class: 'sheet__field' }, [
    h('span', { class: 'sheet__label' }, [t.data]),
    h('p', { class: 'settings__status', role: 'status' }, [protectionIcon, h('span', { class: 'settings__status-body' }, [protectionTitle, protectionText])]),
    protect,
    h('div', { class: 'settings__actions' }, [backup, restore]),
    h('p', { class: 'settings__hint' }, [t.backupHint]),
  ]);

  // ---------- Application : installation de la PWA (v2.2) ----------
  const installText = h('p', { class: 'settings__hint' });
  const install = h('button', { type: 'button', class: 'button-primary settings__action', 'data-action': 'app:install' }, [icon('install'), strings.app.install.action]);
  install.addEventListener('click', () => bus.emit('app:install'));
  const appSection = h('div', { class: 'sheet__field' }, [h('span', { class: 'sheet__label' }, [strings.app.install.section]), install, installText]);

  const links = h('nav', { class: 'settings__links', 'aria-label': t.links }, [
    h('a', { href: PUBLIC_PAGES.privacy, class: 'settings__link' }, [icon('document'), t.privacy]),
    h('a', { href: PUBLIC_PAGES.about, class: 'settings__link' }, [icon('info'), t.about]),
  ]);

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
      dataSection,
      appSection,
      links,
      h('p', { class: 'settings__version' }, [t.version(__APP_VERSION__)]),
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
      (s) => s.storageProtected,
      (state) => {
        const [title, text, iconName] =
          state === true ? [t.protected, t.protectedText, 'protected' as const] : state === false ? [t.unprotected, t.unprotectedText, 'unprotected' as const] : [t.unknown, t.unknownText, 'unprotected' as const];
        protectionTitle.textContent = title;
        protectionText.textContent = text;
        protectionIcon.replaceChildren(icon(iconName));
        protectionIcon.dataset.state = String(state);
        protect.hidden = state !== false;
      },
    ),
    store.watch(
      (s) => s.install,
      (mode) => {
        const texts = { prompt: '', ios: strings.app.install.ios, installed: strings.app.install.installed, unavailable: strings.app.install.unavailable };
        install.hidden = mode !== 'prompt';
        installText.textContent = texts[mode];
        installText.hidden = mode === 'prompt';
      },
    ),
    store.watch(
      (s) => s.transfer,
      (transfer) => {
        backup.disabled = transfer !== null;
        restore.disabled = transfer !== null;
        backup.setAttribute('aria-busy', String(transfer === 'backup'));
        restore.setAttribute('aria-busy', String(transfer === 'import'));
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
