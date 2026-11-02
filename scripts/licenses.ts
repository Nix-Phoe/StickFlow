// Licences des bibliothèques livrées avec l'app (page « À propos », v2.2) : les dépendances de
// production et celles du service worker, avec leurs propres dépendances, lues dans node_modules.
// Le plugin Vite les expose au build sous `virtual:licenses`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  author: string | null;
  url: string | null;
  text: string | null;
}

/** Bibliothèques du service worker (Workbox), en plus des dépendances de package.json. */
export const SERVICE_WORKER_PACKAGES = ['workbox-window', 'workbox-precaching', 'workbox-routing', 'workbox-strategies', 'workbox-expiration', 'workbox-cacheable-response'];

export function collectLicenses(root: string, packages: readonly string[]): LicenseEntry[] {
  const found = new Map<string, LicenseEntry>();
  const queue = [...packages];
  while (queue.length > 0) {
    const name = queue.shift()!;
    // Les paquets de types ne contiennent pas de code livré.
    if (found.has(name) || name.startsWith('@types/')) continue;
    const directory = join(root, 'node_modules', name);
    const manifestPath = join(directory, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest;
    const licenseFile = readdirSync(directory).find((file) => /^(licen[cs]e|copying)(\.|$)/i.test(file));
    found.set(name, {
      name,
      version: manifest.version ?? '',
      license: typeof manifest.license === 'string' ? manifest.license : 'voir le texte',
      author: authorName(manifest.author),
      url: repositoryUrl(manifest),
      text: licenseFile ? readFileSync(join(directory, licenseFile), 'utf8').trim() : null,
    });
    queue.push(...Object.keys(manifest.dependencies ?? {}));
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** `import licenses from 'virtual:licenses'` : la liste, calculée au build. */
export function licensesPlugin(root: string): Plugin {
  const id = 'virtual:licenses';
  return {
    name: 'stickflow-licenses',
    resolveId: (source) => (source === id ? `\0${id}` : null),
    load(resolved) {
      if (resolved !== `\0${id}`) return null;
      const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageManifest;
      const licenses = collectLicenses(root, [...Object.keys(manifest.dependencies ?? {}), ...SERVICE_WORKER_PACKAGES]);
      return `export default ${JSON.stringify(licenses)};`;
    },
  };
}

interface PackageManifest {
  version?: string;
  license?: unknown;
  author?: unknown;
  homepage?: string;
  repository?: unknown;
  dependencies?: Record<string, string>;
}

function authorName(author: unknown): string | null {
  const name = typeof author === 'string' ? author : typeof author === 'object' && author !== null ? (author as { name?: unknown }).name : null;
  // « Nom <adresse> (site) » : seul le nom est gardé.
  return typeof name === 'string' ? name.replace(/\s*[<(].*$/, '').trim() || null : null;
}

function repositoryUrl({ homepage, repository }: PackageManifest): string | null {
  const raw = typeof repository === 'string' ? repository : typeof repository === 'object' && repository !== null ? (repository as { url?: unknown }).url : null;
  const url = typeof raw === 'string' ? raw.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/') : null;
  if (url && /^https:\/\//.test(url)) return url;
  if (url && /^[\w-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return typeof homepage === 'string' && /^https:\/\//.test(homepage) ? homepage : null;
}
