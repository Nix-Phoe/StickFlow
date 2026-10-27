// Textes de l'interface, centralisés pour une traduction future.

import type { EditorMode, ExportFormat, SmoothingCurve } from '../core/types';

const plural = (n: number, singular: string, pluralForm: string): string =>
  `${n} ${n > 1 ? pluralForm : singular}`;

export const strings = {
  appName: 'StickFlow',
  defaultProjectName: 'Projet sans titre',

  regions: {
    panel: 'Réglages',
    toolbar: "Barre d'outils",
    stage: 'Zone de dessin',
    timeline: 'Timeline',
  },

  panel: {
    project: 'Projet',
    save: 'Sauvegarder le projet',
    closeDrawer: 'Fermer le panneau de réglages',
    modeLabel: "Mode d'édition",
    modes: {
      character: 'Personnage',
      selection: 'Sélection',
      scene: 'Décor',
    } satisfies Record<EditorMode, string>,

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
    play: 'Lecture',
    pause: 'Pause',
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
    addFrame: 'Ajouter une image',
    frameLabel: (n: number, generated: boolean): string =>
      generated ? `Image ${n}, générée par l’IA` : `Image ${n}`,
  },

  stepper: {
    decrease: (label: string): string => `Diminuer : ${label}`,
    increase: (label: string): string => `Augmenter : ${label}`,
  },

  units: {
    frames: (n: number): string => plural(n, 'image', 'images'),
  },
} as const;
