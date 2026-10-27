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
   - V1 : interpolation par splines (Catmull-Rom) + easing sur les angles des nœuds. V2 : modèle d'IA de *motion in-betweening*.
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
| Stockage | **IndexedDB** via `idb-keyval`, projets au format **JSON** |
| Export | **gif.js** (GIF), **MediaRecorder** (vidéo), `canvas.toBlob` (PNG) |
| IA (V2) | Entraînement **PyTorch** → inférence **ONNX Runtime Web** |
| Web | **PWA** (`vite-plugin-pwa`), hébergement Cloudflare Pages / Netlify |
| Android | **Capacitor** |
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
Il n’y a pas de `core/history.ts` : l’historique est interne au module Projet (`src/model/project/`), par instantanés (voir `docs/adr/0001-historique-par-instantanes.md`).

### 5.2 Règles d'architecture
- **Séparation stricte** : `core/` et `model/` ne connaissent ni le DOM ni WebGL. L'UI ne dessine pas sur le canvas : elle émet des événements.
- **Communication par bus d'événements typé** : l'UI émet des intentions (`playback:play`, `frame:add`, `ai:smoothing:change`…), les modules les écoutent. Aucun module n'importe directement un composant UI.
- **État centralisé** dans `store.ts`, l'UI se met à jour en s'abonnant aux changements.
- **Composants UI** : chaque composant expose `mount(parent)` et, si besoin, `destroy()`. Les éléments interactifs portent un attribut `data-action` pour faciliter le branchement.
- **Design tokens** : aucune couleur ou taille « en dur » dans les composants, uniquement des variables CSS de `tokens.css`.
- Toute modification du **Projet** passe par le module Projet, qui l’ajoute à l’historique (annuler / rétablir). Un changement de la Session n’est jamais annulable.
- **Flux unidirectionnel** : un composant émet un événement → `core/intents.ts` (ou un module métier) met à jour le store → le composant se redessine via `store.watch(selector, listener)`. Les contrôles sont « contrôlés » : ils n'affichent que l'état venu du store.
- La valeur d'un attribut `data-action` est **le nom de l'événement émis** (ex. `data-action="frame:add"`).
- Les composants reçoivent `{ bus, store }` par injection et ne s'importent jamais entre eux ; ils peuvent utiliser les primitives de `ui/controls/`.
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

La vitesse de prévisualisation comprend **x1** (vitesse normale) en plus de x2 / x5 / x10, pour qu'une valeur soit toujours sélectionnée.

### 5.3 Modèle de données (ébauche)
```ts
interface SkeletonNode {
  id: string;
  parentId: string | null;
  length: number;   // longueur du segment vers le parent
  angle: number;    // radians, relatif au parent
}

interface Frame {
  id: string;
  pose: Record<string, number>;   // angle de chaque nœud
  rootPosition: { x: number; y: number };
  generated: boolean;             // true = créée par l'IA
}

interface Project {
  name: string;
  fps: number;                    // 1 à 60
  skeleton: SkeletonNode[];
  frames: Frame[];
  ai: {
    smoothing: { enabled: boolean; intensity: number; curve: 'linear' | 'smooth' | 'ease-in-out' };
    loop: { enabled: boolean; repeatCount: number; infinite: boolean; transitionFrames: number };
  };
}
```

Décisions du module Projet (revue d'architecture, candidat 1, en cours d'implémentation) :
- Le **Projet** (nom, IPS, squelette, frames, réglages IA) est séparé de la **Session** (frame active, lecture, vitesse, mode, tiroir, format d'export). Voir `GLOSSARY.md`.
- Toute modification du Projet est annulable ; aucune modification de la Session ne l'est.
- Les valeurs hors limites sont ramenées dans leurs bornes, jamais rejetées.
- Un Projet contient toujours au moins une frame.
- Le nombre de répétitions est conservé même en répétition infinie (`repeatCount` + `infinite`, et non plus `repeat: number | 'infinite'`).
- Le module Projet est testé avec **Vitest**, uniquement par son interface, sans DOM.
- Le module Projet est **pur** (état d’historique + changement → nouvel état d’historique) ; le store tient tout l’état en deux parties, `project` et `session`.
- Après chaque changement du Projet (y compris annuler / rétablir), la frame active est seulement ramenée dans la liste des frames.
- L'interface décrit un changement du Projet par une **liste fermée de changements nommés** (régler l'IPS, ajouter une frame, modifier la Fluidité…), jamais par un correctif libre.
- `intents.ts` n'est plus qu'un aiguillage sans règle : changement nommé vers le Projet ou mise à jour de la Session, avec l'heure du changement (le module Projet reste pur).
- Les boutons Annuler / Rétablir sont désactivés quand il n'y a rien à annuler / rétablir.
- Seul le module Projet applique les bornes ; le stepper ne corrige plus les valeurs (il rejette seulement les saisies non numériques).
- Ordre : ce chantier est réalisé **après la phase 2**.

---

## 6. Feuille de route

1. **Phase 1 — Interface HTML/CSS** : coquille de l'app selon la maquette, composants, tokens, bus d'événements. Aucune logique d'animation.
2. **Phase 2 — Rendu WebGL 2** : contexte, shaders, affichage d'un stickman fixe.
3. **Phase 3 — Manipulation** : sélection et rotation des nœuds au toucher / à la souris.
4. **Phase 4 — Animation** : frames, timeline fonctionnelle, lecture, pelure d'oignon, annuler / rétablir.
5. **Phase 5 — Fluidité et Répétition (V1)** : splines + easing, boucle intelligente.
6. **Phase 6 — Sauvegarde et export** : IndexedDB, GIF / PNG / MP4.
7. **Phase 7 — PWA et Android** : `vite-plugin-pwa`, Capacitor, test fermé Google Play.
8. **Phase 8 — IA avancée** : modèle de *motion in-betweening*, effets prédéfinis, prompt.

---

## 7. Conventions
- Vocabulaire métier : utiliser les termes de **`GLOSSARY.md`** (Projet, Session, image clé, frame générée…). Les décisions d'architecture durables vont dans `docs/adr/`.
- Code et noms de fichiers en **anglais** ; textes de l'interface en **français** (centralisés pour une traduction future).
- TypeScript strict, pas de `any`.
- Petits fichiers à responsabilité unique.
- Commits courts et descriptifs, une fonctionnalité par commit.
