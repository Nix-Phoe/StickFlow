# Seules les images clés sont enregistrées ; la séquence est dérivée

Le Projet ne stocke que les images clés (`Project.keyframes`) et les réglages IA ; la séquence affichée et jouée (images clés + frames générées) est calculée à la demande par `model/sequence.ts`. Nous avons écarté le stockage des frames générées dans le même tableau que les images clés (marquées `generated`), car chaque régénération (changement d'intensité, de courbe, d'une image clé voisine) aurait obligé chaque écriture à respecter la règle « non destructif », et décalé les positions sous la sélection.

## Conséquences

- Le caractère non destructif de l'IA est structurel : aucune fonction ne peut modifier une image clé en régénérant.
- Les frames sont désignées par un id stable (`activeFrameId` dans la Session) ; une frame générée a pour id « de → vers #rang ».
- Modifier une frame générée (glisser, coller, « + ») la convertit en nouvelle image clé insérée entre ses voisines ; une seule annulation la retire.
- Une frame générée ne peut pas encore être supprimée ni figée individuellement : il faudra, le moment venu, des surcharges par segment dans le Projet.
- Le format de sauvegarde (phase 6) ne contient que les images clés.
