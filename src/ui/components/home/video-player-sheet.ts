import '../../styles/components/home/video-player-sheet.css';

import type { VideoSummary } from '../../../core/home-state';
import { exportFileName } from '../../../export/export-plan';
import type { Component } from '../../component';
import { createSheet } from '../../controls/sheet';
import { h } from '../../dom';
import { downloadBlob } from '../../download';
import { icon, type IconName } from '../../icons';
import { strings } from '../../strings';
import type { HomeContext } from './context';

const t = strings.home.videos;

/**
 * Lecteur d'une vidéo conservée, en feuille modale : lecture / pause, plein écran, télécharger,
 * partager (API Web Share, si le navigateur sait partager un fichier) et supprimer. Un GIF
 * s'affiche comme une image (il boucle tout seul).
 */
export function createVideoPlayerSheet({ bus, store, videoFile }: HomeContext): Component {
  let current: { video: VideoSummary; blob: Blob; url: string } | null = null;
  let loading = 0;

  const stage = h('div', { class: 'player__stage' });
  const video = h('video', { class: 'player__media', controls: true, playsinline: true, loop: true, preload: 'metadata' });
  const image = h('img', { class: 'player__media', alt: '' });

  // Commandes du lecteur : seule « Supprimer » passe par le bus (data-action = nom de l'événement).
  const action = (name: IconName, label: string, onClick: () => void, eventName?: string): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: 'player__action', 'data-action': eventName }, [icon(name), h('span', {}, [label])]);
    button.addEventListener('click', onClick);
    return button;
  };
  const playLabel = h('span', {}, [t.play]);
  const playButton = h('button', { type: 'button', class: 'player__action' }, [icon('play'), playLabel]);
  playButton.addEventListener('click', () => (video.paused ? void video.play() : video.pause()));
  const syncPlay = (): void => {
    playLabel.textContent = video.paused ? t.play : t.pause;
    playButton.replaceChild(icon(video.paused ? 'play' : 'pause'), playButton.firstChild as Node);
  };
  video.addEventListener('play', syncPlay);
  video.addEventListener('pause', syncPlay);

  const fullscreen = action('fullscreen', t.fullscreen, () => {
    const media = stage.firstElementChild;
    if (media instanceof HTMLElement) void media.requestFullscreen?.().catch(() => undefined);
  });
  const download = action('download', t.download, () => {
    if (current) downloadBlob(current.blob, filename(current.video));
  });
  const share = action('share', t.share, () => {
    if (!current) return;
    const file = new File([current.blob], filename(current.video), { type: current.blob.type });
    // Partage annulé par l'utilisateur : rien à signaler.
    void navigator.share({ files: [file], title: current.video.projectName }).catch(() => undefined);
  });
  const remove = action(
    'trash',
    t.delete,
    () => {
      if (!current || !window.confirm(t.confirmDelete)) return;
      bus.emit('video:delete', { videoId: current.video.id });
      bus.emit('home:sheet', { sheet: null });
    },
    'video:delete',
  );
  remove.classList.add('player__action--destructive');

  const sheet = createSheet({
    id: 'video-player',
    title: '',
    closeLabel: t.close,
    body: [stage],
    actions: [h('div', { class: 'player__actions' }, [playButton, fullscreen, download, share, remove])],
    className: 'player',
    onClose: () => bus.emit('home:sheet', { sheet: null }),
  });

  function release(): void {
    video.pause();
    video.removeAttribute('src');
    image.removeAttribute('src');
    if (current) URL.revokeObjectURL(current.url);
    current = null;
    stage.replaceChildren();
  }

  async function show(videoId: string): Promise<void> {
    const request = ++loading;
    const summary = store.state.videos?.find((v) => v.id === videoId);
    release();
    sheet.title.textContent = summary ? t.player(summary.projectName) : '';
    if (!summary) return;
    let blob: Blob;
    try {
      blob = await videoFile(videoId);
    } catch {
      stage.replaceChildren(h('p', { class: 'home-section__status' }, [t.unavailable]));
      return;
    }
    if (request !== loading) return;
    current = { video: summary, blob, url: URL.createObjectURL(blob) };
    const isGif = summary.type === 'gif';
    const media = isGif ? image : video;
    media.src = current.url;
    stage.replaceChildren(media);
    playButton.hidden = isGif;
    const file = new File([blob], filename(summary), { type: blob.type });
    share.hidden = typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] });
    syncPlay();
  }

  const stop = store.watch(
    (s) => s.sheet,
    (value) => {
      const open = value?.kind === 'video';
      sheet.setOpen(open);
      if (open) void show(value.videoId);
      else {
        loading += 1;
        release();
      }
    },
  );

  return {
    mount(parent) {
      parent.append(sheet.dialog);
    },
    destroy() {
      stop();
      release();
      sheet.setOpen(false);
      sheet.dialog.remove();
    },
  };
}

function filename(video: VideoSummary): string {
  return exportFileName(video.projectName, video.type);
}
