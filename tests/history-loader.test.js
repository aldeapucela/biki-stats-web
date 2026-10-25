import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHistoryLoader, HISTORY_TTL_MS, SLOW_AFTER_MS } from "../src/history-loader.js";

// API simulada: cada llamada queda pendiente hasta que el test la resuelve o la rechaza.
function fakeApi() {
  const calls = [];
  const make = (part) => (stationId, period, signal) => new Promise((resolve, reject) => {
    const call = { part, stationId, period, signal, aborted: false };
    signal.addEventListener("abort", () => { call.aborted = true; reject(new DOMException("abortado", "AbortError")); });
    call.resolve = (data = `${part}:${stationId}:${period}`) => resolve({ data });
    call.reject = (error = new Error(`${part} falló`)) => reject(error);
    calls.push(call);
  });
  return { api: { history: make("history"), summary: make("summary") }, calls };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async (...calls) => { calls.forEach((call) => call.resolve()); await flush(); };

describe("createHistoryLoader", () => {
  let clock;
  beforeEach(() => { clock = 1_000_000; });
  afterEach(() => { vi.useRealTimers(); });

  const setup = (options = {}) => {
    const { api, calls } = fakeApi();
    const onChange = vi.fn();
    const loader = createHistoryLoader({ api, onChange, now: () => clock, ...options });
    return { loader, calls, onChange };
  };

  it("carga puntos y resumen y los deja en la caché", async () => {
    const { loader, calls, onChange } = setup();
    loader.load("72", "24h");
    expect(calls.map((call) => call.part)).toEqual(["history", "summary"]);
    expect(loader.get("72", "24h").history.status).toBe("loading");
    await settle(...calls);
    const entry = loader.get("72", "24h");
    expect(entry.history).toMatchObject({ status: "ok", data: "history:72:24h" });
    expect(entry.summary).toMatchObject({ status: "ok", data: "summary:72:24h" });
    expect(onChange).toHaveBeenCalled();
  });

  it("no repite la petición mientras la entrada está en vuelo ni mientras es vigente", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    loader.load("72", "24h");
    expect(calls).toHaveLength(2);
    await settle(...calls);
    loader.load("72", "24h");
    clock += HISTORY_TTL_MS - 1;
    loader.load("72", "24h");
    expect(calls).toHaveLength(2);
  });

  it("cambios rápidos de periodo: aborta los anteriores y solo cuenta la última respuesta", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    loader.load("72", "7d");
    loader.load("72", "30d");
    expect(calls.filter((call) => call.aborted).map((call) => call.period)).toEqual(["24h", "24h", "7d", "7d"]);
    await settle(...calls.filter((call) => !call.aborted));
    expect(loader.get("72", "30d").history.status).toBe("ok");
    expect(loader.get("72", "24h")).toBeUndefined();
    expect(loader.get("72", "7d")).toBeUndefined();
  });

  it("una respuesta tardía de una carga abortada no entra en la caché", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    const [oldHistory] = calls;
    loader.load("72", "7d");
    oldHistory.resolve("tardía");
    await flush();
    expect(loader.get("72", "24h")).toBeUndefined();
    expect(loader.get("72", "7d").history.data).toBeUndefined();
  });

  it("al volver a un periodo cuya carga se canceló, lo pide de nuevo", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    loader.load("72", "7d");
    loader.load("72", "24h");
    expect(calls.filter((call) => call.period === "24h" && !call.aborted)).toHaveLength(2);
  });

  it("al cambiar de estación aborta lo pendiente y vacía la caché", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    await settle(...calls);
    loader.load("72", "7d");
    loader.load("10", "24h");
    expect(calls.filter((call) => call.period === "7d").every((call) => call.aborted)).toBe(true);
    expect(loader.get("72", "24h")).toBeUndefined();
    expect(loader.get("10", "24h")).toBeDefined();
  });

  it("caduca la caché con el intervalo de captura y refresca conservando los datos mientras llega lo nuevo", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    await settle(...calls);
    clock += HISTORY_TTL_MS;
    loader.load("72", "24h");
    expect(calls).toHaveLength(4);
    const entry = loader.get("72", "24h");
    expect(entry.history).toMatchObject({ status: "loading", data: "history:72:24h" });
    calls.slice(2).forEach((call) => call.resolve("nuevo"));
    await flush();
    expect(loader.get("72", "24h").history).toMatchObject({ status: "ok", data: "nuevo" });
  });

  it("un refresco fallido no tira los datos que ya se mostraban", async () => {
    const { loader, calls } = setup();
    loader.load("72", "24h");
    await settle(...calls);
    clock += HISTORY_TTL_MS;
    loader.load("72", "24h");
    calls.slice(2).forEach((call) => call.reject());
    await flush();
    expect(loader.get("72", "24h").history).toMatchObject({ status: "ok", data: "history:72:24h" });
  });

  it("error parcial: si falla el resumen conserva los puntos, y al revés", async () => {
    const { loader, calls } = setup();
    loader.load("72", "30d");
    calls[0].resolve("puntos");
    calls[1].reject(new Error("resumen caído"));
    await flush();
    let entry = loader.get("72", "30d");
    expect(entry.history).toMatchObject({ status: "ok", data: "puntos" });
    expect(entry.summary).toMatchObject({ status: "error" });
    expect(entry.summary.error.message).toBe("resumen caído");

    loader.load("10", "30d");
    calls[2].reject(new Error("puntos caídos"));
    calls[3].resolve("resumen");
    await flush();
    entry = loader.get("10", "30d");
    expect(entry.history.status).toBe("error");
    expect(entry.summary).toMatchObject({ status: "ok", data: "resumen" });
  });

  it("retry repite solo la parte que falló", async () => {
    const { loader, calls } = setup();
    loader.load("72", "30d");
    calls[0].resolve("puntos");
    calls[1].reject();
    await flush();
    loader.retry("72", "30d", "summary");
    expect(calls).toHaveLength(3);
    expect(calls[2].part).toBe("summary");
    expect(loader.get("72", "30d").summary.status).toBe("loading");
    calls[2].resolve("resumen bueno");
    await flush();
    const entry = loader.get("72", "30d");
    expect(entry.history.data).toBe("puntos");
    expect(entry.summary).toMatchObject({ status: "ok", data: "resumen bueno" });
  });

  it("retry sin parte repite todas las que fallaron y nada más", async () => {
    const { loader, calls } = setup();
    loader.load("72", "7d");
    calls.forEach((call) => call.reject());
    await flush();
    loader.retry("72", "7d");
    expect(calls.slice(2).map((call) => call.part)).toEqual(["history", "summary"]);
    calls.slice(2).forEach((call) => call.resolve());
    await flush();
    loader.retry("72", "7d");
    expect(calls).toHaveLength(4);
  });

  it("un error no tira la carga en vuelo de la otra parte al reintentar", async () => {
    const { loader, calls } = setup();
    loader.load("72", "7d");
    calls[0].reject();
    await flush();
    loader.retry("72", "7d", "history");
    const live = calls.filter((call) => !call.aborted);
    expect(live.map((call) => call.part).sort()).toEqual(["history", "summary"]);
    live.forEach((call) => call.resolve());
    await flush();
    expect(loader.get("72", "7d").history.status).toBe("ok");
    expect(loader.get("72", "7d").summary.status).toBe("ok");
  });

  it("marca la carga como lenta pasado el umbral y lo quita al terminar", async () => {
    vi.useFakeTimers();
    const { loader, calls, onChange } = setup();
    loader.load("72", "90d");
    vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
    expect(loader.get("72", "90d").slow).toBe(false);
    vi.advanceTimersByTime(1);
    expect(loader.get("72", "90d").slow).toBe(true);
    expect(onChange).toHaveBeenCalled();
    calls.forEach((call) => call.resolve());
    await vi.advanceTimersByTimeAsync(0);
    expect(loader.get("72", "90d").slow).toBe(false);
  });

  it("una carga rápida no llega a marcarse como lenta", async () => {
    vi.useFakeTimers();
    const { loader, calls } = setup();
    loader.load("72", "24h");
    calls.forEach((call) => call.resolve());
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(SLOW_AFTER_MS * 2);
    expect(loader.get("72", "24h").slow).toBe(false);
  });
});
