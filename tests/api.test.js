import { describe, expect, it } from "vitest";
import { CAPTURE_INTERVAL_MS, dateRange } from "../src/api.js";

describe("API frontend", () => {
  it("calcula periodos históricos con granularidad estable", () => {
    expect(dateRange("24h").granularity).toBe("hour");
    expect(dateRange("7d").granularity).toBe("hour");
    expect(dateRange("30d").granularity).toBe("day");
    expect(dateRange("90d").granularity).toBe("day");
  });

  it("redondea `to` hacia arriba al intervalo de captura para que las consultas repetidas compartan URL", () => {
    const a = dateRange("30d", new Date("2026-10-25T09:29:25Z"));
    const b = dateRange("30d", new Date("2026-10-25T09:29:26Z"));
    expect(a).toEqual(b);
    expect(a.to).toBe("2026-10-25T09:30:00.000Z");
    expect(new Date(a.to) - new Date(a.from)).toBe(30 * 24 * 3600_000);
    expect(dateRange("24h", new Date("2026-10-25T09:30:00Z")).to).toBe("2026-10-25T09:30:00.000Z");
    expect(dateRange("24h", new Date("2026-10-25T09:30:01Z")).to).toBe(new Date(Date.parse("2026-10-25T09:30:00Z") + CAPTURE_INTERVAL_MS).toISOString());
  });
});
