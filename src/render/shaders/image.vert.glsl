#version 300 es
// Le calque de dessin : un rectangle fixe du monde, texturé.

layout(location = 0) in vec2 a_corner;   // coin du quad, dans [-1, 1]²

uniform mat3 u_viewProjection;
uniform vec4 u_bounds;                    // x, y (coin bas-gauche), largeur, hauteur, unités du monde

out vec2 v_uv;

void main() {
  vec2 uv = 0.5 * (a_corner + 1.0);
  vec2 world = u_bounds.xy + uv * u_bounds.zw;
  v_uv = vec2(uv.x, 1.0 - uv.y);          // la texture a son origine en haut
  vec3 clip = u_viewProjection * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
