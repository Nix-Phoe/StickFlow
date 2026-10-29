// Textes de l'interface, centralisés pour une traduction future.

import type { ColorHarmony, EditorMode, ExportFormat, NoticeCode, SmoothingCurve, ToolId } from '../core/types';

const plural = (n: number, singular: string, pluralForm: string): string =>
  `${n} ${n > 1 ? pluralForm : singular}`;

export const strings = {
  appName: 'StickFlow',
  defaultProjectName: 'Projet sans titre',

  modes: {
    characters: 'Personnages',
    environment: 'Environnement',
  } satisfies Record<EditorMode, string>,

  characters: {
    defaultName: (n: number): string => `Personnage ${n}`,
    copyName: (name: string): string => `${name} (copie)`,
    list: 'Personnages de la scène',
    add: 'Ajouter un personnage',
    name: (name: string): string => `Nom de ${name}`,
    select: (name: string): string => `Sélectionner ${name}`,
    show: (name: string): string => `Afficher ${name}`,
    hide: (name: string): string => `Masquer ${name}`,
    lock: (name: string): string => `Verrouiller ${name}`,
    unlock: (name: string): string => `Déverrouiller ${name}`,
    actions: 'Actions sur le personnage sélectionné',
    duplicate: 'Dupliquer',
    moveUp: 'Monter (au premier plan)',
    moveDown: 'Descendre (à l’arrière-plan)',
    remove: 'Supprimer',
    confirmRemove: (name: string): string => `Supprimer « ${name} » de toute l’animation ?`,
    noSelection: 'Sélectionnez un personnage dans la liste ou sur la scène.',
  },

  /** Noms des parties du stickman par défaut (id du nœud qui termine le segment). */
  parts: {
    torso: 'Torse',
    head: 'Tête',
    upperArmL: 'Bras gauche',
    forearmL: 'Avant-bras gauche',
    upperArmR: 'Bras droit',
    forearmR: 'Avant-bras droit',
    thighL: 'Cuisse gauche',
    shinL: 'Jambe gauche',
    thighR: 'Cuisse droite',
    shinR: 'Jambe droite',
  } as Readonly<Record<string, string>>,

  appearance: {
    title: 'Apparence',
    whole: 'Personnage entier',
    part: (nodeId: string): string => strings.parts[nodeId] ?? nodeId,
    parts: (n: number): string => `${n} parties`,
    color: 'Couleur',
    swatches: 'Couleurs prédéfinies',
    swatch: (hex: string): string => `Couleur ${hex}`,
    automatic: 'Automatique (couleur du thème)',
    hex: 'Code HEX',
    openPalette: 'Grande palette',
    applyToAll: 'Appliquer à tout le personnage',
    size: 'Taille',
    sizePercent: (percent: number): string => `${percent} %`,
    originalSize: (width: number, height: number): string => `Taille d’origine · ${width} × ${height} px`,
  },

  colorPicker: {
    wheel: 'Roue chromatique : flèches gauche / droite pour la teinte, haut / bas pour la saturation',
    brightness: 'Luminosité',
    harmony: 'Harmonie',
    harmonies: {
      none: 'Aucune',
      analogous: 'Analogue',
      complementary: 'Complém.',
      triadic: 'Triadique',
    } satisfies Record<ColorHarmony, string>,
    harmoniesLong: {
      none: 'Aucune harmonie',
      analogous: 'Couleurs analogues',
      complementary: 'Couleur complémentaire',
      triadic: 'Couleurs triadiques',
    } satisfies Record<ColorHarmony, string>,
    harmonyColor: (hex: string): string => `Choisir la couleur harmonique ${hex}`,
    white: 'Blanc',
    black: 'Noir',
    eyedropper: 'Pipette : prendre une couleur à l’écran',
    eyedropperFallback: 'Pipette : touchez la scène pour prendre une couleur',
    recent: 'Couleurs récentes',
    noRecent: 'Aucune couleur récente.',
  },

  editorPanel: {
    open: 'Ajouter ou modifier un personnage ou l’environnement',
    /** Libellé visible du bouton d'ouverture, dans la barre d'outils. */
    buttonTitle: 'Personnages & Environnement', // insécable : « Personnages & » reste sur une ligne
    buttonHint: 'Ajouter ou modifier',
    title: 'Personnages et environnement',
    close: 'Fermer le panneau',
    tabs: 'Contexte d’édition',
  },

  environment: {
    shapes: 'Formes',
    drawing: 'Outils de dessin',
    tools: {
      select: 'Sélection',
      square: 'Carré',
      circle: 'Cercle',
      rectangle: 'Rectangle',
      triangle: 'Triangle',
      line: 'Ligne',
      fill: 'Remplir',
      pen: 'Stylo fin',
      marker: 'Feutre',
      brush: 'Pinceau',
      eraser: 'Gomme',
      nib: 'Plume',
      airbrush: 'Aérographe',
    } satisfies Record<ToolId, string>,
    settings: 'Réglages de l’outil',
    shapeSettings: 'Forme sélectionnée',
    strokeWidth: 'Épaisseur',
    opacity: 'Opacité',
    style: 'Style',
    outline: 'Contour',
    filled: 'Rempli',
    deleteShape: 'Supprimer la forme',
    duplicateShape: 'Dupliquer la forme',
    selectHint: 'Touchez une forme pour la sélectionner, la déplacer ou la redimensionner.',
    units: (n: number): string => `${n} px`,
    percent: (n: number): string => `${n} %`,
  },

  regions: {
    panel: 'Réglages',
    toolbar: "Barre d'outils",
    stage: 'Zone de dessin',
    timeline: 'Timeline',
  },

  panel: {
    project: 'Projet',
    projectName: 'Nom du projet',
    save: 'Enregistrer le projet (Ctrl+S)',
    open: 'Ouvrir…',
    saveAs: 'Enregistrer sous',
    copyName: (name: string): string => `${name} (copie)`,
    saveStatus: {
      unsaved: 'Pas encore enregistré',
      saved: 'Enregistré',
      modified: 'Modifications non enregistrées',
    },
    exporting: (progress: number): string => `Export… ${Math.round(progress * 100)} %`,
    notices: {
      saved: 'Projet enregistré',
      'save-failed': 'Échec de l’enregistrement',
      opened: 'Projet ouvert',
      'open-failed': 'Impossible d’ouvrir le projet',
      exported: 'Fichier exporté',
      'export-failed': 'Échec de l’export',
    } satisfies Record<NoticeCode, string>,
    closeDrawer: 'Fermer le panneau de réglages',
    modeIndicator: (mode: EditorMode): string => `Mode : ${strings.modes[mode]}`,

    aiSection: 'Améliorations IA',
    smoothing: {
      title: 'Fluidité',
      description: 'Génère des images intermédiaires entre vos images clés.',
      toggle: 'Activer la fluidité',
      intensity: 'Intensité',
      curve: 'Courbe',
      curves: {
        linear: 'Linéaire',
        smooth: 'Douce',
        'ease-in-out': 'Accélération / décélération',
      } satisfies Record<SmoothingCurve, string>,
      /** Libellés courts affichés dans le contrôle segmenté (le libellé complet reste accessible). */
      curvesShort: {
        linear: 'Linéaire',
        smooth: 'Douce',
        'ease-in-out': 'Accél.',
      } satisfies Record<SmoothingCurve, string>,
    },
    loop: {
      title: 'Répétition',
      description: 'Enchaîne la dernière image vers la première en douceur.',
      toggle: 'Activer la répétition',
      repeat: 'Répétitions',
      infinite: 'Infini',
      infiniteToggle: 'Répéter à l’infini',
      transition: 'Transition',
    },

    animationSection: 'Animation',
    fps: 'Images par seconde (IPS)',
    onionSkin: 'Pelure d’oignon',
    onionSkinToggle: 'Afficher l’image précédente en transparence',

    effectsSection: 'Effets',
    promptSection: 'Prompt',

    exportFormat: "Format d'export",
    export: 'Exporter',
    formats: {
      gif: 'GIF',
      png: 'PNG',
      mp4: 'MP4',
    } satisfies Record<ExportFormat, string>,
  },

  toolbar: {
    openDrawer: 'Ouvrir le panneau de réglages',
    undo: 'Annuler',
    redo: 'Rétablir',
    play: 'Lire',
    pause: 'Mettre en pause',
    playbackGroup: 'Lecture',
    stop: 'Stop (revenir à l’image de départ)',
    speed: 'Vitesse de prévisualisation',
    speedValue: (speed: number): string => `x${speed}`,
    speedLabel: (speed: number): string => `Vitesse x${speed}`,
  },

  stage: {
    canvas:
      "Scène d'animation. Flèches haut et bas : choisir un nœud. " +
      'Flèches gauche et droite : le faire tourner (Maj : rotation fine). Échap : désélectionner.',
  },

  timeline: {
    title: 'Timeline',
    frames: 'Images de l’animation',
    count: (n: number): string => plural(n, 'image', 'images'),
    generatedLegend: 'Générée par l’IA',
    addFrame: 'Ajouter une image (copie de l’image active)',
    actions: 'Actions sur l’image active',
    copyPose: 'Copier la pose',
    pastePose: 'Coller la pose',
    deleteFrame: 'Supprimer l’image',
    frameLabel: (n: number, generated: boolean): string =>
      generated ? `Image ${n}, générée par l’IA` : `Image ${n}`,
  },

  projects: {
    title: 'Ouvrir un projet',
    empty: 'Aucun projet enregistré pour l’instant.',
    close: 'Fermer',
    savedAt: (date: Date): string =>
      `Enregistré le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`,
  },

  stepper: {
    decrease: (label: string): string => `Diminuer : ${label}`,
    increase: (label: string): string => `Augmenter : ${label}`,
  },

  units: {
    frames: (n: number): string => plural(n, 'image', 'images'),
  },
} as const;
