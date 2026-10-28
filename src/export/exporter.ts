// Export GIF, PNG (archive ZIP) et vidéo : dessine chaque frame du plan d'export (décor et
// personnages visibles, sans aide d'édition) dans un canvas hors écran, l'encode, puis remet le
// fichier à `download`. Navigateur uniquement.

import type { AppEventBus } from '../core/events';
import { sequenceOf } from '../core/selectors';
import type { Session } from '../core/session';
import type { Store } from '../core/store';
import type { ExportFormat, Project } from '../core/types';
import type { DrawingSurface } from '../drawing/surface';
import type { SequenceFrame } from '../model/sequence';
import { paintScene } from '../render/canvas2d';
import { parseHexColor } from '../render/color';
import { buildSceneLayers } from '../render/scene-layers';
import { EXPORT_SIZE, exportFileName, pickVideoFormat, planExport, type ExportPlan } from './export-plan';
import { encodeGif } from './gif';
import { zipFiles } from './zip';

/**
 * Couleurs des fichiers exportés : indépendantes du thème de l'interface, pour que le résultat
 * soit le même en mode clair ou sombre. Les PNG gardent un fond transparent (incrustation).
 */
const EXPORT_COLORS = { background: '#ffffff', stickman: '#1c1c1e' } as const;

/** Intervalle auquel l'enregistreur vidéo livre ses données, en millisecondes. */
const VIDEO_CHUNK_MS = 100;

export interface ExporterOptions {
  bus: AppEventBus;
  store: Store;
  /** Remet le fichier à l'utilisateur (téléchargement). */
  download: (blob: Blob, filename: string) => void;
  /** Calque de dessin du décor. */
  drawing: DrawingSurface;
}

interface Exported {
  blob: Blob;
  extension: string;
}

export function connectExporter({ bus, store, download, drawing }: ExporterOptions): () => void {
  const setSession = (patch: Partial<Session>): void =>
    store.update((s) => ({ session: { ...s.session, ...patch } }));

  async function run(format: ExportFormat): Promise<void> {
    if (store.state.session.exportProgress !== null) return;
    const project = store.state.project.present;
    const plan = planExport(project, sequenceOf(store.state), format);
    setSession({ exportProgress: 0, notice: null });
    try {
      // Le calque de dessin doit être entièrement décodé avant la première image.
      await drawing.sync(project.environment.drawing.tiles);
      const paint: Painter = (context, frame, background) => drawFrame(context, project, frame, background, drawing);
      const { blob, extension } = await encoders[format](paint, plan, (progress) => setSession({ exportProgress: progress }));
      const filename = exportFileName(project.name, extension);
      download(blob, filename);
      setSession({ notice: { kind: 'success', code: 'exported', detail: filename } });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setSession({ notice: { kind: 'error', code: 'export-failed', detail } });
    } finally {
      setSession({ exportProgress: null });
    }
  }

  return bus.on('export:request', ({ format }) => void run(format));
}

// ---------- Encodeurs par format ----------

/** Dessine une frame ; `background` à `null` : fond transparent (sauf arrière-plan du décor). */
type Painter = (context: CanvasRenderingContext2D, frame: SequenceFrame, background: string | null) => void;
type Encoder = (paint: Painter, plan: ExportPlan, onProgress: (progress: number) => void) => Promise<Exported>;

const encoders: Record<ExportFormat, Encoder> = {
  async gif(paint, plan, onProgress) {
    const { canvas, context } = createCanvas({ willReadFrequently: true });
    const frames: Uint8ClampedArray[] = [];
    for (const [i, frame] of plan.frames.entries()) {
      paint(context, frame, EXPORT_COLORS.background);
      frames.push(context.getImageData(0, 0, canvas.width, canvas.height).data);
      onProgress((0.8 * (i + 1)) / plan.frames.length);
      await nextTick();
    }
    const bytes = encodeGif(frames, canvas.width, canvas.height, { delayMs: plan.delayMs, repeat: plan.gifRepeat });
    return { blob: new Blob([bytes], { type: 'image/gif' }), extension: 'gif' };
  },

  async png(paint, plan, onProgress) {
    const { canvas, context } = createCanvas();
    const digits = String(plan.frames.length).length;
    const files = [];
    for (const [i, frame] of plan.frames.entries()) {
      paint(context, frame, null);
      const png = await canvasToBlob(canvas, 'image/png');
      files.push({ name: `frame-${String(i + 1).padStart(digits, '0')}.png`, data: new Uint8Array(await png.arrayBuffer()) });
      onProgress((i + 1) / plan.frames.length);
    }
    return { blob: new Blob([zipFiles(files)], { type: 'application/zip' }), extension: 'zip' };
  },

  async mp4(paint, plan, onProgress) {
    const format = typeof MediaRecorder === 'undefined' ? null : pickVideoFormat((type) => MediaRecorder.isTypeSupported(type));
    if (!format) throw new Error("Ce navigateur ne sait pas enregistrer de vidéo");

    const { canvas, context } = createCanvas();
    // Capture manuelle : une image de la vidéo par frame, au rythme de l'animation.
    const stream = canvas.captureStream(0);
    const [track] = stream.getVideoTracks();
    if (!(track instanceof CanvasCaptureMediaStreamTrack)) throw new Error('Capture du canvas impossible');
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const started = new Promise<void>((resolve) => recorder.addEventListener('start', () => resolve(), { once: true }));
    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));

    // L'enregistreur démarre de façon asynchrone : on attend qu'il tourne avant d'envoyer des images,
    // et on lui demande des morceaux réguliers plutôt qu'un seul à la fin.
    const [first] = plan.frames;
    if (first) paint(context, first, EXPORT_COLORS.background);
    recorder.start(VIDEO_CHUNK_MS);
    await started;
    for (const [i, frame] of plan.frames.entries()) {
      paint(context, frame, EXPORT_COLORS.background);
      track.requestFrame();
      onProgress((i + 1) / plan.frames.length);
      await sleep(plan.delayMs);
    }
    // La dernière image doit durer elle aussi : on la maintient, puis on récupère les données restantes.
    track.requestFrame();
    await sleep(plan.delayMs);
    recorder.requestData();
    recorder.stop();
    await stopped;
    track.stop();

    const blob = new Blob(chunks, { type: format.mimeType.split(';')[0] });
    if (blob.size === 0) throw new Error('La vidéo enregistrée est vide');
    return { blob, extension: format.extension };
  },
};

// ---------- Dessin ----------

function createCanvas(attributes?: CanvasRenderingContext2DSettings): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE.width;
  canvas.height = EXPORT_SIZE.height;
  const context = canvas.getContext('2d', attributes);
  if (!context) throw new Error('Canvas 2D indisponible');
  return { canvas, context };
}

/** L'arrière-plan du décor, s'il en a un, remplace le fond par défaut. */
function drawFrame(
  context: CanvasRenderingContext2D,
  project: Project,
  frame: SequenceFrame,
  defaultBackground: string | null,
  drawing: DrawingSurface,
): void {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  const background = project.environment.background ?? defaultBackground;
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  const layers = buildSceneLayers({
    project,
    frame,
    onion: null,
    mode: null,
    selection: { selectedCharacterId: null, selectedNodeId: null, selectedParts: [], selectedShapeId: null },
    palette: { stickman: parseHexColor(EXPORT_COLORS.stickman), accent: parseHexColor(EXPORT_COLORS.stickman) },
  });
  paintScene(context, { width, height }, layers, { image: drawing.canvas, bounds: drawing.bounds });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image PNG impossible'))), type),
  );
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Rend la main au navigateur, pour que la barre d'avancement se mette à jour. */
const nextTick = (): Promise<void> => sleep(0);
