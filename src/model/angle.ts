const TURN = 2 * Math.PI;

/** Ramène un angle (radians) dans l'intervalle (-π, π]. */
export function normalizeAngle(angle: number): number {
  const wrapped = angle - TURN * Math.floor(angle / TURN); // dans [0, 2π)
  return wrapped > Math.PI ? wrapped - TURN : wrapped;
}
