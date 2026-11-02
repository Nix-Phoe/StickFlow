// Erreurs globales (v2.2) : celles qui méritent la page d'erreur, et le bruit à ignorer.

/** Ce que le navigateur donne d'une erreur (`ErrorEvent`) ou d'une promesse rejetée (`PromiseRejectionEvent`). */
export interface GlobalErrorInfo {
  message?: string;
  filename?: string;
  reason?: unknown;
}

/** Messages bénins des navigateurs (ResizeObserver qui reporte une notification à l'image suivante). */
const BENIGN_MESSAGES = [/ResizeObserver loop/i];
/** Scripts des extensions du navigateur, qui ne sont pas les nôtres. */
const EXTENSION_FILES = /^(chrome|moz|safari(-web)?)-extension:/;

/** L'erreur vient-elle de l'app, et faut-il proposer de recharger ? */
export function isReportableError({ message = '', filename = '', reason }: GlobalErrorInfo): boolean {
  if (BENIGN_MESSAGES.some((pattern) => pattern.test(message))) return false;
  if (EXTENSION_FILES.test(filename)) return false;
  // Une opération annulée (téléchargement, partage refusé) n'est pas une panne.
  if (reason instanceof DOMException && reason.name === 'AbortError') return false;
  return true;
}
