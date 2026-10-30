// Disponibilidad de bicis (mecánicas + eléctricas) de una estación: decide el color del marcador del mapa.
export const BIKES_OK_MIN = 4;

export function bikesTone(station) {
  const { mechanical, electric } = station.bikes ?? {};
  if (mechanical == null && electric == null) return "unknown";
  const total = (mechanical || 0) + (electric || 0);
  return total >= BIKES_OK_MIN ? "ok" : total >= 1 ? "few" : "none";
}
