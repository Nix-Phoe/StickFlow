#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_image;               // prémultipliée au chargement
uniform float u_opacity;

out vec4 outColor;

void main() {
  outColor = texture(u_image, v_uv) * u_opacity;
}
