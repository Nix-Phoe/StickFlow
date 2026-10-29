# 0003 — Calque de dessin découpé en tuiles

- Statut : accepté (version 1.0)
- Contexte : ADR 0001 (historique par instantanés du Projet)

## Contexte

La version 1.0 ajoute un calque de dessin matriciel au décor (stylo, feutre, pinceau, plume,
aérographe, gomme, pot de peinture). Il doit être enregistré dans le Projet en PNG (data URL)
et chaque trait doit être annulable.

L'historique (ADR 0001) garde jusqu'à 100 instantanés du Projet. Avec un seul PNG pour tout le
calque (2048 × 768 pixels), chaque trait produirait une nouvelle image entière : réencodage
coûteux au relâchement, et jusqu'à 100 copies du calque en mémoire.

## Décision

Le calque a une taille fixe dans le monde (aussi haut que la scène, 2048 × 768 pixels) et il
est découpé en tuiles de 256 × 256. Le Projet ne contient que les tuiles peintes
(`environment.drawing.tiles`, PNG en data URL par « colonne,ligne »).

Un trait terminé n'encode que les tuiles qu'il a touchées et devient un seul changement nommé
(`paintDrawing`). Les instantanés partagent les chaînes des tuiles inchangées : un trait ne coûte
en mémoire que ses propres tuiles. Une tuile redevenue transparente (gomme) est retirée.

À l'écran, un canvas hors écran (`drawing/surface.ts`) reflète les tuiles du Projet ; il ne
décode que celles qui ont changé (après annuler / rétablir, ouverture) et ne renvoie au GPU que
la zone modifiée.

## Conséquences

- C'est l'« instantané de la zone modifiée » demandé, sans changer le principe de l'ADR 0001.
- Le format de fichier v2 porte des tuiles au lieu d'un PNG unique ; un calque peut s'exporter
  en une image en les assemblant.
- Pendant un trait, le calque est peint directement (aperçu immédiat) ; le Projet ne change qu'au
  relâchement.
