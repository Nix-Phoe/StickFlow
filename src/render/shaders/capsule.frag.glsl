#version 300 es
// Remplit la capsule par champ de distance : bords nets à toute résolution,
// anticrénelage d'environ un pixel physique.

precision highp float;

in vec2 v_world;
flat in vec2 v_start;
flat in vec2 v_end;
flat in float v_radius;
flat in vec4 v_color;          // RGBA non prémultiplié

uniform float u_pixelsPerUnit;

out vec4 outColor;

float distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float distancePx = (distanceToSegment(v_world, v_start, v_end) - v_radius) * u_pixelsPerUnit;
  float coverage = clamp(0.5 - distancePx, 0.0, 1.0);
  if (coverage <= 0.0) discard;

  float alpha = v_color.a * coverage;
  outColor = vec4(v_color.rgb * alpha, alpha);   // sortie prémultipliée
}
