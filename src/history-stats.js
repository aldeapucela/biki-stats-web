// Cálculos del histórico a partir de los puntos que ya devuelve la API. Sin DOM, para poder probarlos.
// Las horas y los días se leen en hora de Madrid, que es como los vive quien usa las estaciones,
// y no en la zona del navegador.
export const TIME_ZONE = "Europe/Madrid";
export const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

const madridFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hourCycle: "h23", weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric" });
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Hora (0-23), día de la semana (0 = lunes), día del mes y clave de día de un instante, en hora de Madrid. */
export function madridParts(timestamp) {
  const parts = Object.fromEntries(madridFormat.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return { hour: Number(parts.hour), weekday: WEEKDAY_INDEX[parts.weekday], day: Number(parts.day), dayKey: `${parts.year}-${parts.month}-${parts.day}` };
}

export const totalBikes = (point) => (point.mechanical || 0) + (point.electric || 0);
export const freeDocks = (point) => point.free_docks || 0;

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** Media por hora del día (24 posiciones; `null` si no hay ninguna lectura a esa hora). */
export function hourlyAverages(points, pick) {
  const buckets = Array.from({ length: 24 }, () => []);
  points.forEach((point) => buckets[madridParts(point.timestamp).hour].push(pick(point)));
  return buckets.map((values) => (values.length ? mean(values) : null));
}

/** Hora con el valor más alto y con el más bajo; en un empate gana la más temprana. `null` si no hay datos. */
export function bestAndWorstHour(averages) {
  const known = averages.map((value, hour) => ({ hour, value })).filter((entry) => entry.value !== null);
  if (!known.length) return null;
  const best = known.reduce((top, entry) => (entry.value > top.value ? entry : top));
  const worst = known.reduce((low, entry) => (entry.value < low.value ? entry : low));
  return { best, worst };
}

/**
 * Mapa de calor día × hora de bicis disponibles.
 * 7 días: una fila por día natural. 30 y 90 días: una fila por día de la semana con la media de todas sus semanas.
 * Una casilla sin lecturas es `null`: no se inventa un cero.
 */
export function heatmapRows(points, period) {
  const perDay = period === "7d";
  const rows = new Map();
  points.forEach((point) => {
    const { hour, weekday, day, dayKey } = madridParts(point.timestamp);
    const key = perDay ? dayKey : weekday;
    if (!rows.has(key)) rows.set(key, { label: perDay ? `${WEEKDAYS[weekday]} ${day}` : WEEKDAYS[weekday], order: perDay ? Date.parse(point.timestamp) : weekday, buckets: Array.from({ length: 24 }, () => []) });
    rows.get(key).buckets[hour].push(totalBikes(point));
  });
  const sorted = [...rows.values()].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const result = sorted.map(({ label, buckets }) => ({ label, cells: buckets.map((values) => (values.length ? mean(values) : null)) }));
  const max = Math.max(0, ...result.flatMap((row) => row.cells.filter((value) => value !== null)));
  return { rows: result, max };
}

/** Anclajes de la estación en la última lectura: bicis mecánicas, eléctricas y huecos libres. */
export function stationSlots(point) {
  const mechanical = point?.mechanical || 0;
  const electric = point?.electric || 0;
  const free = point?.free_docks || 0;
  return { mechanical, electric, free, total: mechanical + electric + free };
}
