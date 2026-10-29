# StickFlow

Éditeur d'animation de stickman par nœuds, où l'IA assiste la création sans jamais décider à la place de l'utilisateur.

## Projet et session

**Projet** :
L'animation que l'utilisateur crée et sauvegarde : son nom, son IPS, son format de vidéo, ses personnages, ses images clés, son décor, ses couleurs récentes et ses réglages IA. Toute modification d'un Projet peut être annulée.
_Avoid_ : document, fichier, animation (pour désigner l'ensemble)

**Bibliothèque** :
L'ensemble des Projets enregistrés sur l'appareil, que l'on retrouve sur l'Accueil ou depuis « Ouvrir ».
_Avoid_ : galerie, historique, fichiers récents

**Résumé de projet** :
Ce que l'Accueil montre d'un Projet enregistré sans le charger : nom, format, IPS, nombre d'images, dates de création et de modification, vignette. Les résumés forment l'**index des projets**, mis à jour à chaque sauvegarde ; ils ne font pas partie du Projet.
_Avoid_ : métadonnées, entrée, fiche

**Format de la vidéo** :
La forme et la résolution de l'animation exportée : un préréglage (YouTube 16:9, Shorts / TikTok / Reels 9:16, Instagram carré 1:1 ou portrait 4:5) ou une taille libre. Il fixe le **cadre** de la scène : la zone exportée, toujours aussi haute dans le monde, dont l'extérieur est assombri dans l'éditeur.
_Avoid_ : ratio, résolution (seuls), format d'export (c'est GIF / PNG / vidéo)

**Modèle de départ** :
Un Projet tout prêt (Marche, Course, Saut, Coup de poing, Salut de la main, Vide) dont on crée une copie ; le modèle lui-même n'est jamais modifié.
_Avoid_ : template, exemple, preset

**Vidéo conservée** :
Un GIF ou une vidéo exporté, gardé dans l'app en plus du téléchargement, et que l'on revoit dans « Mes vidéos ».
_Avoid_ : export (pour désigner le fichier gardé), film

**Accueil** :
La page d'ouverture de l'app : rechercher, créer (raccourcis de format, modèles, bouton « + »), retrouver ses Projets et ses vidéos conservées. L'éditeur s'ouvre depuis elle, et y revient en enregistrant le Projet.
_Avoid_ : tableau de bord, galerie, menu principal

**Préférences** :
Les choix mémorisés sur l'appareil, hors de tout Projet : thème, tri et vue de « Mes projets », format et IPS proposés pour un nouveau Projet.
_Avoid_ : réglages du projet, Session

**Session** :
L'état de travail du moment : frame active, sélection, lecture en cours, vitesse de prévisualisation, mode d'édition, outil, format d'export. Elle n'est ni sauvegardée ni annulable.
_Avoid_ : état d'interface, préférences

**Mode d'édition** :
Le contexte dans lequel la scène réagit au pointeur : Personnages ou Environnement. Il se choisit par l'onglet du panneau flottant ; l'autre contexte est atténué et ne capte pas les clics.
_Avoid_ : onglet (pour désigner le mode), outil

## Personnages

**Personnage** :
Un stickman de la scène, avec son propre squelette, son apparence et sa pose dans chaque image clé. Il peut être masqué (ni affiché ni exporté) ou verrouillé (affiché, mais non sélectionnable). Un Projet en contient toujours au moins un.
_Avoid_ : acteur, figure, stickman (pour désigner l'objet du Projet)

**Partie** :
Le segment qui relie un nœud à son parent, désigné par l'id de ce nœud ; la tête est une partie à part entière. On colore les parties une à une ou plusieurs à la fois.
_Avoid_ : membre, os, segment (dans les textes affichés)

**Apparence** :
La couleur du personnage entier, la couleur propre de chaque partie et la taille (50 à 200 %). Elle est la même dans toutes les frames.
_Avoid_ : style, skin

**Zone de couleur** :
Une tranche d'une partie peinte d'une autre couleur, du début à la fin choisis le long de la partie (0 % à l'articulation du parent, 100 % au bout ; pour la tête, du cou au sommet) : une manche, un short, une chaussure, des cheveux. Une partie en a au plus 4, la dernière par-dessus. C'est la **coloration partielle**.
_Avoid_ : bande, dégradé, calque

**Tenue** :
Un ensemble de zones de couleur posées d'un coup sur les parties concernées (T-shirt, pull, short, pantalon, chaussures, cheveux).
_Avoid_ : costume, skin, preset

## Squelette

**Nœud** :
Un point articulé du squelette, relié à son parent par un segment de longueur fixe ; on l'anime en le faisant tourner autour du bout de son parent.
_Avoid_ : os, joint, articulation

**Racine** :
Le nœud sans parent (le bassin) ; le déplacer déplace toute la figure.
_Avoid_ : nœud principal, origine

**Poignée** :
La pastille affichée au bout d'un nœud, que l'on saisit pour le manipuler.
_Avoid_ : point de contrôle, handle

## Frames

**Frame** :
Une pose du squelette à un instant de l'animation : une image clé ou une frame générée.
_Avoid_ : image (sauf dans les textes affichés à l'utilisateur), pose (pour désigner la frame entière)

**Image clé** :
Une frame posée par l'utilisateur ; c'est la seule sorte de frame enregistrée dans le Projet, qui en contient toujours au moins une. L'IA ne la modifie jamais.
_Avoid_ : keyframe, frame utilisateur

**Frame générée** :
Une frame calculée par l'IA entre deux images clés voisines, jamais enregistrée ; la modifier la convertit en image clé.
_Avoid_ : frame IA, intercalaire

**Séquence** :
La suite des frames affichées dans la timeline et jouées : les images clés et, entre elles, les frames générées.
_Avoid_ : timeline (pour désigner les données), liste des frames

**Frame active** :
La frame affichée et modifiable sur le canvas ; elle fait partie de la Session.
_Avoid_ : frame sélectionnée, frame courante

**Pelure d'oignon** :
L'affichage en transparence de la frame précédente derrière la frame active, pour poser la suivante.
_Avoid_ : onion skin, fantôme

**Tête de lecture** :
La frame affichée pendant la lecture ; à l'arrêt, elle se confond avec la frame active.
_Avoid_ : curseur, playhead

**IPS** :
Le nombre de frames jouées par seconde, de 1 à 60.
_Avoid_ : FPS, cadence

## Décor

**Environnement** :
Le décor de la scène : arrière-plan, formes et calque de dessin. En version 1.0, il est le même dans toutes les frames.
_Avoid_ : scène (pour désigner le décor seul), fond

**Forme** :
Un objet vectoriel du décor (carré, cercle, rectangle, triangle, ligne) que l'on sélectionne, déplace, redimensionne et fait pivoter.
_Avoid_ : figure, dessin

**Calque de dessin** :
L'image matricielle du décor sur laquelle peignent les outils de dessin, découpée en tuiles ; chaque trait n'enregistre que les tuiles qu'il touche.
_Avoid_ : canvas, toile, bitmap

**Outil** :
Ce que fait le pointeur en mode Environnement : sélection, une forme à tracer, Remplir, ou un outil de dessin (stylo fin, feutre, pinceau, gomme, plume, aérographe). Il fait partie de la Session.
_Avoid_ : brosse (pour l'ensemble), mode

**Couleurs récentes** :
Les 8 dernières couleurs choisies, enregistrées avec le Projet mais hors de l'historique d'annulation.
_Avoid_ : historique des couleurs, palette

## Améliorations IA

**Réglages IA** :
Les paramètres de Fluidité et de Répétition ; ils font partie du Projet.
_Avoid_ : options IA, effets

**Fluidité** :
L'amélioration qui ajoute des frames générées entre deux images clés consécutives.
_Avoid_ : lissage, interpolation (pour désigner la fonctionnalité)

**Intensité** :
Le nombre de frames générées par la Fluidité entre deux images clés consécutives.

**Courbe** :
La façon dont la Fluidité relie les images clés : linéaire (en ligne droite), douce (un mouvement continu qui passe par toutes les images clés) ou accélération / décélération (le même mouvement, ralenti près de chaque image clé).
_Avoid_ : easing (dans l'interface)

**Répétition** :
L'amélioration qui rend l'animation répétable en générant une transition de la dernière frame vers la première.
_Avoid_ : boucle, loop

**Nombre de répétitions** :
Combien de fois l'animation est jouée ; il est conservé même quand la répétition est infinie.

**Répétition infinie** :
L'animation se répète sans fin ; le nombre de répétitions est alors ignoré, mais pas oublié.
_Avoid_ : boucle infinie

**Transition** :
Les frames générées par la Répétition pour relier la dernière frame à la première.
