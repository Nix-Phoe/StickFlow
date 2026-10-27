Shaders GLSL `#version 300 es`, importés en texte (`?raw`) par `render/renderer.ts`.

- `capsule.vert.glsl` / `capsule.frag.glsl` : une capsule par instance (membres et tête du stickman), remplie par champ de distance. Les emplacements d'attributs (`layout(location = …)`) doivent correspondre à `ATTRIBUTE` dans `renderer.ts`, et leur disposition à `FLOATS_PER_CAPSULE` dans `scene.ts`.
