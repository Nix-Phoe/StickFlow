// Textes de l'interface, centralisés pour une traduction future.

import type { FormatPreset } from '../core/formats';
import type { ProjectSort, ProjectView } from '../core/home-state';
import type { HomeSection } from '../core/router';
import type { TemplateId } from '../templates';
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
    parts: 'Parties',
    whole: 'Tout',
  },

  /** Noms des parties du stickman par défaut (id du nœud qui termine le segment). */
  // Dans l'ordre de lecture du corps (pastilles des parties).
  parts: {
    head: 'Tête',
    torso: 'Torse',
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

  partialPaint: {
    open: 'Coloration partielle',
    openHint: 'Manches, short, chaussures, cheveux…',
    title: 'Coloration partielle',
    close: 'Fermer la coloration partielle',
    preview: (name: string): string => `Aperçu de ${name} : touchez une partie pour la choisir`,
    previewHint: 'Touchez une partie de l’aperçu (Maj : plusieurs).',
    outfits: 'Tenues rapides',
    outfit: {
      tshirt: 'T-shirt',
      sweater: 'Pull',
      shorts: 'Short',
      trousers: 'Pantalon',
      shoes: 'Chaussures',
      hair: 'Cheveux',
    } as Readonly<Record<string, string>>,
    outfitLabel: (name: string, hex: string): string => `Mettre : ${name} (${hex})`,
    color: 'Couleur',
    swatch: (hex: string): string => `Couleur ${hex}`,
    hex: 'Code HEX de la couleur',
    palette: 'Grande palette',
    parts: 'Partie',
    partsLabel: 'Parties du personnage',
    symmetric: 'Les deux côtés',
    noPart: 'Choisissez une partie sur l’aperçu ou dans la liste.',
    appliedTo: (names: string): string => `Appliqué à : ${names}`,
    strip: (name: string): string => `Couleurs de ${name}, du départ au bout`,
    start: 'Départ',
    end: 'Bout',
    headStart: 'Cou',
    headEnd: 'Sommet',
    zones: 'Zones de couleur',
    zone: (n: number): string => `Zone ${n}`,
    from: 'De',
    to: 'À',
    percent: (value: number): string => `${value} %`,
    zoneColor: (n: number): string => `Zone ${n} : modifier sa couleur avec la palette`,
    removeZone: (n: number): string => `Supprimer la zone ${n}`,
    addZone: 'Ajouter une zone',
    clear: 'Effacer les zones',
    noZone: 'Aucune zone : la partie est d’une seule couleur.',
    summary: (n: number): string => (n === 0 ? 'Aucune zone' : n === 1 ? '1 zone' : `${n} zones`),
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

  formats: {
    label: 'Format de la vidéo',
    names: {
      youtube: 'YouTube',
      vertical: 'Shorts / TikTok / Reels',
      square: 'Instagram (carré)',
      portrait: 'Instagram (portrait)',
      custom: 'Personnalisé',
    } satisfies Record<FormatPreset, string>,
    shortNames: {
      youtube: 'YouTube',
      vertical: 'Vertical',
      square: 'Carré',
      portrait: 'Portrait',
      custom: 'Libre',
    } satisfies Record<FormatPreset, string>,
    customDetail: 'Largeur et hauteur au choix',
    size: (width: number, height: number): string => `${width} × ${height}`,
    width: 'Largeur, en pixels',
    height: 'Hauteur, en pixels',
    pixels: 'px',
    /** Avertissement : des éléments dépassent du cadre du format. */
    outOfFrame: (characters: number, shapes: number): string => {
      const parts = [
        characters > 0 ? plural(characters, 'personnage', 'personnages') : '',
        shapes > 0 ? plural(shapes, 'forme', 'formes') : '',
      ].filter(Boolean);
      return parts.length === 0 ? '' : `${parts.join(' et ')} ${characters + shapes > 1 ? 'sortent' : 'sort'} du cadre.`;
    },
  },

  time: {
    justNow: 'à l’instant',
  },

  home: {
    navigation: 'Navigation',
    sections: {
      home: 'Accueil',
      projects: 'Mes projets',
      templates: 'Modèles',
      videos: 'Mes vidéos',
    } satisfies Record<HomeSection, string>,
    /** Libellés courts de la barre d'onglets (téléphone). */
    tabs: {
      home: 'Accueil',
      projects: 'Projets',
      templates: 'Modèles',
      videos: 'Vidéos',
    } satisfies Record<HomeSection, string>,
    newProject: 'Nouveau projet',
    create: 'Créer le projet',
    fps: 'Images par seconde',
    settings: 'Réglages',
    hero: {
      title: 'Que voulez-vous animer aujourd’hui ?',
      search: 'Rechercher un projet ou un modèle',
      shortcuts: 'Créer un projet au format',
      shortcut: (name: string): string => `Nouveau projet ${name}`,
    },
    seeAll: 'Voir tout',
    seeAllLabel: (section: string): string => `Voir tout : ${section}`,
    sort: 'Trier',
    sorts: {
      modified: 'Modifié',
      created: 'Créé',
      az: 'A-Z',
      za: 'Z-A',
    } satisfies Record<ProjectSort, string>,
    view: 'Affichage',
    views: {
      grid: 'Grille',
      list: 'Liste',
    } satisfies Record<ProjectView, string>,
    noResults: (query: string): string => `Aucun résultat pour « ${query} ».`,
    empty: {
      title: 'Aucun projet pour l’instant',
      text: 'Choisissez un format, un modèle de départ, et donnez vie à votre premier stickman.',
      action: 'Créer mon premier projet',
    },
    card: {
      open: (name: string): string => `Ouvrir ${name}`,
      actions: (name: string): string => `Actions pour ${name}`,
      meta: (fps: number, frames: number): string => `${fps} IPS · ${plural(frames, 'image', 'images')}`,
      rename: 'Renommer',
      renameField: 'Nouveau nom du projet',
      duplicate: 'Dupliquer',
      export: 'Exporter',
      delete: 'Supprimer',
      openItem: 'Ouvrir',
      confirmDelete: (name: string): string => `Supprimer « ${name} » ? Cette action est définitive.`,
      copyName: (name: string): string => `${name} (copie)`,
      exporting: (progress: number): string => `Export… ${Math.round(progress * 100)} %`,
    },
    fab: 'Nouveau projet',
    createSheet: {
      title: 'Nouveau projet',
      name: 'Nom du projet',
      namePlaceholder: 'Projet sans titre',
      template: 'Modèle de départ',
      noTemplate: 'Aucun',
      submit: 'Créer',
      cancel: 'Annuler',
    },
    exportSheet: {
      title: (name: string): string => `Exporter « ${name} »`,
      format: 'Format du fichier',
      submit: 'Exporter',
      cancel: 'Fermer',
    },
    notices: {
      duplicated: 'Projet dupliqué.',
      deleted: 'Projet supprimé.',
      exported: (filename: string): string => `Exporté : ${filename}`,
      'export-failed': (detail: string): string => `Échec de l’export : ${detail}`,
      'action-failed': (detail: string): string => `L’action a échoué : ${detail}`,
      'video-deleted': 'Vidéo supprimée.',
      'videos-cleared': 'Vidéos supprimées.',
    },
    loading: 'Chargement…',
  },

  templates: {
    title: 'Commencer avec un modèle',
    names: {
      walk: 'Marche',
      run: 'Course',
      jump: 'Saut',
      punch: 'Coup de poing',
      wave: 'Salut de la main',
      blank: 'Vide',
    } satisfies Record<TemplateId, string>,
    use: (name: string): string => `Nouveau projet à partir du modèle « ${name} »`,
    previous: 'Modèles précédents',
    next: 'Modèles suivants',
    frames: (n: number): string => plural(n, 'image clé', 'images clés'),
  },

  documentTitle: {
    home: 'StickFlow',
    editor: 'StickFlow · Éditeur',
  },

  regions: {
    panel: 'Réglages',
    toolbar: "Barre d'outils",
    stage: 'Zone de dessin',
    timeline: 'Timeline',
  },

  panel: {
    back: 'Retour à l’accueil',
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
    formatSection: 'Format de la vidéo',
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
