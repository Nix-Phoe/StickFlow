// Worker de traitement des images importées (v2.1) : décodage, réduction et compression se font
// ici, pour que l'import d'une photo de 12 mégapixels ne bloque jamais l'interface.

import type { VideoFormat } from '../core/formats';
import { processImage, type ProcessedImage } from './image-import';

export interface ImageWorkerRequest {
  id: number;
  file: Blob;
  format: VideoFormat;
}

export type ImageWorkerResponse = { id: number; image: ProcessedImage } | { id: number; error: string };

const scope = self as unknown as { onmessage: ((event: MessageEvent<ImageWorkerRequest>) => void) | null; postMessage(message: ImageWorkerResponse): void };

scope.onmessage = ({ data }) => {
  processImage(data.file, data.format).then(
    (image) => scope.postMessage({ id: data.id, image }),
    (error: unknown) => scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }),
  );
};
