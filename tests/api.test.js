import { describe, expect, it } from "vitest";
import { dateRange } from "../src/api.js";

describe("API frontend", () => {
  it("calcula periodos históricos con granularidad estable", () => {
    expect(dateRange("24h").granularity).toBe("hour");
    expect(dateRange("7d").granularity).toBe("hour");
    expect(dateRange("30d").granularity).toBe("day");
    expect(dateRange("90d").granularity).toBe("day");
  });
});
