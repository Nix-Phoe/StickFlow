Shaders GLSL `#version 300 es`, importés en texte (`?raw`) par `render/renderer.ts`.

- `capsule.vert.glsl` / `capsule.frag.glsl` : une capsule par instance (membres et tête du stickman), remplie par champ de distance, éventuellement découpée le long d'un axe (zone de couleur : axe et tranche gardée). Les emplacements d'attributs (`layout(location = …)`) doivent correspondre à `ATTRIBUTE` dans `renderer.ts`, et leur disposition à `FLOATS_PER_CAPSULE` dans `scene.ts`.
- `shape.vert.glsl` / `shape.frag.glsl` : une forme du décor par instance (carré, cercle, rectangle, triangle, ligne), remplie et tracée par champ de distance signé, avec la même géométrie que `model/shape.ts`. Disposition : `FLOATS_PER_SHAPE` et `SHAPE_KIND_INDEX` dans `scene.ts`.
- `image.vert.glsl` / `image.frag.glsl` : le calque de dessin, un rectangle fixe du monde (`DRAWING_LAYER_WORLD`) texturé par le canvas du calque.
