// Modo «En ruta»: tiempos del trayecto, frecuencia histórica de que haya bici o hueco a la hora de llegada y alternativas.
// Sin DOM, para poder probarlo. La tabla sale de scripts/build-availability.py; el método está en docs/MEDICION_DISPONIBILIDAD.md.
import TABLE from "./availability-table.json";
import { distanceMeters, estimateMinutes } from "./destination.js";

// Medido (docs/MEDICION_DISPONIBILIDAD.md): con menos de 300 lecturas en una celda, la misma celda calculada con la primera y la
// segunda mitad del periodo difiere de mediana 0,06–0,15 y p90 0,21–0,30; con 300 o más, de mediana 0,03 y p90 ~0,10.
export const MIN_READINGS = 300;
// Las estaciones con 3 o más (bicis o huecos) ahora tienen en la tabla una frecuencia de 0,99 o más a cualquier hora y horizonte.
export const ALTERNATIVE_MIN = 3;
// Supuesto NO medido: velocidad andando. Se aplica con el mismo factor de rodeo que la bici (destination.js).
export const WALK_SPEED_KMH = 5;
const DETOUR_FACTOR = 1.3;
// Tramos de la frecuencia. El p90 de la diferencia entre mitades de la muestra ronda 0,10: no se enseña un porcentaje exacto.
export const LEVEL_EDGES = [[0.9, "sure"], [0.7, "likely"], [0.4, "doubtful"], [0, "unlikely"]];

const WEEKDAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const clock = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" });

/** Día de la semana, mes, día y hora en Europe/Madrid, no en la zona del navegador. */
export function madridParts(date) {
  const found = Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
  return { weekday: WEEKDAY[found.weekday], month: Number(found.month), day: Number(found.day), hour: Number(found.hour) };
}

/** 0 laborable, 1 sábado, 2 domingo o festivo nacional de fecha fija. */
export function dayType(date, table = TABLE) {
  const { weekday, month, day } = madridParts(date);
  if (table.fixed_holidays.some(([m, d]) => m === month && d === day)) return 2;
  return weekday < 5 ? 0 : weekday === 5 ? 1 : 2;
}

export function bandOf(date, table = TABLE) {
  const { hour } = madridParts(date);
  return table.band_starts.reduce((band, start, index) => (hour >= start ? index : band), 0);
}

/** Primer horizonte de la tabla que cubre `minutes`; null si no hay (demasiado lejos) o si no hay que esperar. */
export function horizonFor(minutes, table = TABLE) {
  if (!(minutes > 0)) return null;
  return table.horizons.find((horizon) => horizon >= minutes) ?? null;
}

export const levelOf = (p) => LEVEL_EDGES.find(([edge]) => p >= edge)[1];

/** Bicis (mecánicas + eléctricas) o huecos libres de una estación; null si falta el dato. */
export function countFor(kind, station) {
  if (kind === "dock") return station?.free_docks ?? null;
  const { mechanical, electric } = station?.bikes ?? {};
  return mechanical == null && electric == null ? null : (mechanical || 0) + (electric || 0);
}

/**
 * Frecuencia histórica de que haya bici (`kind` "bike") o hueco ("dock") dentro de `minutesAhead`, dado cuántos hay ahora.
 * Devuelve { ok: true, level, p, n, horizon, arrival } o { ok: false, reason }: "unknown" (sin dato ahora), "now" (llegas
 * ya: vale el dato en tiempo real), "far" (más de 45 min), "few" (menos de MIN_READINGS lecturas parecidas).
 */
export function outlook(kind, count, minutesAhead, { now = new Date(), table = TABLE } = {}) {
  if (count == null) return { ok: false, reason: "unknown" };
  if (!(minutesAhead > 0)) return { ok: false, reason: "now" };
  const horizon = horizonFor(minutesAhead, table);
  if (horizon == null) return { ok: false, reason: "far" };
  const arrival = new Date(now.getTime() + minutesAhead * 60_000);
  const index = (dayType(arrival, table) * table.band_starts.length + bandOf(arrival, table)) * table.states + Math.min(Math.floor(count), table.states - 1);
  const [p, n] = table.table[kind][String(horizon)][index];
  if (p == null || n < MIN_READINGS) return { ok: false, reason: "few", arrival };
  return { ok: true, level: levelOf(p), p, n, horizon, arrival };
}

export const formatClock = (date) => clock.format(date);

/** Minutos andando entre dos puntos en línea recta, con factor de rodeo. Estimación, no ruta. */
export function walkMinutes(straightMeters) {
  const metersPerMinute = (WALK_SPEED_KMH * 1000) / 60;
  return Math.max(1, Math.ceil((straightMeters * DETOUR_FACTOR) / metersPerMinute));
}

/**
 * Tiempos de la ruta. `origin` y `destination` son estaciones (o null); `user` es { latitude, longitude } o null.
 * Sin ubicación se supone que se sale ya de la estación de origen. Sin origen se supone que ya se tiene la bici
 * y se sale de la ubicación del usuario, como en la tarjeta de destino de la #27.
 * Devuelve minutos hasta recoger (pickup) y hasta dejar (drop); null si no se pueden calcular.
 */
export function planRoute({ user, origin, destination }) {
  const at = (station) => (station?.location?.latitude != null && station.location.longitude != null ? station.location : null);
  const originAt = at(origin); const destinationAt = at(destination);
  const walk = user && originAt ? walkMinutes(distanceMeters(user, originAt)) : null;
  const pickup = origin ? (walk ?? 0) : null;
  let ride = null;
  if (destinationAt && origin && originAt) ride = estimateMinutes(distanceMeters(originAt, destinationAt));
  else if (destinationAt && !origin && user) ride = estimateMinutes(distanceMeters(user, destinationAt));
  const drop = ride == null ? null : (pickup ?? 0) + ride;
  return { walk, ride, pickup, drop };
}

/** Las `count` estaciones más cercanas a `from` con `ALTERNATIVE_MIN` o más bicis (o huecos) ahora, sin contar `excludeId`. */
export function alternatives(stations, kind, from, excludeId, count = 2) {
  if (from?.latitude == null || from.longitude == null) return [];
  return stations
    .filter((station) => station.station_id !== excludeId && !station.is_stale && station.location?.latitude != null && (countFor(kind, station) ?? 0) >= ALTERNATIVE_MIN)
    .map((station) => ({ station, meters: distanceMeters(from, station.location) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count);
}
