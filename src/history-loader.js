import { CAPTURE_INTERVAL_MS } from "./api.js";

// Los datos solo cambian con cada captura (300 s): una entrada más vieja ya tiene un punto nuevo detrás.
export const HISTORY_TTL_MS = CAPTURE_INTERVAL_MS;
// Medido contra la API pública (25-oct-2026, 2 estaciones x 3 repeticiones): 24 h en frío 0,19-0,29 s y cualquier
// consulta repetida ~0,2 s; en frío 7 d 3,5-3,7 s, 30 d 2-23 s (history) y 6,5-7,3 s (summary), 90 d 2,5-4,2 s.
// 1,5 s separa lo normal de lo lento sin avisar en 24 h.
export const SLOW_AFTER_MS = 1500;

const PARTS = ["history", "summary"];
const emptyPart = (previous) => ({ status: "loading", data: previous?.data, error: null });

const toError = (error) => (error instanceof Error ? error : new Error("No se pudo cargar el histórico"));

/**
 * Carga el histórico de una estación en dos partes independientes (puntos y resumen).
 * - Cancela la carga anterior al cambiar de estación o de periodo y descarta sus respuestas.
 * - Cachea por `estación:periodo`; la caché se vacía al cambiar de estación y caduca con HISTORY_TTL_MS.
 * - Si una parte falla, la otra se conserva; `retry` repite solo la que falló.
 * Sin DOM: `onChange` avisa de cualquier cambio visible.
 */
export function createHistoryLoader({ api, onChange = () => {}, now = () => Date.now(), ttlMs = HISTORY_TTL_MS, slowAfterMs = SLOW_AFTER_MS }) {
  let cache = new Map();
  let stationId = null;
  const loads = new Map(); // key -> { controller, timer }

  const keyOf = (id, period) => `${id}:${period}`;
  const isLoading = (entry) => PARTS.some((part) => entry[part].status === "loading");

  function stop(key) {
    const load = loads.get(key);
    if (!load) return;
    load.controller.abort();
    clearTimeout(load.timer);
    loads.delete(key);
  }

  function stopAll() { [...loads.keys()].forEach(stop); }

  // Cancela las cargas de otras claves. Una entrada a medias (sin datos que mostrar) se descarta para que
  // volver a ella la pida de nuevo; la que solo se estaba refrescando conserva sus datos.
  function stopOthers(keep) {
    [...loads.keys()].filter((key) => key !== keep).forEach((key) => {
      stop(key);
      const entry = cache.get(key);
      if (!entry) return;
      if (PARTS.some((part) => entry[part].status === "loading" && entry[part].data === undefined)) cache.delete(key);
      else PARTS.forEach((part) => { if (entry[part].status === "loading") entry[part].status = "ok"; });
    });
  }

  function finish(key) {
    const entry = cache.get(key);
    const load = loads.get(key);
    if (!load || (entry && isLoading(entry))) return;
    clearTimeout(load.timer);
    loads.delete(key);
    if (entry) entry.slow = false;
  }

  function fetchPart(part, id, period, key, controller) {
    const entry = cache.get(key);
    entry[part] = emptyPart(entry[part]);
    return api[part](id, period, controller.signal).then(
      (response) => {
        if (controller.signal.aborted) return;
        entry[part] = { status: "ok", data: response.data, error: null };
      },
      (error) => {
        if (controller.signal.aborted) return;
        // Un refresco fallido no tira los datos que ya se estaban mostrando.
        entry[part] = entry[part].data !== undefined ? { status: "ok", data: entry[part].data, error: null } : { status: "error", data: undefined, error: toError(error) };
      },
    ).then(() => {
      if (controller.signal.aborted) return;
      finish(key);
      onChange();
    });
  }

  function start(id, period, parts) {
    const key = keyOf(id, period);
    stop(key);
    const controller = new AbortController();
    const entry = cache.get(key) || { loadedAt: now(), slow: false, history: emptyPart(), summary: emptyPart() };
    cache.set(key, entry);
    entry.loadedAt = now();
    entry.slow = false;
    const timer = setTimeout(() => {
      if (loads.get(key)?.controller !== controller) return;
      entry.slow = true;
      onChange();
    }, slowAfterMs);
    loads.set(key, { controller, timer });
    const pending = parts.map((part) => fetchPart(part, id, period, key, controller));
    return Promise.all(pending).then(() => undefined);
  }

  return {
    /** Entrada de caché vigente (o la caducada, para seguir mostrándola mientras se refresca). */
    get(id, period) { return cache.get(keyOf(id, period)); },

    /** Inicia la carga si hace falta; cancela cualquier otra en curso. Idempotente mientras la entrada sea válida. */
    load(id, period) {
      if (stationId !== id) { stopAll(); cache = new Map(); stationId = id; }
      const key = keyOf(id, period);
      stopOthers(key);
      const entry = cache.get(key);
      if (entry && (loads.has(key) || now() - entry.loadedAt < ttlMs)) return Promise.resolve();
      return start(id, period, PARTS);
    },

    /** Repite la parte indicada ("history" o "summary") o, sin parte, todas las que fallaron. */
    retry(id, period, part) {
      const key = keyOf(id, period);
      const entry = cache.get(key);
      if (!entry || stationId !== id) return Promise.resolve();
      const wanted = part ? [part].filter((name) => PARTS.includes(name)) : PARTS.filter((name) => entry[name].status === "error");
      if (!wanted.length) return Promise.resolve();
      // Las partes que seguían en vuelo se repiten también: `start` cancela la carga de la clave entera.
      const parts = PARTS.filter((name) => wanted.includes(name) || entry[name].status === "loading");
      stopOthers(key);
      const promise = start(id, period, parts);
      onChange();
      return promise;
    },

    clear() { stopAll(); cache = new Map(); stationId = null; },
  };
}
