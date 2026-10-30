// Estación destino: distancia y tiempo estimados y aviso de bajada de huecos. Sin DOM, para poder probarlo.

// Supuestos NO medidos (la API no tiene viajes ni rutas): velocidad de ciclista urbano y factor de rodeo entre la
// línea recta y el recorrido por calles. El tiempo se rotula siempre como estimación.
export const BIKE_SPEED_KMH = 15;
export const DETOUR_FACTOR = 1.3;

// Medido contra la API pública (30-oct-2026, 104 estaciones, 3 días de capturas `raw` cada 5 min): en 15 min los
// huecos libres no cambian el 62,6 % de las veces y bajan el 18,6 %; la bajada es de 1 hueco en el p90, de 2 en el
// p95 y de 4 en el p99 (máximo 13). Avisar con 3 o más deja el aviso en las bajadas poco habituales.
export const DROP_ALERT_DOCKS = 3;
export const DROP_WINDOW_MS = 15 * 60_000;

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Distancia en línea recta (haversine) entre dos puntos {latitude, longitude}, en metros. */
export function distanceMeters(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Minutos estimados en bici para una distancia en línea recta (con factor de rodeo), redondeados hacia arriba. */
export function estimateMinutes(straightMeters) {
  const metersPerMinute = (BIKE_SPEED_KMH * 1000) / 60;
  return Math.max(1, Math.ceil((straightMeters * DETOUR_FACTOR) / metersPerMinute));
}

/** Añade una lectura de huecos libres y descarta las que ya no caben en la ventana. Devuelve una lista nueva. */
export function recordSample(samples, at, freeDocks) {
  if (freeDocks == null) return samples;
  return [...samples, { at, freeDocks }].filter((sample) => at - sample.at <= DROP_WINDOW_MS);
}

/**
 * Bajada de huecos libres dentro de la ventana, medida contra la lectura más antigua que contiene.
 * Devuelve { from, to, minutes } si la bajada llega al umbral; si no, null.
 */
export function docksDrop(samples, at = samples[samples.length - 1]?.at) {
  if (samples.length < 2) return null;
  const latest = samples[samples.length - 1];
  const oldest = samples.find((sample) => at - sample.at <= DROP_WINDOW_MS);
  if (!oldest || oldest === latest) return null;
  const drop = oldest.freeDocks - latest.freeDocks;
  if (drop < DROP_ALERT_DOCKS) return null;
  return { from: oldest.freeDocks, to: latest.freeDocks, minutes: Math.max(1, Math.round((latest.at - oldest.at) / 60_000)) };
}
