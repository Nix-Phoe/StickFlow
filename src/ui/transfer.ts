// Fichiers d'un glisser-déposer ou du presse-papiers.

/** Premier fichier image d'un transfert, sinon le premier fichier (l'import le refusera clairement). */
export function imageFileOf(data: DataTransfer | null): File | null {
  if (!data) return null;
  const files = [...data.files];
  return files.find((file) => file.type.startsWith('image/')) ?? files[0] ?? null;
}
