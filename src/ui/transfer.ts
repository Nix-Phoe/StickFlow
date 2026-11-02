// Fichiers d'un glisser-déposer ou du presse-papiers.

/** Premier fichier image d'un transfert, sinon le premier fichier (l'import le refusera clairement). */
export function imageFileOf(data: DataTransfer | null): File | null {
  if (!data) return null;
  const files = [...data.files];
  return files.find((file) => file.type.startsWith('image/')) ?? files[0] ?? null;
}

/** Extensions proposées par le sélecteur de fichiers d'un projet (v2.2) ; le contenu est vérifié à l'import. */
export const PROJECT_FILE_ACCEPT = '.stickflow,application/zip';

/** Ouvre le sélecteur de fichiers du système ; `null` si l'utilisateur annule. */
export function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    // Safari n'ouvre le sélecteur que pour un champ présent dans la page.
    document.body.append(input);
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    input.click();
  });
}
