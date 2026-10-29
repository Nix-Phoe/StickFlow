#version 300 es
// Remplit la capsule par champ de distance : bords nets à toute résolution,
// anticrénelage d'environ un pixel physique.

precision highp float;

in vec2 v_world;
flat in vec2 v_start;
flat in vec2 v_end;
flat in float v_radius;
flat in vec4 v_color;          // RGBA non prémultiplié
flat in vec4 v_clipAxis;       // axe de découpe : départ (xy), arrivée (zw)
flat in vec2 v_clipRange;      // tranche gardée ; 0 et 1 = pas de coupe de ce côté (arrondi gardé)

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

  // Zone de couleur : coupe nette, anticrénelée, perpendiculaire à l'axe.
  if (v_clipRange.x > 0.0 || v_clipRange.y < 1.0) {
    vec2 axis = v_clipAxis.zw - v_clipAxis.xy;
    float axisLength = max(length(axis), 1e-6);
    float along = dot(v_world - v_clipAxis.xy, axis) / axisLength;   // unités du monde
    if (v_clipRange.x > 0.0) coverage *= clamp((along - v_clipRange.x * axisLength) * u_pixelsPerUnit + 0.5, 0.0, 1.0);
    if (v_clipRange.y < 1.0) coverage *= clamp((v_clipRange.y * axisLength - along) * u_pixelsPerUnit + 0.5, 0.0, 1.0);
  }
  if (coverage <= 0.0) discard;

  float alpha = v_color.a * coverage;
  outColor = vec4(v_color.rgb * alpha, alpha);   // sortie prémultipliée
}
