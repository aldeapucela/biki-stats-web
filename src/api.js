import { fixtureHistory, fixtureStations, fixtureSummary } from "./fixtures.js";

const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const apiPrefix = `${apiRoot}/api/v1`;
const testMode = new URLSearchParams(globalThis.location?.search || "").get("test") === "1";
const useFixtures = testMode || (import.meta.env.DEV && import.meta.env.VITE_USE_FIXTURES !== "false");

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const envelope = (data) => ({ status: "success", code: 200, data, errors: null, meta: {} });

async function request(path, signal) {
  const response = await fetch(`${apiPrefix}${path}`, { signal, headers: { Accept: "application/json" } });
  let body;
  try { body = await response.json(); } catch { throw new ApiError("La API devolvió una respuesta no válida", "INTERNAL_ERROR", response.status); }
  if (!response.ok || body.status === "error") {
    const detail = body.errors?.[0];
    throw new ApiError(detail?.message || "No se pudo consultar la API", detail?.code || "API_ERROR", response.status);
  }
  return body;
}

// La captura es cada 300 s (medido: 288 puntos en 24 h, huecos de 300,4-300,9 s) y la API cachea por URL exacta:
// la misma consulta tarda ~0,2 s y desplazada 1 s vuelve a tardar 2-23 s. `to` se redondea hacia arriba al intervalo
// de captura para que history, summary y las repeticiones del mismo periodo compartan URL.
export const CAPTURE_INTERVAL_MS = 300_000;

const dateRange = (period, now = new Date()) => {
  const to = new Date(Math.ceil(now.getTime() / CAPTURE_INTERVAL_MS) * CAPTURE_INTERVAL_MS);
  const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[period] || 1;
  const from = new Date(to.getTime() - days * 24 * 3600_000);
  return { from: from.toISOString(), to: to.toISOString(), granularity: days > 7 ? "day" : "hour" };
};

// La API limita `limit` a 100; se recorren las páginas hasta que `has_more` sea falso.
export async function collectPages(fetchPage, maxPages = 20) {
  const data = [];
  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetchPage(data.length);
    const items = response.data || [];
    data.push(...items);
    if (!response.meta?.pagination?.has_more || items.length === 0) break;
  }
  return { ...envelope(data), meta: {} };
}

export const api = {
  async listStations(params = {}, signal) {
    if (useFixtures) return envelope(fixtureStations);
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
    return request(`/stations?${query}`, signal);
  },
  async listAllStations(params = {}, signal) {
    if (useFixtures) return envelope(fixtureStations);
    return collectPages((offset) => api.listStations({ ...params, limit: 100, offset }, signal));
  },
  async nearby(lat, lon, signal) {
    if (useFixtures) return envelope(fixtureStations.map((item, index) => ({ ...item, distance_m: 320 + index * 180 })));
    return request(`/stations/nearby?${new URLSearchParams({ lat, lon, radius_m: 10000, limit: 100 })}`, signal);
  },
  async history(stationId, period, signal) {
    const range = dateRange(period);
    if (useFixtures) return envelope(fixtureHistory(stationId, range.from, range.to, range.granularity));
    return request(`/stations/${encodeURIComponent(stationId)}/history?${new URLSearchParams({ from: range.from, to: range.to, granularity: range.granularity })}`, signal);
  },
  async summary(stationId, period, signal) {
    const range = dateRange(period);
    if (useFixtures) return envelope(fixtureSummary(stationId, range.from, range.to));
    return request(`/stations/${encodeURIComponent(stationId)}/summary?${new URLSearchParams({ from: range.from, to: range.to })}`, signal);
  },
  apiPrefix,
  useFixtures,
  testMode,
};

export { dateRange };
