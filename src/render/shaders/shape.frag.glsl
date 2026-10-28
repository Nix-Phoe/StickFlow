#version 300 es
// Forme remplie et / ou tracée par champ de distance signé (même géométrie que model/shape.ts).
// Le trait est centré sur le bord ; il passe par-dessus le remplissage.

precision highp float;

in vec2 v_local;
flat in vec2 v_halfSize;
flat in float v_kind;
flat in float v_strokeWidth;
flat in vec4 v_fill;
flat in vec4 v_stroke;

uniform float u_pixelsPerUnit;

out vec4 outColor;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Ellipse : distance approchée, exacte pour un cercle.
float sdEllipse(vec2 p, vec2 r) {
  vec2 safe = max(r, vec2(1e-4));
  return (length(p / safe) - 1.0) * min(safe.x, safe.y);
}

float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

// Triangle isocèle, pointe en haut.
float sdTriangle(vec2 p, vec2 h) {
  vec2 a = vec2(-h.x, -h.y);
  vec2 b = vec2(h.x, -h.y);
  vec2 c = vec2(0.0, h.y);
  float edge = min(sdSegment(p, a, b), min(sdSegment(p, b, c), sdSegment(p, c, a)));
  bool inside = cross2(b - a, p - a) >= 0.0 && cross2(c - b, p - b) >= 0.0 && cross2(a - c, p - c) >= 0.0;
  return inside ? -edge : edge;
}

void main() {
  float d;
  if (v_kind < 0.5 || (v_kind > 1.5 && v_kind < 2.5)) d = sdBox(v_local, v_halfSize);
  else if (v_kind < 1.5) d = sdEllipse(v_local, v_halfSize);
  else if (v_kind < 3.5) d = sdTriangle(v_local, v_halfSize);
  else d = sdSegment(v_local, vec2(-v_halfSize.x, 0.0), vec2(v_halfSize.x, 0.0));

  bool isLine = v_kind > 3.5;
  float fillCoverage = isLine ? 0.0 : clamp(0.5 - d * u_pixelsPerUnit, 0.0, 1.0);
  float strokeCoverage = v_strokeWidth > 0.0
    ? clamp(0.5 - (abs(d) - 0.5 * v_strokeWidth) * u_pixelsPerUnit, 0.0, 1.0)
    : 0.0;

  float strokeAlpha = v_stroke.a * strokeCoverage;
  float fillAlpha = v_fill.a * fillCoverage * (1.0 - strokeAlpha);
  float alpha = strokeAlpha + fillAlpha;
  if (alpha <= 0.0) discard;
  outColor = vec4(v_stroke.rgb * strokeAlpha + v_fill.rgb * fillAlpha, alpha);   // sortie prémultipliée
}
