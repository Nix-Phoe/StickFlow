import { applyPalette, GIFEncoder, quantize } from 'gifenc';

export interface GifOptions {
  /** Durée d'affichage de chaque image, en millisecondes. */
  delayMs: number;
  /** -1 : une seule lecture ; 0 : en boucle ; n > 0 : n répétitions en plus de la première. */
  repeat: number;
}

/** Encode des images RGBA de même taille en GIF animé (palette de 256 couleurs par image). */
export function encodeGif(
  frames: readonly Uint8ClampedArray[],
  width: number,
  height: number,
  options: GifOptions,
): Uint8Array<ArrayBuffer> {
  if (frames.length === 0) throw new RangeError('Aucune image à encoder');
  const expected = width * height * 4;
  const encoder = GIFEncoder();
  frames.forEach((rgba, i) => {
    if (rgba.length !== expected) throw new RangeError(`Image ${i + 1} : ${rgba.length} octets au lieu de ${expected}`);
    const palette = quantize(rgba, 256);
    encoder.writeFrame(applyPalette(rgba, palette), width, height, {
      palette,
      delay: options.delayMs,
      repeat: options.repeat,
    });
  });
  encoder.finish();
  return encoder.bytes();
}
