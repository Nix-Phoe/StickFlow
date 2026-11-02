# Journal des versions

Toutes les évolutions notables de StickFlow. Les numéros suivent le [versionnage sémantique](https://semver.org/lang/fr/).

## 2.2.0 — Phase 7A : mise en ligne (PWA)

- Application web progressive installable : manifeste, icônes, fonctionnement complet hors ligne (service worker), bannière « Nouvelle version disponible » qui enregistre le projet ouvert avant de recharger.
- Bouton « Installer l’app » dans les Réglages, invitation discrète sur l’accueil (refusable définitivement), explication pour iPhone et iPad.
- Protection des projets :
  - stockage protégé (`navigator.storage.persist()`) ;
  - export et import d’un projet (fichier `.stickflow`) ;
  - sauvegarde et restauration de tous les projets.
- Hébergement sur Cloudflare Workers : le site et le proxy d’images (`/api/*`) dans un seul Worker. En-têtes de cache et de sécurité (CSP stricte).
- Pages publiques : Politique de confidentialité, À propos et crédits (licences des bibliothèques), page 404.
- Démarrage plus rapide : l’éditeur et les encodeurs d’export sont chargés à la demande.
- Page « Navigateur non compatible » quand WebGL 2 manque, page d’erreur qui propose de recharger sans perdre le travail enregistré.
- Numéro de version dans les Réglages. Référencement (balises de partage, `robots.txt`, `sitemap.xml`) et intégration continue (GitHub Actions).

## 2.1.0 — Arrière-plan personnalisé

- Arrière-plan en couleur, en dégradé, intégré (six décors dessinés par l’app), ou en image de l’appareil ou d’Internet (banque Pexels, adresse web).
- Réglages d’image : ajustement, point focal, zoom, flou, luminosité, opacité, voile.
- Magasin d’images à part, fichier de projet version 4.

## 2.0.1 — Création de projet simplifiée

- Un rôle par point d’entrée : raccourcis de format en un clic, « Libre » et « + » ouvrent la feuille complète.
- Noms des formats harmonisés partout.

## 2.0.0 — Page d’accueil

- Accueil (projets, modèles, vidéos), formats de vidéo et cadre, réglages et thème.
- Vidéos conservées dans l’app, fichier de projet version 3.

## 1.0.0 — Personnages et environnement

- Plusieurs personnages, apparence (couleurs, zones de couleur, taille), grande palette.
- Environnement : formes vectorielles et calque de dessin.

## 0.1.0 — Phases 1 à 6

- Éditeur d’animation par nœuds, timeline, lecture, pelure d’oignon, annuler / rétablir.
- Fluidité et Répétition, sauvegarde (IndexedDB), export GIF, PNG et vidéo.
