# Historique annuler / rétablir par instantanés du Projet, et non par commandes

Le Projet est immuable : l'historique conserve les instantanés précédents (100 étapes au maximum), et annuler restaure le précédent. Nous avons écarté le pattern Command initialement prévu dans CLAUDE.md, car il oblige chaque action (ajout de frame, rotation de nœud, réglage IA, conversion d'une frame générée en image clé…) à coder son propre inverse : une seule erreur d'inverse corrompt l'historique, alors que les instantanés couvrent toute action, présente ou future, sans code supplémentaire. Le coût mémoire reste faible grâce au partage des parties inchangées entre instantanés.

## Conséquences

- L'historique est un détail interne du module Projet (`src/model/project/`) : il n'y a pas de `core/history.ts`.
- Des changements consécutifs du même réglage à moins d'une seconde d'intervalle forment une seule étape d'annulation (glissement de slider, clics répétés sur un stepper).
- Ne jamais muter un Projet en place : cela casserait le partage entre instantanés.
