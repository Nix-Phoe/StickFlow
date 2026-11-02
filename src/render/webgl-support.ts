// Détection de WebGL 2 au démarrage (v2.2) : sans lui, la scène de l'éditeur ne peut pas s'afficher,
// et l'app montre une page « navigateur non compatible » plutôt qu'un éditeur vide.

/** Le navigateur sait-il créer un contexte WebGL 2 ? Le contexte d'essai est libéré aussitôt. */
export function supportsWebGL2(createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')): boolean {
  try {
    const context = createCanvas().getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
