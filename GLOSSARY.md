# StickFlow

Éditeur d'animation de stickman par nœuds, où l'IA assiste la création sans jamais décider à la place de l'utilisateur.

## Projet et session

**Projet** :
L'animation que l'utilisateur crée et sauvegarde : son nom, son IPS, son squelette, ses frames et ses réglages IA. Toute modification d'un Projet peut être annulée.
_Avoid_ : document, fichier, animation (pour désigner l'ensemble)

**Session** :
L'état de travail du moment : frame active, lecture en cours, vitesse de prévisualisation, mode d'édition, format d'export. Elle n'est ni sauvegardée ni annulable.
_Avoid_ : état d'interface, préférences

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
