// Disponibilidad de bicis de una estación, por tipo: decide el color del marcador del mapa (semáforo).
// Rojo si no hay ninguna; naranja si falta un tipo (mecánica o eléctrica a cero); verdes si hay de las dos,
// más oscuros cuanto más hay del tipo con menos bicis. Cortes medidos sobre 33 estaciones con de las dos
// (mínimo entre M y E: 1 → 9, 2 → 13, 3 → 7, 4 o más → 4).
export const BOTH_MID_MIN = 2;
export const BOTH_HIGH_MIN = 4;

export function bikesTone(station) {
  const { mechanical, electric } = station.bikes ?? {};
  if (mechanical == null && electric == null) return "unknown";
  const m = mechanical || 0;
  const e = electric || 0;
  if (m + e === 0) return "none";
  if (m === 0 || e === 0) return "partial";
  const fewer = Math.min(m, e);
  return fewer >= BOTH_HIGH_MIN ? "ok-high" : fewer >= BOTH_MID_MIN ? "ok-mid" : "ok-low";
}
