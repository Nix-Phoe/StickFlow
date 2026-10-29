// Types minimaux de node:fs, pour les tests qui lisent un fichier du projet (Vitest tourne sous Node).
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}
