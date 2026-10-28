#version 300 es
// Une instance = une forme du décor (carré, cercle, rectangle, triangle, ligne).
// Le quad couvre la forme tournée, plus la moitié du trait et une marge d'anticrénelage.

layout(location = 0) in vec2 a_corner;      // coin du quad, dans [-1, 1]²
layout(location = 1) in vec2 a_center;      // par instance, unités du monde
layout(location = 2) in vec2 a_halfSize;
layout(location = 3) in float a_rotation;
layout(location = 4) in float a_kind;       // voir SHAPE_KIND_INDEX (scene.ts)
layout(location = 5) in float a_strokeWidth;
layout(location = 6) in vec4 a_fill;        // RGBA non prémultiplié, alpha 0 = sans remplissage
layout(location = 7) in vec4 a_stroke;

uniform mat3 u_viewProjection;
uniform float u_pixelsPerUnit;

out vec2 v_local;
flat out vec2 v_halfSize;
flat out float v_kind;
flat out float v_strokeWidth;
flat out vec4 v_fill;
flat out vec4 v_stroke;

void main() {
  vec2 extent = a_halfSize + vec2(0.5 * a_strokeWidth + 1.5 / u_pixelsPerUnit);
  vec2 local = a_corner * extent;
  float c = cos(a_rotation);
  float s = sin(a_rotation);
  vec2 world = a_center + vec2(local.x * c - local.y * s, local.x * s + local.y * c);

  v_local = local;
  v_halfSize = a_halfSize;
  v_kind = a_kind;
  v_strokeWidth = a_strokeWidth;
  v_fill = a_fill;
  v_stroke = a_stroke;

  vec3 clip = u_viewProjection * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
