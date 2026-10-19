import { describe, expect, it } from "vitest";
import { fixtureHistory, fixtureStations } from "../src/fixtures.js";

describe("fixtures de desarrollo", () => {
  it("mantiene contadores y ocupación coherentes", () => {
    for (const station of fixtureStations) {
      expect(station.capacity).toBeGreaterThanOrEqual(station.free_docks);
      expect(station.occupancy_percent).toBeGreaterThanOrEqual(0);
      expect(station.occupancy_percent).toBeLessThanOrEqual(100);
    }
  });

  it("genera puntos históricos sin inventar intervalos fuera del rango", () => {
    const result = fixtureHistory("1", "2026-01-01T00:00:00Z", "2026-01-01T03:00:00Z", "hour");
    expect(result.points).toHaveLength(3);
    expect(result.points[0].observations).toBe(1);
  });
});
