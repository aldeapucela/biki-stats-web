import { describe, expect, it } from "vitest";
import TABLE from "../src/availability-table.json";
import { ALTERNATIVE_MIN, MIN_READINGS, alternatives, bandOf, countFor, dayType, horizonFor, levelOf, madridParts, outlook, planRoute, walkMinutes } from "../src/availability.js";

const at = (iso) => new Date(iso);

// Tabla pequeña con celdas conocidas: índice = ((tipo de día * 6 + franja) * 4 + estado ahora).
const cells = () => Array.from({ length: 72 }, () => [null, 0]);
const index = (day, band, state) => (day * 6 + band) * 4 + state;
const fake = () => {
  const bike = Object.fromEntries([10, 20, 30, 45].map((h) => [String(h), cells()]));
  const dock = Object.fromEntries([10, 20, 30, 45].map((h) => [String(h), cells()]));
  bike["20"][index(0, 4, 1)] = [0.62, 450];   // laborable, 17-21 h, 1 bici ahora
  bike["20"][index(0, 4, 3)] = [0.995, 9000];
  dock["20"][index(0, 4, 0)] = [0.35, 299];   // una lectura menos del mínimo
  dock["20"][index(0, 4, 2)] = [0.83, 300];   // justo el mínimo
  return { horizons: [10, 20, 30, 45], band_starts: [0, 7, 10, 14, 17, 21], states: 4, fixed_holidays: [[12, 8]], table: { bike, dock } };
};

describe("hora de Madrid", () => {
  it("usa la hora y el día de Madrid, no los del navegador ni los UTC", () => {
    // 22:30 UTC del viernes 30-oct es 23:30 en Madrid (UTC+1); una hora después ya es sábado allí.
    expect(madridParts(at("2026-10-30T22:30:00Z"))).toMatchObject({ weekday: 4, hour: 23 });
    expect(dayType(at("2026-10-30T22:30:00Z"))).toBe(0);
    expect(madridParts(at("2026-10-30T23:30:00Z"))).toMatchObject({ weekday: 5, hour: 0 });
    expect(dayType(at("2026-10-30T23:30:00Z"))).toBe(1);
  });

  it("distingue laborable, sábado, domingo y festivo nacional de fecha fija", () => {
    expect(dayType(at("2026-10-27T10:00:00Z"))).toBe(0); // martes
    expect(dayType(at("2026-10-31T10:00:00Z"))).toBe(1); // sábado
    expect(dayType(at("2026-11-01T10:00:00Z"))).toBe(2); // domingo
    expect(dayType(at("2026-10-12T10:00:00Z"))).toBe(2); // lunes festivo
    expect(dayType(at("2026-12-08T10:00:00Z"))).toBe(2); // martes festivo
    expect(dayType(at("2026-12-09T10:00:00Z"))).toBe(0);
  });

  it("calcula la franja por hora local, también en verano", () => {
    expect(bandOf(at("2026-10-27T05:59:00Z"))).toBe(0); // 06:59
    expect(bandOf(at("2026-10-27T06:00:00Z"))).toBe(1); // 07:00
    expect(bandOf(at("2026-10-27T19:59:00Z"))).toBe(4); // 20:59
    expect(bandOf(at("2026-10-27T20:00:00Z"))).toBe(5); // 21:00
    expect(bandOf(at("2026-07-15T21:30:00Z"))).toBe(5); // 23:30 con UTC+2
    expect(bandOf(at("2026-07-15T22:30:00Z"))).toBe(0); // 00:30 del día siguiente
  });
});

describe("horizonFor y levelOf", () => {
  it("usa el primer horizonte que cubre el tiempo y no estima más allá del último", () => {
    expect([horizonFor(0), horizonFor(-3), horizonFor(1), horizonFor(10), horizonFor(11), horizonFor(45), horizonFor(46)]).toEqual([null, null, 10, 10, 20, 45, null]);
  });

  it("reparte la frecuencia en cuatro tramos con los bordes en 0,9, 0,7 y 0,4", () => {
    expect([1, 0.9, 0.899, 0.7, 0.699, 0.4, 0.399, 0].map(levelOf)).toEqual(["sure", "sure", "likely", "likely", "doubtful", "doubtful", "unlikely", "unlikely"]);
  });
});

describe("countFor", () => {
  it("suma mecánicas y eléctricas, devuelve los huecos y distingue el dato ausente del cero", () => {
    expect(countFor("bike", { bikes: { mechanical: 3, electric: 2 } })).toBe(5);
    expect(countFor("bike", { bikes: { mechanical: 0, electric: 0 } })).toBe(0);
    expect(countFor("bike", { bikes: {} })).toBeNull();
    expect(countFor("bike", {})).toBeNull();
    expect(countFor("dock", { free_docks: 0 })).toBe(0);
    expect(countFor("dock", {})).toBeNull();
  });
});

describe("outlook", () => {
  const table = fake();
  const now = at("2026-10-27T16:00:00Z"); // martes 17:00 en Madrid; a +18 min sigue en la franja 17-21 h

  it("devuelve la frecuencia de la celda de la hora de llegada y el estado de ahora", () => {
    const result = outlook("bike", 1, 18, { now, table });
    expect(result).toMatchObject({ ok: true, p: 0.62, n: 450, horizon: 20, level: "doubtful" });
    expect(result.arrival.toISOString()).toBe("2026-10-27T16:18:00.000Z");
  });

  it("agrupa 3 o más en el último estado", () => {
    expect(outlook("bike", 3, 18, { now, table })).toMatchObject({ ok: true, p: 0.995 });
    expect(outlook("bike", 12, 18, { now, table })).toMatchObject({ ok: true, p: 0.995 });
  });

  it("no da cifra con menos del mínimo de lecturas y sí con el mínimo exacto", () => {
    expect(MIN_READINGS).toBe(300);
    expect(outlook("dock", 0, 18, { now, table })).toMatchObject({ ok: false, reason: "few" });
    expect(outlook("dock", 2, 18, { now, table })).toMatchObject({ ok: true, p: 0.83, n: 300 });
  });

  it("explica por qué no estima: sin dato, llegada inmediata, demasiado lejos o celda vacía", () => {
    expect(outlook("bike", null, 18, { now, table }).reason).toBe("unknown");
    expect(outlook("bike", 1, 0, { now, table }).reason).toBe("now");
    expect(outlook("bike", 1, 50, { now, table }).reason).toBe("far");
    expect(outlook("bike", 0, 18, { now, table }).reason).toBe("few");
  });

  it("usa la hora de llegada para elegir tipo de día y franja, no la de ahora", () => {
    // Sale a las 20:50 y llega a las 21:08: ya es la franja 21-24 h, que en esta tabla no tiene datos.
    const late = at("2026-10-27T19:50:00Z");
    expect(outlook("bike", 1, 18, { now: late, table }).reason).toBe("few");
  });
});

describe("tabla generada", () => {
  it("tiene las 72 celdas por horizonte y señal, con la frecuencia entre 0 y 1 y sin cifra donde no hay lecturas", () => {
    expect(TABLE.horizons).toEqual([10, 20, 30, 45]);
    for (const kind of ["bike", "dock"]) {
      for (const horizon of TABLE.horizons) {
        const rows = TABLE.table[kind][String(horizon)];
        expect(rows).toHaveLength(72);
        for (const [p, n] of rows) {
          expect(Number.isInteger(n) && n >= 0).toBe(true);
          if (n === 0) expect(p).toBeNull();
          else expect(p >= 0 && p <= 1).toBe(true);
        }
      }
    }
  });

  it("justifica ALTERNATIVE_MIN: con 3 o más ahora, toda celda con lecturas suficientes tiene frecuencia de 0,99 o más", () => {
    expect(ALTERNATIVE_MIN).toBe(3);
    for (const kind of ["bike", "dock"]) {
      for (const horizon of TABLE.horizons) {
        TABLE.table[kind][String(horizon)].forEach(([p, n], i) => { if (i % 4 === 3 && n >= MIN_READINGS) expect(p).toBeGreaterThanOrEqual(0.99); });
      }
    }
  });

  it("registra de dónde sale: ventana, estaciones usadas y excluidas", () => {
    expect(TABLE.window.from < TABLE.window.to).toBe(true);
    expect(TABLE.stations).toBeGreaterThan(50);
    expect(Array.isArray(TABLE.excluded_stations)).toBe(true);
  });
});

describe("walkMinutes y planRoute", () => {
  const station = (latitude, longitude, extra = {}) => ({ station_id: "x", location: { latitude, longitude }, ...extra });
  const user = { latitude: 41.65, longitude: -4.72 };
  const origin = station(41.659, -4.72); // ~1000 m al norte del usuario
  const destination = station(41.668, -4.72); // ~1000 m más al norte

  it("andando son 5 km/h con factor de rodeo 1,3 y nunca menos de 1 min", () => {
    expect(walkMinutes(1000)).toBe(16); // 1,3 km a 5 km/h = 15,6 min
    expect(walkMinutes(10)).toBe(1);
  });

  it("con origen, destino y ubicación: andar hasta coger, pedalear hasta dejar y sumar", () => {
    const route = planRoute({ user, origin, destination });
    expect(route.walk).toBe(16);
    expect(route.ride).toBe(6);
    expect(route.pickup).toBe(16);
    expect(route.drop).toBe(22);
  });

  it("sin ubicación se supone que se sale ya de la estación de origen", () => {
    expect(planRoute({ user: null, origin, destination })).toEqual({ walk: null, ride: 6, pickup: 0, drop: 6 });
  });

  it("sin origen se pedalea desde la ubicación, como en la tarjeta de destino", () => {
    // 0,018° de latitud son ~2002 m: 2,6 km a 15 km/h = 10,4 min.
    expect(planRoute({ user, origin: null, destination })).toEqual({ walk: null, ride: 11, pickup: null, drop: 11 });
  });

  it("sin destino no hay tiempo de llegada, y sin ubicación ni origen tampoco", () => {
    expect(planRoute({ user, origin, destination: null }).drop).toBeNull();
    expect(planRoute({ user: null, origin: null, destination }).drop).toBeNull();
  });
});

describe("alternatives", () => {
  const near = { latitude: 41.65, longitude: -4.72 };
  const make = (id, dLat, extra = {}) => ({ station_id: id, name: id, location: { latitude: 41.65 + dLat, longitude: -4.72 }, bikes: { mechanical: 2, electric: 2 }, free_docks: 5, ...extra });

  it("ordena por cercanía y se queda con las que tienen 3 o más ahora", () => {
    const stations = [make("lejos", 0.01), make("cerca", 0.002), make("vacia", 0.001, { bikes: { mechanical: 1, electric: 1 } }), make("media", 0.005)];
    expect(alternatives(stations, "bike", near, null).map((item) => item.station.station_id)).toEqual(["cerca", "media"]);
    expect(alternatives(stations, "bike", near, null, 3).map((item) => item.station.station_id)).toEqual(["cerca", "media", "lejos"]);
  });

  it("excluye la estación pedida, las obsoletas y las que no tienen ubicación", () => {
    const stations = [make("a", 0.001), make("b", 0.002, { is_stale: true }), make("c", 0.003, { location: {} }), make("d", 0.004)];
    expect(alternatives(stations, "bike", near, "a").map((item) => item.station.station_id)).toEqual(["d"]);
  });

  it("para dejar mira los huecos, no las bicis", () => {
    const stations = [make("sin-huecos", 0.001, { free_docks: 2 }), make("con-huecos", 0.004, { free_docks: 3 })];
    expect(alternatives(stations, "dock", near, null).map((item) => item.station.station_id)).toEqual(["con-huecos"]);
  });

  it("sin punto de partida no sugiere nada", () => {
    expect(alternatives([make("a", 0.001)], "bike", null, null)).toEqual([]);
  });
});
