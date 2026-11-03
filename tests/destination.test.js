import { describe, expect, it } from "vitest";
import { DROP_ALERT_DOCKS, DROP_WINDOW_MS, distanceMeters, docksDrop, estimateMinutes, recordSample } from "../src/destination.js";

const MIN = 60_000;

describe("distanceMeters", () => {
  it("0,01 grados de latitud son unos 1112 m y la distancia es simétrica", () => {
    const a = { latitude: 41.65, longitude: -4.72 };
    const b = { latitude: 41.66, longitude: -4.72 };
    expect(distanceMeters(a, b)).toBeCloseTo(1112, -1);
    expect(distanceMeters(b, a)).toBeCloseTo(distanceMeters(a, b), 6);
    expect(distanceMeters(a, a)).toBe(0);
  });
});

describe("estimateMinutes", () => {
  it("aplica el factor de rodeo a la línea recta y redondea hacia arriba", () => {
    expect(estimateMinutes(1000)).toBe(6); // 1,3 km a 15 km/h = 5,2 min
    expect(estimateMinutes(3000)).toBe(16); // 3,9 km = 15,6 min
  });

  it("nunca baja de 1 minuto", () => {
    expect(estimateMinutes(0)).toBe(1);
    expect(estimateMinutes(20)).toBe(1);
  });
});

describe("recordSample y docksDrop", () => {
  const record = (list) => list.reduce((samples, [minute, free]) => recordSample(samples, minute * MIN, free), []);

  it("descarta las lecturas fuera de la ventana", () => {
    const samples = record([[0, 8], [10, 7], [20, 6]]);
    expect(samples.map((sample) => sample.freeDocks)).toEqual([7, 6]);
    expect(DROP_WINDOW_MS).toBe(15 * MIN);
  });

  it("ignora una lectura sin dato de huecos", () => {
    expect(recordSample([], 0, null)).toEqual([]);
  });

  it("avisa cuando los huecos bajan el umbral dentro de la ventana", () => {
    const samples = record([[0, 8], [5, 6], [10, 5]]);
    expect(docksDrop(samples)).toEqual({ from: 8, to: 5, minutes: 10 });
  });

  it("no avisa con una bajada menor que el umbral, sin cambio o con subida", () => {
    expect(DROP_ALERT_DOCKS).toBe(3);
    expect(docksDrop(record([[0, 8], [10, 6]]))).toBeNull();
    expect(docksDrop(record([[0, 8], [10, 8]]))).toBeNull();
    expect(docksDrop(record([[0, 4], [10, 9]]))).toBeNull();
  });

  it("no avisa con una sola lectura", () => {
    expect(docksDrop(record([[0, 8]]))).toBeNull();
  });
});
