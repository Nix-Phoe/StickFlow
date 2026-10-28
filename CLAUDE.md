# Projet : Animateur de stickman assisté par IA

> Nom provisoire : **StickFlow**. Ce document est la référence du projet pour Claude Code. Le lire en entier avant toute tâche, et le mettre à jour quand une décision d'architecture change.

---

## 1. Vision

Une application d'animation 2D de stickman par **pivots (nœuds)**, inspirée de *Stick Nodes* (Google Play), dont le but est de **simplifier la création d'animations grâce à l'IA**.

Principe fondamental : **l'IA assiste, l'utilisateur décide.**
- L'utilisateur garde le contrôle total de son animation.
- L'IA agit uniquement à travers des **fonctionnalités explicites** (activables, réglables, annulables).
- L'utilisateur **voit toujours ce que l'IA a fait** (aperçu, différenciation visuelle des frames générées) et peut **intervenir** à tout moment (modifier, figer ou supprimer une frame générée).

Plateformes cibles : **Web (PWA)** en premier, puis **Android (Google Play)** via Capacitor, à partir du même code.

---

## 2. Fonctionnalités

### 2.1 Socle (éditeur d'animation classique)
Inspiré des écrans de Stick Nodes :
- **Canvas central** : affichage et manipulation du stickman par ses nœuds (rotation autour du nœud parent, cinématique directe).
- **Timeline** : vignettes de frames numérotées, frame active surlignée, bouton « + » pour ajouter une frame, défilement horizontal.
- **Actions sur les frames** : ajouter, supprimer, dupliquer, copier / coller.
- **Pelure d'oignon** (onion skinning) : frame précédente affichée en transparence.
- **Lecture** : lecture, pause, stop, vitesse de prévisualisation (x2, x5, x10).
- **Annuler / Rétablir** (historique par instantanés, voir ADR 0001).
- **IPS** de l'animation (1 à 60).
- **Projet** : sauvegarder, sauvegarder sous, ouvrir.
- **Export** : GIF, PNG (séquence), MP4.
- **Réglages** (paramètres de l'app).

### 2.2 Fonctionnalités IA (phase initiale : 2 seulement)
1. **Fluidité** — génère automatiquement des frames intermédiaires entre les images clés de l'utilisateur (ex. 3 frames → mouvement fluide).
   - Réglages : activé / désactivé, intensité (nombre de frames intermédiaires), type de courbe (linéaire, douce, accélération / décélération).
   - V1 (réalisée) : courbe **Linéaire** = droite entre deux images clés ; **Douce** = spline Catmull-Rom passant par les images clés (tient compte des voisines, mouvement continu) ; **Accélération / décélération** = même spline, rythme ralenti près des images clés (ease-in-out cubique). Angles toujours par le plus court chemin. V2 : modèle d'IA de *motion in-betweening*.
2. **Répétition (boucle intelligente)** — rend l'animation répétable en générant une transition fluide de la dernière frame vers la première.
   - Réglages : activé / désactivé, nombre de répétitions ou boucle infinie, durée de la transition.

Règles communes aux fonctionnalités IA :
- Les frames générées sont **visuellement distinguées** dans la timeline (ex. vignette plus petite / teinte différente).
- Une frame générée peut être **convertie en image clé** par l'utilisateur pour la modifier.
- Tout effet IA est **non destructif** : les images clés de l'utilisateur ne sont jamais modifiées.

### 2.3 Prévu plus tard (hors périmètre initial)
- Bibliothèque d'**effets prédéfinis** : onde de choc à l'atterrissage d'un saut, traînée de mouvement, poussière, impact, etc.
- **Zone de prompt** : décrire en texte une amélioration à appliquer.
- Éditeur de squelette (ajout / suppression de nœuds, formes), décors, plusieurs personnages, zones de texte.

---

## 3. Interface (UI)

### 3.1 Disposition (d'après la maquette Figma)
```
┌──────────────┬──────────────────────────────────────────────┐
│  EN-TÊTE      │   BARRE D'OUTILS                             │
│  (logo, mode, │   [↶] [↷]  [▶] [⏸]   x2  x5  x10              │
│   outils)     ├──────────────────────────────────────────────┤
├──────────────┤                                              │
│              │                                              │
│  PANNEAU     │              CANVAS (WebGL 2)                │
│  RÉGLAGES IA │                                              │
│  - Fluidité  │                                              │
│  - Répétition│                                              │
│  - IPS       │                                              │
│  (- effets,  ├──────────────────────────────────────────────┤
│   prompt :   │  TIMELINE                                    │
│   plus tard) │  [frame 1][frame 2][frame 3]...   [ + ]      │
├──────────────┤                                              │
│ [Exporter ▾] │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Panneau gauche** : en-tête (nom du projet, sélecteur de mode, sauvegarder), section « Améliorations IA » (Fluidité, Répétition), section « Animation » (IPS), puis bouton **Exporter** avec choix du format en bas.
- **Barre supérieure** : annuler, rétablir, lecture, pause, vitesses x2 / x5 / x10.
- **Zone centrale** : canvas de dessin.
- **Barre inférieure** : timeline des frames + bouton « + ».

### 3.2 Style : inspiré des Human Interface Guidelines d'Apple
Référence : https://developer.apple.com/design/human-interface-guidelines
- **Clarté et sobriété** : l'interface s'efface devant le contenu (le canvas). Peu de couleurs, une seule couleur d'accent.
- **Hiérarchie** : regroupements en sections arrondies (style « inset grouped »), titres de section discrets.
- **Matériaux** : panneaux translucides avec flou d'arrière-plan (`backdrop-filter`) pour la profondeur.
- **Typographie** : pile système `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif`.
- **Cibles tactiles** : **44 × 44 px minimum**.
- **Contrôles familiers** : interrupteurs (toggles), contrôles segmentés (x2 / x5 / x10, format d'export), sliders, steppers.
- **Mode clair et sombre** automatiques (`prefers-color-scheme`), contraste suffisant (WCAG AA).
- **Grille d'espacement de 8 px**, coins arrondis cohérents (8 / 12 / 16 px).
- **Icônes** : ne pas utiliser SF Symbols (licence réservée aux plateformes Apple). Utiliser **Lucide** (licence ISC) en SVG.
- **Animations d'interface** courtes et douces ; respecter `prefers-reduced-motion`.
- **Accessibilité** : HTML sémantique, `aria-label` sur les boutons-icônes, navigation clavier, focus visible.

### 3.3 Responsive
- Cible principale : **paysage** (tablette, téléphone, ordinateur).
- Sur petits écrans, le panneau gauche devient un **tiroir** repliable.
- Gérer les zones sûres mobiles (`env(safe-area-inset-*)`).

---

## 4. Pile technique

| Domaine | Choix |
|---|---|
| Langage | **TypeScript** (mode `strict`) |
| Outil de build | **Vite** |
| Interface | **HTML + CSS** natifs (pas de framework UI), composants en modules TS |
| Rendu | **WebGL 2** (GLSL `#version 300 es`) |
| Maths | **gl-matrix** |
| Icônes | **Lucide** |
| Stockage | **IndexedDB** via `idb-keyval`, projets au format **JSON** versionné |
| Export | **gifenc** (GIF ; remplace gif.js, non maintenu et qui exige un fichier worker), **MediaRecorder** (vidéo MP4, ou WebM si le navigateur n'enregistre pas le MP4), `canvas.toBlob` + **fflate** (séquence PNG en archive ZIP) |
| IA (V2) | Entraînement **PyTorch** → inférence **ONNX Runtime Web** |
| Web | **PWA** (`vite-plugin-pwa`), hébergement Cloudflare Pages / Netlify |
| Android | **Capacitor** |
| Tests | **Vitest** (`npm test`) |
| Débogage WebGL | Spector.js |

---

## 5. Architecture

### 5.1 Arborescence cible
```
src/
├── main.ts              # Point d'entrée : monte l'UI, branche les modules
├── core/                # Logique pure, sans DOM ni WebGL
│   ├── events.ts        # Bus d'événements typé
│   ├── store.ts         # État global de l'application
│   ├── intents.ts       # Traduit les événements de l’UI vers le Projet et la Session
│   └── types.ts         # Types partagés (Node, Skeleton, Frame, Project…)
├── model/               # Squelette, frames, cinématique directe
│   └── project/         # Module Projet : invariants + historique annuler / rétablir (ADR 0001)
├── render/              # WebGL 2 : contexte, shaders, rendu du squelette
│   └── shaders/
├── animation/           # Lecture, interpolation, timeline
├── ai/                  # Fonctionnalités IA (fluidité, répétition)
├── storage/             # Sauvegarde / chargement (IndexedDB)
├── export/              # GIF, PNG, MP4
└── ui/
    ├── components/      # Un fichier par composant (toolbar, timeline, panel…)
    ├── icons.ts         # Icônes Lucide centralisées
    └── styles/
        ├── tokens.css   # Variables de design (couleurs, espaces, rayons, ombres)
        ├── base.css     # Reset et styles globaux
        ├── layout.css   # Grille principale
        └── components/  # Un fichier CSS par composant
```

Fichiers ajoutés en phase 1, en plus de l'arborescence ci-dessus :
```
src/core/intents.ts      # Traduit les événements de l'UI en changements du store
src/core/id.ts           # Génération d'identifiants
src/ui/component.ts      # Contrat Component { mount, destroy } + ComponentContext { bus, store }
src/ui/dom.ts            # Aide h() de création d'éléments, ids partagés, media query du tiroir
src/ui/strings.ts        # Tous les textes de l'interface (français)
src/ui/controls/         # Primitives réutilisables : icon-button, switch, segmented, slider, stepper
src/ui/styles/controls.css
```

Fichiers ajoutés en phase 2 (rendu WebGL 2, stickman fixe) :
```
src/model/skeleton.ts        # Squelette par défaut + sortSkeleton (validation, tri parents avant enfants)
src/model/kinematics.ts      # solvePose : cinématique directe (angles relatifs → positions du monde)
src/render/camera.ts         # Monde → découpage (gl-matrix) ; STAGE_WORLD_HEIGHT = 400 unités visibles
src/render/scene.ts          # Nœuds posés → capsules (segment épais / disque) + empaquetage GPU
src/render/color.ts          # Lecture des couleurs hexadécimales des tokens
src/render/renderer.ts       # Contexte WebGL 2, programme, capsules instanciées, perte de contexte
src/render/stickman-view.ts  # Relie store / bus / thème au rendu (à la demande, via requestAnimationFrame)
src/render/shaders/capsule.{vert,frag}.glsl   # Capsules remplies par champ de distance
src/**/*.test.ts             # Tests Vitest, à côté du fichier testé
```

Fichiers ajoutés en phase 3 (manipulation des nœuds) :
```
src/model/angle.ts                     # normalizeAngle : angles dans (-π, π]
src/interaction/picking.ts             # pickNode : nœud dont la poignée est sous le pointeur
src/interaction/node-drag.ts           # startNodeDrag : rotation autour du parent, ou déplacement par la racine
src/interaction/node-keys.ts           # cycleNode / nudgeNode : sélection et rotation au clavier
src/interaction/node-manipulation.ts   # Contrôleur sans DOM : stage:pointer:* / node:* → node:select, frame:pose:change
```
`render/camera.ts` gagne `screenToWorld` / `pixelsToWorld`, `render/scene.ts` gagne `buildHandles` (poignées), et le rendu dessine des **couches** de couleurs différentes.

Fichiers ajoutés en phase 4 (animation) :
```
src/animation/playback.ts     # frameDuration / advancePlayhead : horloge de lecture pure (boucle)
src/animation/player.ts       # connectPlayer : avance la tête de lecture tant que la Session lit (planificateur et horloge injectables)
src/animation/onion-skin.ts   # onionSkinFrame : frame précédente, hors lecture
src/render/thumbnail.ts       # paintThumbnail : vignette Canvas 2D d'une frame (même cadrage vertical que la scène)
src/model/sequence.ts         # deriveSequence : images clés + frames générées + transition de Répétition (candidat 2, phase 5)
src/model/interpolation.ts    # interpolateKeyframes : linéaire / Catmull-Rom / ease-in-out (phase 5)
src/core/selectors.ts         # sequenceOf / activeFrame / saveStatus : lectures dérivées de l'état
```

Fichiers ajoutés en phase 6 (sauvegarde et export) :
```
src/storage/project-file.ts     # Format de fichier versionné (stickflow-project v1) + validation à la lecture
src/storage/library.ts          # Bibliothèque de projets sur un magasin clé-valeur (port KeyValueStore)
src/storage/idb-store.ts        # Adaptateur IndexedDB (idb-keyval, base « stickflow », table « projects »)
src/storage/memory-store.ts     # Adaptateur mémoire (tests, repli sans IndexedDB)
src/storage/project-storage.ts  # Contrôleur : enregistrer, enregistrer sous, ouvrir, liste
src/export/export-plan.ts       # Plan d'export pur : frames, passages, délai, compteur de boucle GIF, nom de fichier
src/export/gif.ts / zip.ts      # Encodeurs GIF (gifenc) et ZIP (fflate), testés sans navigateur
src/export/exporter.ts          # Rendu hors écran + encodage GIF / PNG / vidéo (navigateur uniquement)
src/render/canvas2d.ts          # paintPose : dessin Canvas 2D partagé par les vignettes et l'export
src/ui/components/projects-dialog.ts  # Dialogue « Ouvrir un projet » (<dialog> natif)
src/ui/download.ts              # Remise du fichier exporté (lien de téléchargement)
src/types/gifenc.d.ts           # Types minimaux de gifenc
```
`render/camera.ts` gagne `worldToScreen`. La Session gagne `onionSkin` et `clipboard` (pose copiée).
Il n’y a pas de `core/history.ts` : l’historique est interne au module Projet (`src/model/project/`), par instantanés (voir `docs/adr/0001-historique-par-instantanes.md`).

### 5.2 Règles d'architecture
- **Séparation stricte** : `core/` et `model/` ne connaissent ni le DOM ni WebGL. L'UI ne dessine pas sur le canvas : elle émet des événements.
- **Communication par bus d'événements typé** : l'UI émet des intentions (`playback:play`, `frame:add`, `ai:smoothing:change`…), les modules les écoutent. Aucun module n'importe directement un composant UI.
- **État centralisé** dans `store.ts`, l'UI se met à jour en s'abonnant aux changements.
- **Composants UI** : chaque composant expose `mount(parent)` et, si besoin, `destroy()`. Les éléments interactifs portent un attribut `data-action` pour faciliter le branchement.
- **Design tokens** : aucune couleur ou taille « en dur » dans les composants, uniquement des variables CSS de `tokens.css`.
- Toute modification du **Projet** passe par le module Projet, qui l’ajoute à l’historique (annuler / rétablir). Un changement de la Session n’est jamais annulable.
- **Flux unidirectionnel** : un composant émet un événement → `core/intents.ts` le traduit en changement nommé du Projet (module Projet pur) ou en mise à jour de la Session, puis met à jour le store → le composant se redessine via `store.watch(selector, listener)`. Les contrôles sont « contrôlés » : ils n'affichent que l'état venu du store.
- La valeur d'un attribut `data-action` est **le nom de l'événement émis** (ex. `data-action="frame:add"`).
- Les composants reçoivent `{ bus, store }` par injection et ne s'importent jamais entre eux ; ils peuvent utiliser les primitives de `ui/controls/`.
- **Repère du monde** : origine au centre de la scène, y vers le haut, angles en radians (0 = vers +x). La caméra montre une hauteur fixe de monde ; la largeur suit le rapport d'aspect.
- **Rendu** : `main.ts` passe le canvas `#stage` à `connectStickmanView`. Le rendu lit la taille au moment de dessiner (`canvas.width`/`height`), redessine tout de suite sur `canvas:resize` (évite un clignotement) et à la demande sinon. Les couleurs lues par WebGL viennent des tokens CSS et doivent rester en **hexadécimal** (ex. `--color-stickman`).
- **Manipulation** : `CanvasArea` émet le pointeur brut (`stage:pointer:*`, en pixels CSS avec la taille du canvas) et les touches (`node:cycle`, `node:nudge`, `node:select`) ; `interaction/node-manipulation.ts` fait la sélection et le glisser, et émet `frame:pose:change` (frame désignée par son **id**). Zone de saisie d'une poignée : 22 px CSS de rayon (cible de 44 px). Pas de manipulation pendant la lecture ; les poignées ne s'affichent qu'en mode Personnage.
- **Règles de manipulation** : glisser un nœud le fait tourner autour du bout de son parent (ses descendants suivent) ; glisser la racine déplace toute la figure ; modifier une frame générée (glisser, coller, « + ») la convertit en nouvelle image clé entre ses voisines, qui devient la frame active. Clavier sur le canvas : ↑ / ↓ choisir un nœud, ← / → tourner de 5° (Maj : 1°), Échap désélectionner.
- **Lecture** : parcourt la séquence au rythme IPS × vitesse, autant de fois que la Répétition l'indique (coupée : une fois puis arrêt sur la dernière frame ; « Infini » : en boucle ; sinon N passages). Lancée depuis la dernière frame, elle repart du début ; un saut de plus de 250 ms (onglet masqué) est plafonné. Pause garde la frame courante ; **Stop** revient à la frame active au lancement. Espace bascule lecture / pause (y compris sur les boutons de lecture, pas sur les autres boutons ni dans un champ). La lecture ne touche jamais au Projet (`playback:frame` met à jour la Session).
- **Frames** : « + » insère une copie de la frame active juste après elle (c'est aussi « dupliquer ») ; Supprimer (bouton ou Suppr sur une vignette) retire l'image clé active, jamais la dernière, et ne s'applique pas à une frame générée ; Copier / Coller la pose passe par la Session, et coller est annulable. Vignettes : conservées par id de frame, seule celle qui change est repeinte ; frames générées dessinées en couleur d'accent.
- **Pelure d'oignon** : frame précédente en transparence sous la frame active, réglable dans la section Animation, masquée pendant la lecture.
- **Sauvegarde** : le fichier (`stickflow-project`, version 1) ne contient que nom, IPS, squelette, images clés et réglages IA. À la lecture, la structure est vérifiée (`ProjectFileError`, version plus récente refusée), puis `createHistory` applique les bornes. La bibliothèque passe par le port `KeyValueStore` (deux adaptateurs : IndexedDB, mémoire). La Session retient `documentId` et `savedProject` ; `saveStatus` vaut « jamais enregistré », « enregistré » ou « modifié » (comparaison par référence du Projet). Ouvrir remplace le Projet et repart d'un historique vierge. « Enregistrer sous » renomme en « <nom> (copie) » et enregistre sous un nouvel id. Le nom du projet se modifie dans l'en-tête (changement nommé `rename`, annulable, frappes regroupées). Raccourcis : Ctrl/⌘+S enregistrer, Ctrl/⌘+O ouvrir. Les erreurs et confirmations passent par `session.notice`, affichée sous le bouton Exporter.
- **Export** : 1280 × 720, mêmes couleurs quel que soit le thème (fond blanc, stickman foncé ; PNG sur fond transparent). Répétition coupée : une lecture ; infinie : GIF en boucle, vidéo et PNG d'un passage ; N répétitions : compteur de boucle du GIF, N passages dans la vidéo, un passage en PNG. La vidéo est enregistrée en temps réel (une image par frame, au rythme de l'IPS) ; une vidéo vide est signalée comme un échec. `session.exportProgress` (0 à 1) désactive le bouton et affiche l'avancement.
- Le panneau gauche devient un tiroir sous **900 px** de large (`DRAWER_MEDIA_QUERY` dans `ui/dom.ts`, dupliqué dans les CSS car les variables CSS sont interdites dans les media queries).

### 5.2 bis Événements du bus (`AppEvents` dans `core/events.ts`)
| Événement | Payload |
|---|---|
| `history:undo`, `history:redo` | — |
| `playback:play`, `playback:pause` | — |
| `playback:speed:change` | `{ speed: 1 \| 2 \| 5 \| 10 }` |
| `frame:select` | `{ index }` |
| `frame:add` | — |
| `project:save` | — |
| `editor:mode:change` | `{ mode: 'character' \| 'selection' \| 'scene' }` |
| `ai:smoothing:change` | `Partial<SmoothingSettings>` |
| `ai:loop:change` | `Partial<LoopSettings>` |
| `animation:fps:change` | `{ fps }` |
| `export:format:change` | `{ format: 'gif' \| 'png' \| 'mp4' }` |
| `export:request` | `{ format }` |
| `ui:drawer:toggle` | `{ open }` |
| `canvas:resize` | `{ width, height, pixelRatio }` (pixels physiques du canvas) |
| `stage:pointer:down` / `move` / `up` | `{ pointerId, x, y, width, height }` (pixels CSS) |
| `node:select` | `{ nodeId: string \| null }` |
| `node:cycle` | `{ direction: 1 \| -1 }` |
| `node:nudge` | `{ radians }` |
| `frame:pose:change` | `{ frameId, pose, rootPosition }` |
| `frame:delete`, `frame:copy`, `frame:paste` | — (agissent sur la frame active) |
| `playback:stop` | — |
| `playback:frame` | `{ index }` (émis par le lecteur) |
| `animation:onion-skin:change` | `{ enabled }` |
| `project:rename` | `{ name }` |
| `project:save-as` | `{ name }` |
| `project:open` | `{ projectId }` |
| `project:library:request`, `project:library:close` | — (dialogue « Ouvrir ») |

La vitesse de prévisualisation comprend **x1** (vitesse normale) en plus de x2 / x5 / x10, pour qu'une valeur soit toujours sélectionnée.

### 5.3 Modèle de données (ébauche)
```ts
interface SkeletonNode {
  id: string;
  parentId: string | null;
  length: number;   // longueur du segment vers le parent (diamètre pour un cercle)
  angle: number;    // angle de repos, radians, relatif au parent
  shape: 'segment' | 'circle';   // trait épais, ou disque plein (la tête)
}

interface Keyframe {               // image clé : la seule frame enregistrée (ADR 0002)
  id: string;
  pose: Record<string, number>;   // angle de chaque nœud (absent = angle de repos)
  rootPosition: { x: number; y: number };
}

interface Project {
  name: string;
  fps: number;                    // 1 à 60
  skeleton: SkeletonNode[];
  keyframes: Keyframe[];
  ai: {
    smoothing: { enabled: boolean; intensity: number; curve: 'linear' | 'smooth' | 'ease-in-out' };
    loop: { enabled: boolean; repeatCount: number; infinite: boolean; transitionFrames: number };
  };
}
```

**Séquence dérivée** (revue d'architecture, candidat 2, **réalisé** — ADR 0002) : `model/sequence.ts` calcule `deriveSequence(project)` = images clés + frames générées (`SequenceFrame`, `kind: 'keyframe' | 'generated'`, avec `from`, `to`, `step`). Pur et mémoïsé : même tableau tant que images clés, squelette et Fluidité sont inchangés, et mêmes objets pour les segments intacts (vignettes non repeintes). Interpolation par `model/interpolation.ts` selon la courbe (voir 2.2). Avec la Répétition (et au moins 2 images clés), la séquence est une **boucle** : `transitionFrames` frames générées suivent la dernière image clé pour revenir à la première, et la spline prend ses voisines en boucle ; la transition suit la courbe de la Fluidité, ou la courbe Douce si la Fluidité est coupée. Les segments sont mis en cache par image clé de départ ; en Linéaire, seules les deux images clés du segment comptent, sinon aussi leurs voisines. La Session désigne la frame active par son **id** (`activeFrameId`) ; `core/selectors.ts` fournit `sequenceOf(state)` et `activeFrame(state)` (frame + position). Les événements gardent des **positions** dans la séquence (`frame:select`, `playback:frame`) ; `intents.ts` les traduit en id.

Module Projet (revue d'architecture, candidat 1, **réalisé**) — `src/model/project/` (`changes.ts` : changements nommés et invariants, `history.ts` : historique), `src/core/session.ts`, store `{ project: ProjectHistory, session: Session }` :
- Le **Projet** (nom, IPS, squelette, frames, réglages IA) est séparé de la **Session** (frame active, lecture, vitesse, mode, tiroir, format d'export). Voir `GLOSSARY.md`.
- Toute modification du Projet est annulable ; aucune modification de la Session ne l'est.
- Les valeurs hors limites sont ramenées dans leurs bornes, jamais rejetées.
- Un Projet contient toujours au moins une image clé.
- Le nombre de répétitions est conservé même en répétition infinie (`repeatCount` + `infinite`, et non plus `repeat: number | 'infinite'`).
- Le module Projet est testé avec **Vitest**, uniquement par son interface, sans DOM.
- Le module Projet est **pur** (état d’historique + changement → nouvel état d’historique) ; le store tient tout l’état en deux parties, `project` et `session`.
- Après chaque changement du Projet (y compris annuler / rétablir), la frame active est gardée si elle existe encore, sinon remplacée par la frame à la même place dans la nouvelle séquence (`fitSessionToSequence`).
- L'interface décrit un changement du Projet par une **liste fermée de changements nommés** (régler l'IPS, ajouter une frame, modifier la Fluidité…), jamais par un correctif libre.
- `intents.ts` n'est plus qu'un aiguillage sans règle : changement nommé vers le Projet ou mise à jour de la Session, avec l'heure du changement (le module Projet reste pur).
- Les boutons Annuler / Rétablir sont désactivés quand il n'y a rien à annuler / rétablir.
- Seul le module Projet applique les bornes ; le stepper ne corrige plus les valeurs (il rejette seulement les saisies non numériques).
- Changements nommés : `setFps`, `updateSmoothing`, `updateLoop`, `insertKeyframe` (après une image clé, avec une pose donnée ou une copie de la précédente), `deleteKeyframe`, `poseKeyframe`. Regroupés en une étape s'ils sont du même réglage et à moins de 1 s d'intervalle ; une image clé insérée **avec** une pose se regroupe avec les poses qui la suivent (conversion d'une frame générée par glisser = une étape). Les bascules (activé, courbe, infini), les copies et les suppressions ne sont jamais regroupées.
- L'interface ne lit que `state.project.present`, `canUndo(state.project)` / `canRedo(state.project)` et `state.session`.
- Raccourcis : Ctrl/⌘+Z annuler, Ctrl/⌘+Maj+Z ou Ctrl+Y rétablir (sauf dans un champ de saisie).

---

## 6. Feuille de route

1. **Phase 1 — Interface HTML/CSS** : coquille de l'app selon la maquette, composants, tokens, bus d'événements. Aucune logique d'animation.
2. **Phase 2 — Rendu WebGL 2** : contexte, shaders, affichage d'un stickman fixe. ✅
3. **Phase 3 — Manipulation** : sélection et rotation des nœuds au toucher / à la souris. ✅
   - Puis : module Projet (candidat 1 de la revue d'architecture, voir 5.3). ✅
4. **Phase 4 — Animation** : frames, timeline fonctionnelle, lecture, pelure d'oignon, annuler / rétablir. ✅
   - Puis : séquence dérivée (candidat 2, ADR 0002). ✅
5. **Phase 5 — Fluidité et Répétition (V1)** : splines + easing, boucle intelligente. ✅
6. **Phase 6 — Sauvegarde et export** : IndexedDB, GIF / PNG / MP4. ✅
7. **Phase 7 — PWA et Android** : `vite-plugin-pwa`, Capacitor, test fermé Google Play.
8. **Phase 8 — IA avancée** : modèle de *motion in-betweening*, effets prédéfinis, prompt.

---

## 7. Conventions
- Vocabulaire métier : utiliser les termes de **`GLOSSARY.md`** (Projet, Session, image clé, frame générée…). Les décisions d'architecture durables vont dans `docs/adr/`.
- Code et noms de fichiers en **anglais** ; textes de l'interface en **français** (centralisés pour une traduction future).
- TypeScript strict, pas de `any`.
- Petits fichiers à responsabilité unique.
- **Tests d'abord** : pour toute logique nouvelle, écrire les tests Vitest (`*.test.ts` à côté du fichier) et les voir échouer, puis implémenter. Ce qui ne se teste pas en unitaire (WebGL, DOM) est vérifié dans le navigateur. `npm test` doit passer avant chaque commit.
- Commits courts et descriptifs, une fonctionnalité par commit.
