import { describe, expect, it } from "vitest";
import { isImpossibleReading, withoutImpossibleReading, withoutImpossibleReadings } from "../src/reliability.js";
import { bikesTone } from "../src/tone.js";

const station = (mechanical, electric, capacity, freeDocks = 0) => ({ station_id: "x", bikes: { mechanical, electric }, capacity, free_docks: freeDocks, occupancy_percent: 50 });
// Lectura real de la estación temporal 104 (3-nov-2026).
const zorrilla = station(396, 396, 1, 99);

describe("lecturas imposibles", () => {
  it("detecta más bicis que capacidad", () => {
    expect(isImpossibleReading(zorrilla)).toBe(true);
    expect(isImpossibleReading(station(2, 1, 2))).toBe(true);
  });

  it("no toca una estación coherente, ni llena, ni vacía, ni sin capacidad conocida", () => {
    expect(isImpossibleReading(station(10, 9, 19))).toBe(false);
    expect(isImpossibleReading(station(0, 0, 19))).toBe(false);
    expect(isImpossibleReading(station(5, 5, null))).toBe(false);
    expect(isImpossibleReading({ capacity: 19 })).toBe(false);
  });

  it("quita las cifras y marca la lectura, y la estación sale sin datos en el semáforo", () => {
    const limpia = withoutImpossibleReading(zorrilla);
    expect(limpia).toMatchObject({ bikes: { mechanical: null, electric: null }, free_docks: null, occupancy_percent: null, unreliable: true });
    expect(bikesTone(limpia)).toBe("unknown");
    const buena = station(4, 3, 19, 12);
    expect(withoutImpossibleReading(buena)).toBe(buena);
  });

  it("aplica a una respuesta de la API sin tocar el resto", () => {
    const respuesta = { status: "success", data: [zorrilla, station(4, 3, 19, 12)], meta: { pagination: null } };
    const limpia = withoutImpossibleReadings(respuesta);
    expect(limpia.meta).toBe(respuesta.meta);
    expect(limpia.data.map((item) => Boolean(item.unreliable))).toEqual([true, false]);
    expect(withoutImpossibleReadings({ data: null }).data).toBeNull();
  });
});
