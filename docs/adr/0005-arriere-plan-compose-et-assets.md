# 0005 : arrière-plan composé, magasin d'assets et proxy d'images

- Statut : accepté (version 2.1)
- Contexte : ADR 0003 (calque de dessin en tuiles) et ADR 0004 (index des projets)

## Contexte

La version 2.1 permet de choisir l'arrière-plan de la scène : une couleur, un dégradé, un arrière-plan intégré, une image de l'appareil ou une image trouvée sur Internet. Une image peut être réglée : ajustement, point focal, zoom, flou, luminosité, opacité et voile.

Trois questions se posent.

1. **Où ranger les images ?** Une photo pèse des centaines de kilo-octets. En data URL dans le Projet, elle alourdirait chaque instantané d'annulation, chaque sauvegarde et l'index.
2. **Comment dessiner les effets ?** Ils doivent rester identiques dans la scène (WebGL), dans les vignettes (Canvas 2D) et dans l'export. Ils ne doivent jamais être recalculés à chaque image.
3. **Comment chercher et charger une image en ligne ?** Il faut le faire sans exposer de clé d'API, et sans tomber sur des images que le CORS rendrait inutilisables dans WebGL et l'export.

## Décision

**Un magasin d'assets à part.** Les images sont gardées en Blob dans la base IndexedDB `stickflow-assets` (`storage/asset-store.ts`). Chaque asset a son id, sa taille, son type, sa source, son crédit et une petite vignette. Le Projet ne garde que l'`assetId` dans son arrière-plan (`ImageBackground`). Le résumé de l'index liste les `assetIds` utilisés. Supprimer le dernier projet qui utilise une image supprime l'image ; une copie la partage. Avant d'être gardée, une image est réduite à deux fois la résolution du format (3840 px au plus) et compressée en WebP. Ce traitement se fait dans un Worker.

**Une seule composition, en Canvas 2D.** `environment/paint-background.ts` dessine tout l'arrière-plan dans un canvas aux proportions du format. Les effets passent par `ctx.filter`, et le voile par une couche en transparence. Ce canvas est :

- recomposé seulement quand l'arrière-plan ou le format change (`environment/background-surface.ts`) ;
- envoyé au GPU comme texture, une fois par composition (`version`) ;
- dessiné tel quel dans les vignettes.

L'export le recompose une fois, à sa pleine résolution. La géométrie est pure et testée (`background-layout.ts`) : la ligne du dégradé suit la convention CSS, et l'image se place selon son ajustement, son point focal et son zoom.

**Un proxy sans dépendance.** `server/image-proxy` est un Cloudflare Worker. Il garde la clé Pexels en secret, résume les résultats de recherche, et renvoie les images (PNG, JPEG, WebP ou GIF, 20 Mo au plus) avec les en-têtes CORS. Il refuse le SVG, les adresses privées et les origines non autorisées. L'app ne connaît que son adresse (`VITE_IMAGE_PROXY_URL`). Sans proxy configuré, l'onglet Internet l'explique.

## Conséquences

- Annuler un changement d'arrière-plan ne copie qu'un petit objet. Les sauvegardes et l'index restent légers.
- La scène, les vignettes et l'export montrent le même arrière-plan, puisque la composition et les effets sont communs. Le coût par image est celui d'un rectangle texturé.
- Le flou dépend de `CanvasRenderingContext2D.filter` (Chrome, Edge, Firefox, Safari 18). Un navigateur plus ancien montre l'image sans flou ni luminosité.
- Sous une image transparente (opacité < 1), on voit le blanc de l'export, dans l'éditeur comme à l'export, quel que soit le thème.
- Une image importée, puis remplacée sans enregistrer, reste dans le magasin jusqu'à la suppression d'un projet qui l'utilise. Les 8 plus récentes sont proposées à nouveau.
- **Écarts assumés avec le prompt v2.1 :**
  - Le magasin s'appelle `asset-store.ts` (kebab-case), et non `assetStore.ts`.
  - L'arrière-plan peut aussi valoir `null` (celui du thème).
  - Les images intégrées sont composées en Canvas 2D, puis envoyées comme texture, plutôt que dessinées dans un shader.
