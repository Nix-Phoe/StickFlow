# 0004 — Vues montées par le routeur, et index des projets hors du Projet

- Statut : accepté (version 2.0)
- Contexte : ADR 0001 (historique par instantanés du Projet)

## Contexte

La version 2.0 ajoute une page d'accueil : l'app s'ouvre sur la liste des projets, et l'éditeur
n'est plus qu'une page parmi d'autres (`#/editor/:id`). Deux questions se posent.

1. **Durée de vie de l'éditeur.** Jusqu'ici, `main.ts` créait une fois pour toutes le bus, le
   store, le rendu WebGL et les modules. En allant et venant entre l'accueil et l'éditeur, ces
   ressources doivent être libérées (écouteurs globaux, `requestAnimationFrame`, contexte WebGL,
   que le navigateur limite).
2. **Dates et vignette d'un projet.** L'accueil doit afficher vite (moins d'une seconde avec
   50 projets) le nom, le format, l'IPS, le nombre d'images, les dates et une vignette de chaque
   projet, sans charger les projets complets.

## Décision

**Chaque vue crée et détruit tout ce qu'elle utilise.** `views/editor-view.ts` crée à son
montage un bus, un store et les modules de l'éditeur, et les libère à sa destruction (le rendu
rend son contexte WebGL avec `WEBGL_lose_context`). L'accueil (`views/home-view.ts`) a lui aussi
son bus et son store (`Store<HomeState>`, le store est devenu générique). Un événement oublié
disparaît avec son bus : pas de fuite d'une vue à l'autre. `views/view-host.ts` enchaîne les
changements de route (la vue qui part finit sa sauvegarde automatique avant d'être détruite ;
une route dépassée par une plus récente est ignorée).

**Les dates et la vignette ne sont pas dans le Projet.** Le Projet ne gagne que son `format`
(un choix de l'utilisateur, annulable). `createdAt`, `updatedAt` et `thumbnail` vivent dans
l'enregistrement de la bibliothèque et dans un **index des projets** séparé (base IndexedDB
`stickflow-index`, un résumé par projet), mis à jour à chaque sauvegarde. Les projets enregistrés
avant l'index y sont ajoutés à la première lecture.

## Conséquences

- Annuler ne fait jamais revenir une date de modification en arrière, et `saveStatus` (qui
  compare le Projet par référence) n'est pas faussé par une date qui change à chaque sauvegarde.
- L'accueil lit l'index seul ; il ne charge un projet complet que pour l'aperçu animé de la carte
  survolée, une vignette manquante ou une action (renommer, dupliquer, exporter).
- La vignette est rendue aux couleurs de l'export (fond blanc, stickman foncé), indépendamment du
  thème de l'interface.
- Le fichier de projet passe en version 3 (le format) ; les dates ne font pas partie du fichier.
- Écart assumé avec le prompt v2.0 : il plaçait `createdAt`, `updatedAt` et `thumbnail` dans le
  projet ; ils sont dans son résumé. Les noms de fichiers suivent la convention du projet
  (`home-view.ts`, `project-index`… en kebab-case) plutôt que `HomeView.ts`.
