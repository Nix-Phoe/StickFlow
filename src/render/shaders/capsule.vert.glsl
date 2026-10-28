#version 300 es
// Une instance = une capsule (segment épais à bouts ronds) de sa propre couleur.
// Le quad est étiré le long du segment, avec une marge pour l'anticrénelage.

layout(location = 0) in vec2 a_corner;   // coin du quad, dans [-1, 1]²
layout(location = 1) in vec2 a_start;    // par instance, unités du monde
layout(location = 2) in vec2 a_end;
layout(location = 3) in float a_radius;
layout(location = 4) in vec4 a_color;    // RGBA non prémultiplié

uniform mat3 u_viewProjection;
uniform float u_pixelsPerUnit;

out vec2 v_world;
flat out vec2 v_start;
flat out vec2 v_end;
flat out float v_radius;
flat out vec4 v_color;

void main() {
  float pad = a_radius + 1.5 / u_pixelsPerUnit;
  vec2 axis = a_end - a_start;
  float len = length(axis);
  vec2 dir = len > 0.0 ? axis / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  vec2 center = 0.5 * (a_start + a_end);

  vec2 world = center + dir * a_corner.x * (0.5 * len + pad) + normal * a_corner.y * pad;

  v_world = world;
  v_start = a_start;
  v_end = a_end;
  v_radius = a_radius;
  v_color = a_color;

  vec3 clip = u_viewProjection * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
