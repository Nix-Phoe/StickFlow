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
- Éditeur de squelette (ajout / suppression de nœuds, formes), décor animé (l'environnement est statique en v1.0), zones de texte.

### 2.4 Version 1.0 (réalisée)
- **Plusieurs personnages** : chacun a son squelette, son apparence et sa pose dans chaque image clé ; ajouter, renommer, dupliquer, masquer, verrouiller, réordonner, supprimer. La Fluidité et la Répétition interpolent chaque personnage indépendamment.
- **Apparence** : couleur du personnage entier ou de chaque partie (segment désigné par l'id de son nœud enfant, la tête comprise), taille de 50 à 200 %.
- **Coloration partielle** (après la v1.0) : **zones de couleur** le long d'une partie (manche courte, short, chaussures, cheveux…), éditées dans la fenêtre « Coloration partielle » : aperçu cliquable du personnage, tenues toutes faites (T-shirt, Pull, Short, Pantalon, Chaussures, Cheveux), symétrie gauche / droite, début / fin / couleur de chaque zone (4 par partie au plus).
- **Grande palette** : roue chromatique, luminosité, harmonies (Aucune / Analogue / Complémentaire / Triadique), blanc / noir, pipette, champ HEX, 8 couleurs récentes sauvegardées avec le projet.
- **Environnement** : arrière-plan, formes vectorielles (Carré, Cercle, Rectangle, Triangle, Ligne, Remplir) et calque de dessin matriciel (Stylo fin, Feutre, Pinceau, Gomme, Plume, Aérographe).
- **Panneau flottant « Personnages & Environnement »** ouvert par un bouton de la barre supérieure ; son onglet choisit le mode d'édition.
- **Un seul bouton Lecture / Pause.**

### 2.5 Version 2.0 (réalisée) : page d'accueil
- L'app s'ouvre sur l'**Accueil** ; l'éditeur est une page (`#/editor/:id`) avec un bouton retour qui enregistre le projet.
- **Formats de vidéo** : YouTube 16:9 (1920 × 1080), Vertical 9:16 (1080 × 1920), Carré 1:1 (1080 × 1080), Portrait 4:5 (1080 × 1350), ou Personnalisé (256 à 3840 px). Mêmes noms partout (v2.0.1, voir 5.2). Enregistré dans le Projet, modifiable dans l'éditeur (section « Format de la vidéo », avertissement si des éléments sortent du cadre) ; la scène montre le cadre, l'extérieur assombri ; l'export est à la résolution du format.
- **Accueil** : barre latérale (logo, navigation, Réglages), bannière (recherche en direct, raccourcis ronds par format : création en un clic, « Libre » ouvre la feuille de création), carrousel « Commencer avec un modèle », « Mes projets » (8 plus récents, « Voir tout »), « Mes vidéos », bouton flottant « + » et feuille de création complète.
- **Cartes de projet** : vignette (aperçu animé au survol), badge du format, IPS, nombre d'images, date relative, menu « ⋮ » (Ouvrir, Renommer, Dupliquer, Exporter, Supprimer) ; tri (Modifié, Créé, A-Z, Z-A) et vue (grille ou liste) mémorisés ; état vide illustré.
- **Modèles de départ** : Marche, Course, Saut, Coup de poing, Salut de la main, Vide (fichiers JSON).
- **Mes vidéos** : les exports GIF et vidéo sont aussi conservés dans l'app ; lecteur (lecture, plein écran, télécharger, partager, supprimer), espace de stockage utilisé.
- **Réglages** : thème Automatique / Clair / Sombre, format et IPS par défaut, effacer les vidéos stockées.
- **Version 2.0.1** : la création de projet n'est plus en double. Le panneau « Nouveau projet » de la barre latérale est retiré ; chaque point d'entrée a un rôle (voir 5.2, « Création de projet ») ; les noms des formats sont harmonisés.

### 2.6 Version 2.1 (réalisée) : arrière-plan personnalisé
- Dans l'onglet **Environnement**, une section « Arrière-plan » (au-dessus de « Formes ») : une ligne (vignette, « Arrière-plan », type actuel, chevron) ouvre une **sous-page** qui glisse de droite à gauche, avec **‹ Retour** (navigation iOS ; même chose dans la feuille du bas sur mobile).
- Sous-page : aperçu aux proportions du format, crédit d'une photo, réglages d'une image, « Retirer l'arrière-plan », puis un contrôle segmenté `Couleur | Intégrés | Appareil | Internet`.
  - **Couleur** : couleur unie (`ColorPicker`) ou **dégradé** (deux couleurs, angle).
  - **Intégrés** : Ciel de jour, Coucher de soleil, Nuit étoilée, Sol et horizon, Quadrillage de studio, Salle simple — dessinés par le code (`src/environment/backgrounds/`), hors ligne, sans droits à gérer.
  - **Appareil** : « Choisir une image » (galerie et appareil photo sur mobile), glisser-déposer sur l'onglet ou sur la scène, collage (Ctrl/⌘+V) ; PNG, JPEG, WebP (première image d'un GIF), 20 Mo au plus, **jamais de SVG** ; 8 images récentes.
  - **Internet** : recherche de photos libres **Pexels** (défilement infini, crédit du photographe) et import par adresse, toujours via le **proxy d'images** (Cloudflare Worker, `server/image-proxy`) ; message clair si le proxy n'est pas configuré ou hors ligne.
- Réglages d'une image : ajustement (Remplir, Ajuster, Étirer, Mosaïque), point focal (glisser l'aperçu ou flèches), zoom 100 à 300 %, flou 0 à 20 px, luminosité, opacité, voile de couleur facultatif.
- L'arrière-plan suit le cadre du format, apparaît dans la scène, les vignettes, l'aperçu des cartes et tous les exports ; il est le même dans toutes les frames et chaque changement s'annule.

---

## 3. Interface (UI)

### 3.1 Disposition (d'après la maquette Figma)
```
┌──────────────┬──────────────────────────────────────────────┐
│  EN-TÊTE      │   BARRE D'OUTILS                             │
│  (logo, mode, │   [👤] [↶] [↷]  [▶/⏸] [■]  x1 x2 x5 x10      │
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

- **Panneau gauche** : en-tête (bouton retour vers l'accueil — chevron + logo —, nom du projet, indicateur « Mode : Personnages / Environnement », sauvegarder), section « Améliorations IA » (Fluidité, Répétition), section « Animation » (IPS), section « Format de la vidéo » (v2.0), puis bouton **Exporter** avec choix du format en bas. Il n'a plus de sélecteur de mode (v1.0).
- **Barre supérieure** : bouton à libellé « Personnages & Environnement · Ajouter ou modifier » placé juste à gauche du module de lecture (ouvre le panneau flottant ; titre sur deux lignes puis icônes seules quand la barre rétrécit, requêtes de conteneur), puis le module : annuler, rétablir, Lecture / Pause (un seul bouton), Stop, vitesses x1 / x2 / x5 / x10.
- **Panneau flottant** (v1.0) : popover ancré sous son bouton, onglets `Personnages | Environnement` ; feuille du bas sous 600 px de large. L'onglet Environnement est une **pile de pages** (v2.1) : la page principale (ligne « Arrière-plan », formes, outils de dessin, réglages) et la sous-page « Arrière-plan » qui glisse par-dessus (Retour ou Échap pour revenir).
- **Zone centrale** : canvas de dessin.
- **Barre inférieure** : timeline des frames + bouton « + ».

Accueil (v2.0) :
```
┌──────────────┬──────────────────────────────────────────────────────┐
│ [logo]       │  BANNIÈRE : « Que voulez-vous animer aujourd'hui ? » │
│ StickFlow    │  [ 🔍 Rechercher un projet ou un modèle ]            │
│ ⌂ Accueil    │  (YouTube) (Vertical) (Carré) (Portrait) (+ Libre)   │
│ ▢ Projets    ├──────────────────────────────────────────────────────┤
│ ✦ Modèles    │  Commencer avec un modèle      [‹] [›]  Voir tout    │
│ ▶ Vidéos     ├──────────────────────────────────────────────────────┤
│              │  Mes projets      [Trier ▾] [▦|☰]       Voir tout    │
│              │  [carte] [carte] [carte] [carte]                     │
│              ├──────────────────────────────────────────────────────┤
│              │  Mes vidéos                             Voir tout    │
│ ⚙ Réglages   │                    ( + ) quand la bannière est cachée│
└──────────────┴──────────────────────────────────────────────────────┘
```
Sous 900 px : la navigation devient une **barre d'onglets** en bas (Accueil, Projets, Modèles, Vidéos), une barre du haut porte le logo et les Réglages, et le bouton « + » est toujours visible, au-dessus de la barre d'onglets.

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
| Stockage | **IndexedDB** via `idb-keyval`, projets au format **JSON** versionné ; images d'arrière-plan en Blob (magasin d'assets, v2.1) |
| Images en ligne (v2.1) | API **Pexels** derrière un **Cloudflare Worker** sans dépendance (`server/image-proxy`, clé en secret) |
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
src/render/stickman-view.ts  # (devenu stage-view.ts en v1.0) Relie store / bus / thème au rendu (à la demande, via requestAnimationFrame)
src/render/shaders/capsule.{vert,frag}.glsl   # Capsules remplies par champ de distance
src/**/*.test.ts             # Tests Vitest, à côté du fichier testé
```

Fichiers ajoutés en phase 3 (manipulation des nœuds) :
```
src/model/angle.ts                     # normalizeAngle : angles dans (-π, π]
src/interaction/picking.ts             # pickNode : nœud dont la poignée est sous le pointeur
src/interaction/node-drag.ts           # startNodeDrag : rotation autour du parent, ou déplacement par la racine
src/interaction/node-keys.ts           # cycleNode / nudgeNode : sélection et rotation au clavier
src/interaction/node-manipulation.ts   # (devenu character-manipulation.ts en v1.0) Contrôleur sans DOM : stage:pointer:* / node:* → node:select, frame:pose:change
```
`render/camera.ts` gagne `screenToWorld` / `pixelsToWorld`, `render/scene.ts` gagne `buildHandles` (poignées), et le rendu dessine des **couches** de couleurs différentes.

Fichiers ajoutés en phase 4 (animation) :
```
src/animation/playback.ts     # frameDuration / advancePlayhead : horloge de lecture pure (boucle)
src/animation/player.ts       # connectPlayer : avance la tête de lecture tant que la Session lit (planificateur et horloge injectables)
src/animation/onion-skin.ts   # onionSkinFrame : frame précédente, hors lecture
src/render/thumbnail.ts       # paintThumbnail / thumbnailLayers : vignette Canvas 2D d'une frame, la même scène que le rendu final (même cadrage)
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
Fichiers ajoutés en version 1.0 (plusieurs personnages, apparence, palette, environnement) :
```
src/model/character.ts                  # createCharacter, placeNewCharacter (décalage), posedCharacter, characterBounds, partColor
src/model/color.ts                      # HEX ⇄ RGB ⇄ HSV, harmonies, roue (angle = teinte, rayon = saturation), pastilles prédéfinies
src/model/shape.ts                      # Formes : création par glisser (Maj), test de toucher par type, poignées, déplacer / redimensionner / pivoter
src/model/drawing-layer.ts              # Calque de dessin : taille fixe dans le monde, tuiles de 256 px (ADR 0003)
src/storage/migrate.ts                  # migrateProject : fichier v1 (un squelette) → v2 (un personnage)
src/render/scene-layers.ts              # buildSceneLayers : ordre des couches, contexte inactif atténué, rendu final sans aides
src/render/stage-view.ts                # (remplace stickman-view.ts) relie store / bus / thème / calque de dessin au rendu
src/render/shaders/shape.{vert,frag}.glsl  # Formes par champ de distance (contour, remplissage)
src/render/shaders/image.{vert,frag}.glsl  # Calque de dessin texturé
src/drawing/surface.ts                  # Canvas hors écran reflétant les tuiles du Projet ; encode les tuiles touchées
src/drawing/brush.ts                    # Tampons de chaque outil de dessin, lissage du tracé
src/drawing/flood-fill.ts               # Remplissage par diffusion (pot de peinture), pur
src/drawing/drawing-tool.ts             # Trait en direct sur le calque, puis drawing:stroke au relâchement
src/interaction/hit-test.ts             # pickCharacterTarget : poignée > partie > personnage
src/interaction/character-manipulation.ts  # (remplace node-manipulation.ts) sélection et glisser des personnages
src/interaction/shape-manipulation.ts   # Sélection, création, déplacement, poignées, Remplir
src/ui/controls/color-picker.ts         # ColorPicker réutilisable (roue, harmonies, pipette, HEX, récentes)
src/ui/components/editor-panel.ts       # Panneau flottant, onglets, raccourcis C / E / Tab / Suppr / Ctrl+D
src/ui/components/characters-tab.ts     # Liste des personnages + inspecteur Apparence
src/ui/components/environment-tab.ts    # Grille d'outils + réglages de l'outil actif
src/ui/styles/color-picker.css, components/{editor-panel,characters-tab,environment-tab}.css
src/test/fixtures.ts                    # Fabriques de personnages, formes, frames et projets pour les tests
```
Coloration partielle (après la v1.0) :
```
src/model/color-bands.ts                # normalizeBands, bandStops (tronçons visibles), mirrorPart (gauche ⇄ droite), OUTFITS / outfitBands
src/render/character-preview.ts         # previewFraming (personnage seul, centré, agrandi), paintCharacterPreview (vignettes, aperçu)
src/ui/controls/part-chips.ts           # Pastilles de parties (inspecteur Apparence et fenêtre), de la tête aux pieds
src/ui/components/partial-paint-window.ts  # Fenêtre « Coloration partielle »
src/ui/styles/components/partial-paint-window.css
docs/adr/0003-calque-de-dessin-en-tuiles.md
```
`render/canvas2d.ts` gagne `paintScene` (même scène que WebGL, pour l'export et les vignettes) ; `render/renderer.ts` a trois programmes instanciés (capsules colorées, formes, calque) et `readPixel` (pipette de secours).

Fichiers ajoutés en version 2.0 (accueil, formats, vidéos) :
```
src/core/router.ts                      # parseRoute / routeToHash / createRouter (port HashPort) : #/, #/projects, #/templates, #/videos, #/editor/:id
src/core/formats.ts                     # Préréglages de format, normalizeFormat (taille libre paire, 256 à 3840), aspectRatio, ratioLabel
src/core/home-state.ts                  # État de l'accueil, tri / recherche (shownProjects), préférences (normalizePreferences), vidéos (videosToPrune)
src/core/home-intents.ts                # Aiguillage de l'accueil : créer, ouvrir, renommer, dupliquer, supprimer, exporter, vidéos, préférences
src/model/format-fit.ts                 # Cadre du format dans le monde (frameWorldSize), éléments qui en sortent (outOfFrame)
src/model/new-project.ts                # createProject (stickman au repos ou copie d'un modèle), uniqueName
src/storage/video-store.ts              # Vidéos conservées (Blob), magasin séparé
src/storage/preferences.ts              # Préférences de l'appareil (localStorage, ou mémoire)
src/templates/*.json, index.ts          # Modèles de départ (fichiers de projet v3), loadTemplate (copie)
src/views/view-host.ts                  # Contrat View { mount, destroy, update?, leave? } ; enchaîne les changements de route
src/views/editor-view.ts                # L'éditeur encapsulé : son bus, son store, ses modules ; sauvegarde automatique en partant
src/views/home-view.ts                  # L'accueil : son bus, son store (Store<HomeState>), ses sections
src/views/project-previewer.ts          # Aperçu animé d'une carte (un seul à la fois), vignettes manquantes
src/ui/assets/logo.svg, ui/logo.ts      # Logo (stickman en course sur sa courbe de mouvement), en currentColor
src/ui/theme.ts                         # applyTheme : data-theme sur <html> (Automatique / Clair / Sombre)
src/ui/format.ts, ui/relative-time.ts   # Durées, tailles de fichiers, noms des formats (v2.0.1), dates relatives (« il y a 2 h »)
src/ui/controls/format-picker.ts        # Choix du format (liste ou vignettes, aperçu aux proportions, taille libre)
src/ui/controls/menu.ts, sheet.ts       # Menu « ⋮ » au clavier ; feuille modale iOS (<dialog>)
src/ui/components/home/                 # sidebar (logo, navigation, Réglages), top-bar, hero-banner, format-shortcuts, template-carousel, project-grid, project-card,
                                        # video-grid, video-player-sheet, create-project-sheet, export-sheet, settings-sheet,
                                        # floating-add-button, home-notice, context (HomeContext)
src/ui/styles/components/home/          # Un fichier CSS par composant de l'accueil
docs/adr/0004-vues-et-index-des-projets.md
```

Fichiers ajoutés en version 2.1 (arrière-plan) :
```
src/model/background.ts                 # imageBackground, normalizeBackground (bornes), mergeBackground (réglages), backgroundAssetIds
src/storage/asset-store.ts              # Magasin d'assets (Blob, vignette, récents, removeUnused) ; base « stickflow-assets »
src/environment/background-layout.ts    # Ligne d'un dégradé (CSS), place d'une image (ajustement, point focal, zoom), mosaïque
src/environment/backgrounds/            # Arrière-plans intégrés : une fonction de dessin par fichier, index.ts (BUILTIN_BACKGROUNDS)
src/environment/paint-background.ts     # Composition Canvas 2D de l'arrière-plan dans le cadre (effets par ctx.filter, voile)
src/environment/background-surface.ts   # Canvas composé de l'éditeur (version, onChange) ; composeBackground (export)
src/environment/asset-images.ts         # Images décodées des assets (cache de 4)
src/environment/image-import.ts         # checkImageFile, importSize, processImage (WebP / JPEG, vignette), processImageOffThread
src/environment/image-worker.ts         # Worker de traitement des images importées
src/environment/asset-importer.ts       # asset:import / asset:apply → magasin d'assets → background:set (sans DOM)
src/environment/stock-client.ts         # Client du proxy : search, download, StockError
src/environment/stock-search.ts         # stock:search (pages), stock:import, url:import (sans DOM)
src/ui/components/background/           # background-page (sous-page), color-pane, builtin-pane, device-pane, internet-pane,
                                        # image-settings, context (aperçu, jeton de geste, grilles au clavier)
src/ui/transfer.ts                      # imageFileOf : image d'un glisser-déposer ou du presse-papiers
src/ui/styles/components/background-page.css
src/test/recording-context.ts           # Faux contexte Canvas 2D qui note les appels (tests de dessin)
server/image-proxy/                     # Cloudflare Worker : /search (Pexels), /image (CORS) ; wrangler.toml, README.md
.env.example                            # VITE_IMAGE_PROXY_URL
docs/adr/0005-arriere-plan-compose-et-assets.md
```
`render/renderer.ts` gagne une texture d'arrière-plan (`DrawOptions.backdrop`, renvoyée seulement quand sa `version` change) ; `render/canvas2d.ts` gagne `paintWorldImage` ; `thumbnail.ts` et l'export dessinent l'arrière-plan composé ; `CanvasArea` accepte le dépôt et le collage d'une image.
`storage/library.ts` gagne l'index des projets (second magasin, `stickflow-index`), `rename`, `duplicate`, `setThumbnail` ; `render/camera.ts` gagne `fitWorldHeight`, `stageWorldHeight`, `frameScreenRect` ; `render/thumbnail.ts` gagne `projectThumbnail` / `paintProjectFrame` ; `export/exporter.ts` expose `exportProject` (utilisé par l'éditeur et l'accueil). Noms de fichiers en kebab-case, comme le reste du projet (le prompt v2.0 proposait `HomeView.ts`…).

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
- **Routeur et vues (v2.0, ADR 0004)** : `main.ts` ouvre la bibliothèque, l'index, les vidéos et les préférences, applique le thème, puis le routeur (hash) affiche la vue de la route via `view-host.ts`. Chaque vue crée **son propre bus et son propre store** au montage et libère tout à la destruction (écouteurs, boucle de rendu, contexte WebGL rendu par `WEBGL_lose_context`). L'accueil garde sa vue d'une section à l'autre (`update`, qui relit les listes) ; l'éditeur ne garde que son projet (« Enregistrer sous » / « Ouvrir » remplacent l'adresse sans recharger). Quitter l'éditeur (bouton retour ou retour du navigateur) attend `leave()` : sauvegarde si le Projet a changé (`saveIfModified`), avec une vignette neuve. Une route dépassée par une plus récente pendant une sortie est ignorée. Un projet introuvable ramène à l'accueil.
- **Format et cadre (v2.0)** : le cadre de la vidéo mesure toujours `FRAME_WORLD_HEIGHT` (400 unités) de haut dans le monde ; sa largeur suit le rapport du format. L'éditeur montre le cadre centré avec 5 % de marge (`stageWorldHeight`), partagé par le rendu, la manipulation, le dessin et le cadre assombri de `CanvasArea` (`frameScreenRect`, ombre portée `--color-letterbox`). L'export et les vignettes montrent exactement le cadre (`fitWorldHeight` sans marge). Une taille libre est ramenée à un nombre pair de pixels (encodeurs vidéo). Changer de format est annulable ; la section « Format de la vidéo » avertit si des personnages visibles ou des formes sortent du cadre (`outOfFrame`).
- **Accueil (v2.0)** : `core/home-intents.ts` est l'aiguillage de l'accueil (sans DOM ; bibliothèque, préférences, modèles, vignettes, export et vidéos injectés). Créer un projet = format, IPS (celui du modèle s'il n'est pas choisi) et nom libre (« Projet sans titre 2 »), enregistrement avec sa vignette, puis ouverture dans l'éditeur. Les cartes sont gardées par id ; un résumé changé reconstruit sa carte ; une vignette manquante est générée quand la carte devient visible (`IntersectionObserver`). L'aperçu au survol (souris seulement, après 250 ms, pas en mouvement réduit) charge le projet et le joue à son IPS dans un canvas ; un seul à la fois. La recherche filtre projets et modèles (sans casse ni accents) et n'est pas mémorisée ; tri, vue, thème, format et IPS par défaut le sont (`localStorage`, `normalizePreferences`). Supprimer demande confirmation.
- **Création de projet (v2.0.1)** : un rôle par point d'entrée, plus aucun formulaire dans la barre latérale.
  - **Raccourcis de la bannière** (moyen principal) : un clic crée le projet au format choisi, avec le nom libre suivant et les IPS par défaut des Réglages, puis ouvre l'éditeur (`project:create`).
  - **« Libre » (+)**, dernier raccourci, et **bouton flottant « + »** ouvrent la même **feuille de création complète** (`home:sheet` `{ kind: 'create', templateId: null }`) : nom, format (`FormatPicker` en liste, avec aperçu des proportions et largeur × hauteur pour « Personnalisé »), IPS (prérempli avec les Réglages), modèle de départ facultatif, « Créer ».
  - **Modèles** (carrousel) : ouvrent la feuille avec le modèle choisi. **État vide** : « Créer mon premier projet » ouvre la feuille.
  - **Bouton flottant** : sur ordinateur, caché tant que la bannière est à l'écran (`IntersectionObserver` de la bannière → `home:hero:visibility` → `heroVisible`, sélecteur `floatingButtonTucked`), puis affiché en fondu (sans transition en mouvement réduit) ; toujours visible sous 900 px et dans les sections sans bannière.
  - **IPS par défaut** : réglés dans les Réglages, modifiables dans la feuille de création et dans l'éditeur.
- **Noms des formats (v2.0.1)** : `core/formats.ts` est la seule liste des préréglages (`FORMAT_PRESETS`) ; leurs libellés sont une seule table dans `strings.formats` (`names`, `subtitles`), lue par `ui/format.ts` (`formatName`, `formatSubtitle`, `formatBadge` : « Vertical · 9:16 »). Bannière, feuille de création, Réglages, section « Format de la vidéo » de l'éditeur et badges des cartes utilisent les mêmes noms. Seul le raccourci « Libre » garde son propre libellé : il ouvre la feuille, où l'on choisit « Personnalisé ».

  | Préréglage | Nom | Sous-titre | Rapport | Résolution |
  |---|---|---|---|---|
  | `youtube` | YouTube | Vidéo horizontale | 16:9 | 1920 × 1080 |
  | `vertical` | Vertical | Shorts · TikTok · Reels | 9:16 | 1080 × 1920 |
  | `square` | Carré | Publication Instagram | 1:1 | 1080 × 1080 |
  | `portrait` | Portrait | Publication Instagram | 4:5 | 1080 × 1350 |
  | `custom` | Personnalisé | Largeur et hauteur au choix | libre | saisie (256 à 3840 px, paire) |

  Les identifiants de préréglage n'ont pas changé depuis la v2.0 : les projets enregistrés gardent leur format sans migration (un identifiant inconnu devient une taille libre, `normalizeFormat`).
- **Index et vignettes (v2.0)** : la bibliothèque écrit le projet (`project:<id>`, avec `createdAt` / `updatedAt`) **et** son résumé dans l'index ; l'accueil ne lit que l'index (50 projets : ~10 ms). Les projets de la v1.0 sont indexés à la première lecture, sans vignette. Vignette : première frame, 320 px de côté long, PNG, aux couleurs de l'export (`EXPORT_COLORS`), régénérée à chaque sauvegarde.
- **Vidéos conservées (v2.0)** : un export GIF, MP4 ou WebM (pas la séquence PNG), depuis l'éditeur ou une carte, est téléchargé **et** gardé en Blob (`stickflow-videos`). « Mes vidéos » montre l'espace utilisé (`navigator.storage.estimate()`) ; au-delà de 80 %, il propose de supprimer les plus anciennes jusqu'à revenir à 70 %. Lecteur : `<video>` (ou `<img>` pour un GIF) par URL d'objet, libérée à la fermeture ; Partager n'apparaît que si `navigator.canShare` accepte un fichier.
- **Arrière-plan (v2.1, ADR 0005)** : `environment.background` vaut `null` (celui du thème, blanc à l'export) ou un `Background` : couleur, dégradé, intégré, image. Changements nommés `setBackground` / `updateBackground` (réglages de l'arrière-plan actuel, sans changer son type ni son image) ; un même jeton `gesture` (glisser de slider, de la roue, de l'aperçu) forme une seule étape d'annulation. Le module Projet borne tout (`normalizeBackground` : angle 0 à 359°, zoom 1 à 3, flou 0 à 20, luminosité 0,5 à 1,5, opacité et voile 0 à 1).
- **Composition de l'arrière-plan** : `paintBackground` (Canvas 2D) dessine l'arrière-plan dans le cadre du format ; `BackgroundSurface` le recompose seulement quand l'arrière-plan ou le format change (long côté 2048 px dans l'éditeur), et la scène le dessine comme un rectangle texturé sous toutes les couches, dans le cadre (hors du cadre : la couleur du thème). Vignettes et aperçus dessinent le même canvas ; l'export le recompose une fois à sa résolution. Flou et luminosité en `ctx.filter`, en pixels du format ; un bord flouté est agrandi pour ne pas s'estomper. Sous une image transparente : le blanc de l'export.
- **Images d'arrière-plan** : jamais dans le JSON du Projet. `asset-importer` vérifie le fichier par son contenu (`checkImageFile` : PNG, JPEG, WebP, GIF ; SVG et plus de 20 Mo refusés), le traite dans un Worker (`createImageBitmap`, long côté ≤ 2 × celui du format et ≤ 3840 px, WebP sinon JPEG, vignette de 160 px), le garde dans le magasin d'assets, puis émet `background:set`. Erreurs : `session.assetImport` (lues par `aria-live`). Supprimer un projet supprime les images qu'aucun autre projet n'utilise (`ProjectSummary.assetIds`) ; une copie partage l'image.
- **Proxy d'images** : l'app ne connaît que `VITE_IMAGE_PROXY_URL` (`.env.local`), jamais de clé. `GET /search` (Pexels, 24 par page, `hasMore`) et `GET /image?url=` (PNG, JPEG, WebP, GIF ≤ 20 Mo, CORS ; SVG, adresses privées et origines non autorisées refusés). Codes : 503 non configuré, 429 limite atteinte, 415 type refusé, 413 trop lourd. Crédit « Photo : Nom — Pexels » sur chaque résultat et sous l'arrière-plan, lien « Photos fournies par Pexels ». Pas de recherche générale (droits inconnus).
- **Thème (v2.0)** : Automatique (système), Clair ou Sombre imposé par `data-theme` sur `<html>`. Les couleurs sombres sont déclarées deux fois dans `tokens.css` (automatique et imposé), gardées identiques par `tokens.test.ts`.
- **Rendu** : `EditorView` passe le canvas `#stage` et le calque de dessin à `connectStageView`. Le rendu lit la taille au moment de dessiner (`canvas.width`/`height`), redessine tout de suite sur `canvas:resize` (évite un clignotement) et à la demande sinon. Les couleurs lues par WebGL viennent des tokens CSS et doivent rester en **hexadécimal** (ex. `--color-stickman`).
- **Manipulation** : `CanvasArea` émet le pointeur brut (`stage:pointer:*`, en pixels CSS avec la taille du canvas, plus `pointerType`, `shiftKey`, `pressure`) et les touches (`node:cycle`, `node:nudge`, `node:select`) ; `interaction/character-manipulation.ts` fait la sélection et le glisser, et émet `frame:pose:change` (frame désignée par son **id**). Zone de saisie d'une poignée : 22 px CSS de rayon (cible de 44 px). Pas de manipulation pendant la lecture ; les poignées ne s'affichent qu'en mode Personnage.
- **Règles de manipulation** : glisser un nœud le fait tourner autour du bout de son parent (ses descendants suivent) ; glisser la racine déplace toute la figure ; modifier une frame générée (glisser, coller, « + ») la convertit en nouvelle image clé entre ses voisines, qui devient la frame active. Clavier sur le canvas : ↑ / ↓ choisir un nœud, ← / → tourner de 5° (Maj : 1°), Échap désélectionner.
- **Lecture** : parcourt la séquence au rythme IPS × vitesse, autant de fois que la Répétition l'indique (coupée : une fois puis arrêt sur la dernière frame ; « Infini » : en boucle ; sinon N passages). Lancée depuis la dernière frame, elle repart du début ; un saut de plus de 250 ms (onglet masqué) est plafonné. Pause garde la frame courante ; **Stop** revient à la frame active au lancement. Espace bascule lecture / pause (y compris sur les boutons de lecture, pas sur les autres boutons ni dans un champ). La lecture ne touche jamais au Projet (`playback:frame` met à jour la Session).
- **Frames** : « + » insère une copie de la frame active juste après elle (c'est aussi « dupliquer ») ; Supprimer (bouton ou Suppr sur une vignette) retire l'image clé active, jamais la dernière, et ne s'applique pas à une frame générée ; Copier / Coller la pose passe par la Session, et coller est annulable. Vignettes : conservées par id de frame, seule celle qui change est repeinte. Une vignette montre la frame **comme la scène** (rendu final de `buildSceneLayers` : couleurs des parties, zones de couleur, taille, formes, calque de dessin, arrière-plan), avec des membres plus épais (`THUMBNAIL_STYLE`) ; les frames générées se distinguent par leur cadre (plus petites, teintées, bord pointillé, badge), plus par la couleur du personnage. Toutes les vignettes sont repeintes quand les personnages ou le décor changent (calque : 150 ms après le dernier tampon).
- **Pelure d'oignon** : frame précédente en transparence sous la frame active, réglable dans la section Animation, masquée pendant la lecture.
- **Sauvegarde** : le fichier (`stickflow-project`, **version 4** depuis la v2.1 ; un arrière-plan de version 3, une couleur HEX, devient `{ type: 'color', color }`) contient nom, IPS, format de la vidéo, personnages, images clés, environnement, couleurs récentes et réglages IA ; un fichier ancien passe d'abord par `migrateProject` (version 1 → un seul personnage « Personnage 1 » ; version 2 → format YouTube 16:9). À la lecture, la structure est vérifiée (`ProjectFileError`, version plus récente refusée), puis `createHistory` applique les bornes. La bibliothèque passe par le port `KeyValueStore` (deux adaptateurs : IndexedDB, mémoire). La Session retient `documentId` et `savedProject` ; `saveStatus` vaut « jamais enregistré », « enregistré » ou « modifié » (comparaison par référence du Projet). Ouvrir remplace le Projet et repart d'un historique vierge. « Enregistrer sous » renomme en « <nom> (copie) » et enregistre sous un nouvel id. Le nom du projet se modifie dans l'en-tête (changement nommé `rename`, annulable, frappes regroupées). Raccourcis : Ctrl/⌘+S enregistrer, Ctrl/⌘+O ouvrir. Les erreurs et confirmations passent par `session.notice`, affichée sous le bouton Exporter.
- **Export** : à la résolution du format de la vidéo (v2.0 ; 1280 × 720 avant), mêmes couleurs quel que soit le thème (arrière-plan composé à la résolution de l'export, blanc par défaut, stickman foncé ; PNG sur fond transparent sans arrière-plan). Il dessine le décor (calque de dessin, formes) et tous les personnages visibles, sans aide d'édition. Répétition coupée : une lecture ; infinie : GIF en boucle, vidéo et PNG d'un passage ; N répétitions : compteur de boucle du GIF, N passages dans la vidéo, un passage en PNG. La vidéo est enregistrée en temps réel (une image par frame, au rythme de l'IPS) ; une vidéo vide est signalée comme un échec. `session.exportProgress` (0 à 1) désactive le bouton et affiche l'avancement.
- **Modes d'édition (v1.0)** : `session.editorMode` vaut `'characters'` ou `'environment'` ; seul le contexte actif réagit au pointeur, l'autre est atténué (`DIMMED_OPACITY`). Changer de mode vide la sélection de l'autre contexte. Raccourcis : C Personnages, E Environnement, Tab bascule (seulement quand aucun élément n'a le focus, pour garder la navigation au clavier).
- **Sélection (v1.0)** : test de toucher poignée du personnage sélectionné > partie (distance point-segment, du personnage le plus au-dessus) > cadre du personnage ; tolérance plus large au toucher (poignée 22 px, partie 14 px) qu'à la souris (12 / 6 px). Maj + clic ajoute ou retire une partie. Un personnage masqué ou verrouillé n'est jamais sélectionnable. Clic dans le vide : tout désélectionner. Suppr supprime (confirmation pour un personnage), Ctrl/⌘+D duplique, Échap ferme le panneau. La liste de l'onglet Personnages et la scène partagent `session.selectedCharacterId`.
- **Formes (v1.0)** : outil `select` (ajouté à la grille) pour choisir, déplacer, redimensionner (4 coins, ou les 2 bouts d'une ligne) et pivoter (poignée au-dessus, pas de 15° avec Maj) ; un outil de forme trace par glisser (Maj : proportions contraintes) au-delà de 3 px. Un geste sur la scène = une étape d'annulation (jeton `gesture` sur `shape:create` / `shape:update`). Remplir sur une forme lui donne la couleur de remplissage, ailleurs émet `drawing:fill`.
- **Calque de dessin (v1.0, ADR 0003)** : 2048 × 768 pixels de taille fixe dans le monde, en tuiles de 256 ; le trait est peint en direct sur `drawing/surface.ts`, et seules les tuiles touchées sont encodées en PNG au relâchement (`drawing:stroke` → `paintDrawing`, une étape d'annulation). L'opacité s'applique au trait entier ; l'Aérographe s'accumule ; la Gomme efface (tuile vide retirée). Tracé lissé par moyenne mobile, tampons ronds espacés.
- **Ordre de rendu (v1.0)** : arrière-plan (couleur, dégradé, intégré ou image : une seule texture composée, v2.1) → calque de dessin → formes → pelure d'oignon → surlignage des parties → personnages → cadre de sélection → poignées. La pelure d'oignon est sous les personnages (pour ne pas les cacher). Lecture et export n'ont aucune aide d'édition (mode `null` de `buildSceneLayers`).
- **Couleurs (v1.0)** : `ColorPicker` est dans `ui/controls/` (primitive réutilisée par les deux onglets, qui ne s'importent pas entre eux). Il n'émet pas de `color:change` générique : il rappelle `onChange` / `onCommit`, et chaque onglet émet son intention (`appearance:color`, `tool:settings`) ; `color:commit` ajoute la couleur aux couleurs récentes, qui sont dans le Projet mais **hors historique** (appliquées à tous les instantanés). Pipette : API `EyeDropper` si elle existe, sinon `eyedropper:start` et lecture d'un pixel du canvas WebGL au prochain appui.
- **Coloration partielle** : une zone de couleur est une capsule de plus, dessinée juste après sa partie et **découpée** le long de l'axe de la partie (pour la tête : du cou au sommet) ; la découpe est nette et perpendiculaire à l'axe, et une zone qui touche un bout garde son arrondi. Le shader des capsules reçoit pour cela l'axe et la tranche (15 flottants par capsule) ; le Canvas 2D (export, vignettes) découpe par un rectangle. La pelure d'oignon ignore les zones. La fenêtre agit sur les parties choisies (`session.selectedParts`, partagées avec la scène et les pastilles de l'inspecteur) et, avec la symétrie, sur leurs jumelles (`mirrorPart`). Elle est à droite de la scène au-delà de 1100 px de large ; en dessous, elle prend la place du panneau flottant (`STACKED_MEDIA_QUERY`), et devient une feuille du bas sur téléphone. Échap la ferme avant le panneau. Recolorer tout le personnage garde ses zones (les vêtements restent). Les vignettes de la liste des personnages montrent leurs vraies couleurs et leurs zones.
- **Lecture / Pause (v1.0)** : un seul bouton (`playback:toggle`, `aria-label` « Lire » / « Mettre en pause », `aria-pressed`) ; `playback:play` et `playback:pause` restent pour le clavier et les autres modules. Stop garde son comportement (retour à la frame active au lancement).
- Le panneau gauche devient un tiroir sous **900 px** de large (`DRAWER_MEDIA_QUERY` dans `ui/dom.ts`, dupliqué dans les CSS car les variables CSS sont interdites dans les media queries). Le panneau flottant devient une feuille du bas sous **600 px** (`SHEET_MEDIA_QUERY`).

### 5.2 bis Événements du bus (`AppEvents` dans `core/events.ts`)
| Événement | Payload |
|---|---|
| `history:undo`, `history:redo` | — |
| `playback:play`, `playback:pause`, `playback:toggle` | — (`toggle` : bouton unique, v1.0) |
| `playback:speed:change` | `{ speed: 1 \| 2 \| 5 \| 10 }` |
| `frame:select` | `{ index }` |
| `frame:add` | — |
| `project:save` | — |
| `route:change` | `{ route }` (v2.0 : accueil, section, éditeur ; quitter l'éditeur l'enregistre d'abord) |
| `project:create` | `{ name?, format?, fps?, templateId? }` (accueil ; valeurs par défaut des préférences) |
| `project:format:change` | `{ format }` (format de la vidéo du projet, annulable) |
| `library:rename`, `library:duplicate` | `{ projectId, name }` (projet enregistré, depuis sa carte) |
| `library:delete` | `{ projectId }` |
| `library:export` | `{ projectId, format }` |
| `home:search` | `{ query }` |
| `home:sort` / `home:view` | `{ sort: 'modified' \| 'created' \| 'az' \| 'za' }` / `{ view: 'grid' \| 'list' }` |
| `home:sheet` | `{ sheet }` : `{ kind: 'create', templateId }`, `{ kind: 'export', projectId }`, `{ kind: 'settings' }`, `{ kind: 'video', videoId }` ou `null` |
| `home:hero:visibility` | `{ visible }` (v2.0.1 : la bannière entre à l'écran ou en sort ; bouton flottant « + ») |
| `settings:change` | `Partial<Preferences>` (thème, format et IPS par défaut, tri, vue) |
| `video:delete` | `{ videoId }` |
| `videos:prune`, `videos:clear` | — (supprimer les plus anciennes / toutes) |
| `editMode:change` | `{ mode: 'characters' \| 'environment' }` (remplace `editor:mode:change`, v1.0) |
| `panel:toggle` | `{ open }` (panneau flottant) |
| `ai:smoothing:change` | `Partial<SmoothingSettings>` |
| `ai:loop:change` | `Partial<LoopSettings>` |
| `animation:fps:change` | `{ fps }` |
| `export:format:change` | `{ format: 'gif' \| 'png' \| 'mp4' }` |
| `export:request` | `{ format }` |
| `ui:drawer:toggle` | `{ open }` |
| `canvas:resize` | `{ width, height, pixelRatio }` (pixels physiques du canvas) |
| `stage:pointer:down` / `move` / `up` | `{ pointerId, x, y, width, height, pointerType?, shiftKey?, pressure? }` (pixels CSS) |
| `node:select` | `{ nodeId: string \| null }` |
| `node:cycle` | `{ direction: 1 \| -1 }` |
| `node:nudge` | `{ radians }` |
| `frame:pose:change` | `{ frameId, characterId, pose, rootPosition }` |
| `frame:delete`, `frame:copy`, `frame:paste` | — (agissent sur la frame active) |
| `playback:stop` | — |
| `playback:frame` | `{ index }` (émis par le lecteur) |
| `animation:onion-skin:change` | `{ enabled }` |
| `project:rename` | `{ name }` |
| `project:save-as` | `{ name }` |
| `project:open` | `{ projectId }` |
| `project:library:request`, `project:library:close` | — (dialogue « Ouvrir ») |
| `character:add` | `{ name }` |
| `character:duplicate` | `{ characterId, name }` |
| `character:remove` | `{ characterId }` |
| `character:select` | `{ characterId \| null }` |
| `character:rename` | `{ characterId, name }` |
| `character:reorder` | `{ characterId, direction: 1 \| -1 }` |
| `character:visibility` | `{ characterId, visible }` |
| `character:lock` | `{ characterId, locked }` |
| `segment:select` | `{ characterId, nodeId \| null, additive }` |
| `appearance:color` | `{ characterId, parts, color \| null }` (aucune partie = tout le personnage ; `null` = automatique) |
| `appearance:scale` | `{ characterId, scale }` |
| `appearance:bands` | `{ characterId, bands: Record<nodeId, ColorBand[]> }` (remplace les zones des parties données ; liste vide = aucune) |
| `partialPaint:change` | `Partial<{ open, symmetric, color }>` (fenêtre « Coloration partielle », Session) |
| `color:commit` | `{ color }` (couleurs récentes) |
| `eyedropper:start`, `eyedropper:cancel` | — |
| `eyedropper:pick` | `{ color }` |
| `tool:select` | `{ tool }` (`select`, une forme, `fill` ou un outil de dessin) |
| `tool:settings` | `Partial<ToolSettings>` (couleur, épaisseur, opacité, rempli) |
| `shape:create` | `{ shape, gesture? }` |
| `shape:update` | `{ shapeId, changes, gesture? }` |
| `shape:remove`, `shape:duplicate` | `{ shapeId }` |
| `shape:select` | `{ shapeId \| null }` |
| `drawing:stroke` | `{ tiles }` (tuiles repeintes, PNG en data URL, `null` = vide) |
| `drawing:fill` | `{ point }` (point du monde) |
| `background:open` | `{ open, tab? }` (sous-page « Arrière-plan », onglet `color` \| `builtin` \| `device` \| `internet`, Session, v2.1) |
| `background:set` | `{ background, gesture? }` (remplace l'arrière-plan, annulable) |
| `background:update` | `{ changes, gesture? }` (angle, ajustement, point focal, zoom, effets, voile) |
| `background:remove` | — (retour à l'arrière-plan du thème) |
| `asset:import` | `{ file, source: 'device' \| 'stock' \| 'url', credit? }` (vérifier, traiter, garder, appliquer) |
| `asset:apply` | `{ assetId }` (image récente) |
| `asset:error` | `{ code }` (import ou recherche impossible) |
| `stock:search` | `{ query, page }` (page > 1 : défilement infini) |
| `stock:import` | `{ photoId }` (photo des résultats, avec son crédit) |
| `url:import` | `{ url }` (image d'une adresse, par le proxy) |

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

// Modèle v2 (version 1.0)
interface FramePose {
  pose: Record<string, number>;   // angle de chaque nœud (absent = angle de repos)
  rootPosition: { x: number; y: number };
}

interface Character {
  id: string;
  name: string;
  visible: boolean;               // masqué : ni affiché ni exporté
  locked: boolean;                // verrouillé : affiché, non sélectionnable
  skeleton: SkeletonNode[];
  appearance: {
    scale: number;                        // 0.5 à 2 (longueurs et épaisseurs)
    defaultColor: string | null;          // null = couleur du thème
    segmentColors: Record<string, string>; // id du nœud enfant → couleur HEX
    segmentBands: Record<string, ColorBand[]>; // zones de couleur par partie (absent des anciens fichiers v2 = {})
  };
}

interface ColorBand {               // zone de couleur : tranche de la partie, 0 = articulation du parent, 1 = bout
  from: number;
  to: number;
  color: string;
}

interface Keyframe {               // image clé : la seule frame enregistrée (ADR 0002)
  id: string;
  poses: Record<string, FramePose>; // id du personnage → pose (une par personnage, ni plus ni moins)
}

interface Shape {
  id: string;
  kind: 'square' | 'circle' | 'rectangle' | 'triangle' | 'line';
  x: number; y: number; width: number; height: number; rotation: number; // centre, monde
  stroke: string; fill: string | null; strokeWidth: number; opacity: number;
}

interface Environment {            // statique en v1.0 (même décor dans toutes les frames)
  background: Background | null;   // v2.1 ; null = fond du thème (blanc à l'export)
  shapes: Shape[];                 // ordre = ordre d'affichage
  drawing: { tiles: Record<string, string> }; // « colonne,ligne » → PNG en data URL (ADR 0003)
}

// v2.1 : fichier version 4 (un arrière-plan v3 était une couleur HEX)
type Background =
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }   // degrés, convention CSS
  | { type: 'builtin'; id: 'day-sky' | 'sunset' | 'starry-night' | 'horizon' | 'studio-grid' | 'room' }
  | {
      type: 'image';
      assetId: string;                                  // magasin d'assets, jamais de data URL
      fit: 'cover' | 'contain' | 'stretch' | 'tile';
      focus: { x: number; y: number };                  // 0 à 1
      zoom: number;                                     // 1 à 3
      blur: number;                                     // 0 à 20 px (pixels du format)
      brightness: number;                               // 0,5 à 1,5
      opacity: number;                                  // 0 à 1, sur le blanc de l'export
      tint: { color: string; amount: number } | null;
      credit?: { author: string; url: string; provider: string };
    };

interface VideoFormat {             // v2.0
  preset: 'youtube' | 'vertical' | 'square' | 'portrait' | 'custom';
  width: number;                    // résolution de l'export, en pixels
  height: number;
}

interface Project {
  name: string;
  fps: number;                    // 1 à 60
  format: VideoFormat;            // v2.0 (absent d'un fichier v2 = YouTube 16:9)
  characters: Character[];        // au moins un ; ordre = ordre d'affichage
  keyframes: Keyframe[];
  environment: Environment;
  recentColors: string[];         // 8 au plus, hors historique
  ai: {
    smoothing: { enabled: boolean; intensity: number; curve: 'linear' | 'smooth' | 'ease-in-out' };
    loop: { enabled: boolean; repeatCount: number; infinite: boolean; transitionFrames: number };
  };
}
```

Hors du Projet (v2.0, ADR 0004) : le **résumé** d'un projet enregistré, dans l'index des projets, et les vidéos conservées.
```ts
interface ProjectSummary {
  id: string; name: string; format: VideoFormat; fps: number;
  frameCount: number;             // images de la séquence (images clés et frames générées)
  createdAt: number; updatedAt: number;   // ms depuis l'époque Unix
  thumbnail: string | null;       // première frame, PNG en data URL
  assetIds: string[];             // v2.1 : images d'arrière-plan utilisées (suppression du dernier projet)
}

interface AssetSummary {          // v2.1, + blob: Blob dans le magasin d'assets (« stickflow-assets »)
  id: string; width: number; height: number; mimeType: string;
  source: 'device' | 'stock' | 'url'; credit?: ImageCredit;
  thumbnail: string | null;       // 160 px, JPEG en data URL (images récentes)
  createdAt: number; usedAt: number;
}

interface VideoSummary {          // + blob: Blob dans le magasin des vidéos
  id: string; projectId: string | null; projectName: string;
  type: 'mp4' | 'webm' | 'gif'; duration: number; size: number; createdAt: number; thumbnail: string | null;
}
```

Écarts assumés par rapport au prompt v2.1 (ADR 0005) : le magasin s'appelle `asset-store.ts` (kebab-case) ; l'arrière-plan peut aussi valoir `null` (celui du thème) ; les effets sont précalculés en Canvas 2D dans une texture (pas dans un shader) ; sous une image transparente on voit le blanc de l'export.

Écarts assumés par rapport au prompt v2.0 : `createdAt`, `updatedAt` et `thumbnail` sont dans le résumé du projet, pas dans le Projet (annuler ne doit pas toucher aux dates, et `saveStatus` compare le Projet par référence) ; le fichier de projet reste sans dates.

Écarts assumés par rapport au prompt v1.0 : les **images clés restent la seule frame enregistrée** (pas de `Frame.generated` dans le Projet, ADR 0002) ; la version est portée par le fichier (`stickflow-project` v2), pas par le `Project` ; le calque de dessin est en tuiles plutôt qu'un PNG unique (ADR 0003). Un environnement animable plus tard pourra devenir `Record<keyframeId, …>` ou des pistes, sans toucher aux personnages.

**Séquence dérivée** (revue d'architecture, candidat 2, **réalisé** — ADR 0002) : `model/sequence.ts` calcule `deriveSequence(project)` = images clés + frames générées (`SequenceFrame`, `kind: 'keyframe' | 'generated'`, avec `from`, `to`, `step`). Pur et mémoïsé : même tableau tant que images clés, squelette et Fluidité sont inchangés, et mêmes objets pour les segments intacts (vignettes non repeintes). Interpolation par `model/interpolation.ts` (`interpolatePose`, un personnage à la fois) selon la courbe (voir 2.2). Depuis la v1.0, une `SequenceFrame` porte `poses` (une par personnage) et le cache dépend du « rig » (ids et squelettes des personnages) : changer une couleur, une taille ou le décor ne recalcule pas la séquence. Avec la Répétition (et au moins 2 images clés), la séquence est une **boucle** : `transitionFrames` frames générées suivent la dernière image clé pour revenir à la première, et la spline prend ses voisines en boucle ; la transition suit la courbe de la Fluidité, ou la courbe Douce si la Fluidité est coupée. Les segments sont mis en cache par image clé de départ ; en Linéaire, seules les deux images clés du segment comptent, sinon aussi leurs voisines. La Session désigne la frame active par son **id** (`activeFrameId`) ; `core/selectors.ts` fournit `sequenceOf(state)` et `activeFrame(state)` (frame + position). Les événements gardent des **positions** dans la séquence (`frame:select`, `playback:frame`) ; `intents.ts` les traduit en id.

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
- Changements nommés : `setFps`, `updateSmoothing`, `updateLoop`, `insertKeyframe` (après une image clé, avec des poses données ou une copie de la précédente), `deleteKeyframe`, `poseKeyframe`. Depuis la v1.0 : `addCharacter` (pose de base dans toutes les images clés, placé décalé), `duplicateCharacter`, `removeCharacter` (jamais le dernier), `renameCharacter`, `moveCharacter`, `setCharacterVisibility`, `setCharacterLock`, `setCharacterColor`, `setCharacterScale`, `setPartBands` (zones de couleur de plusieurs parties à la fois ; regroupées par parties, pour qu'un glisser de slider soit une étape), `addShape`, `updateShape`, `removeShape`, `paintDrawing` ; et, hors historique, `recordRecentColor`. Regroupés en une étape s'ils sont du même réglage et à moins de 1 s d'intervalle ; une image clé insérée **avec** une pose se regroupe avec les poses qui la suivent (conversion d'une frame générée par glisser = une étape). Les bascules (activé, courbe, infini), les copies et les suppressions ne sont jamais regroupées.
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
   - **Version 1.0** (amélioration intermédiaire, voir 2.4) : plusieurs personnages, apparence (couleurs par partie, taille), grande palette, environnement (formes, calque de dessin), panneau « Personnages & Environnement », sélection optimisée, bouton Lecture / Pause unique, modèle v2 + migration, export du décor. ✅
   - **Version 2.0** (voir 2.5) : routeur et vues (accueil / éditeur), formats de vidéo et cadre, modèle v3 + migration, index des projets et vignettes, page d'accueil (barre latérale, bannière, modèles, projets, vidéos, création), vidéos conservées et lecteur, réglages et thème, barre d'onglets mobile. ✅
   - **Version 2.0.1** : création de projet simplifiée (barre latérale sans « Nouveau projet », « Libre » et « + » ouvrent la feuille complète, bouton flottant caché sous la bannière sur ordinateur), noms des formats harmonisés. ✅
   - **Version 2.1** (voir 2.6) : arrière-plan personnalisé — couleur, dégradé, intégrés, image de l'appareil (fichier, glisser-déposer, collage) ou d'Internet (Pexels, adresse) ; réglages d'image ; magasin d'assets ; modèle v4 + migration ; proxy Cloudflare Worker. ✅
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
