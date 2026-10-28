import { zipSync } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Archive ZIP sans compression (des PNG sont déjà compressés). */
export function zipFiles(files: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const archive = zipSync(Object.fromEntries(files.map(({ name, data }) => [name, data])), { level: 0 });
  // fflate renvoie un tableau sur ArrayBufferLike ; Blob attend un ArrayBuffer simple.
  return new Uint8Array(archive);
}
