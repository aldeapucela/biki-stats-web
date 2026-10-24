import { describe, expect, it } from "vitest";
import { collectPages, dateRange } from "../src/api.js";

describe("API frontend", () => {
  it("calcula periodos históricos con granularidad estable", () => {
    expect(dateRange("24h").granularity).toBe("hour");
    expect(dateRange("7d").granularity).toBe("hour");
    expect(dateRange("30d").granularity).toBe("day");
    expect(dateRange("90d").granularity).toBe("day");
  });
});

describe("paginación de estaciones", () => {
  const page = (items, hasMore) => ({ data: items, meta: { pagination: { has_more: hasMore } } });

  it("recorre todas las páginas hasta que has_more es falso", async () => {
    const offsets = [];
    const pages = [page(Array(100).fill("a"), true), page(Array(4).fill("b"), false)];
    const result = await collectPages(async (offset) => { offsets.push(offset); return pages[offsets.length - 1]; });
    expect(result.data).toHaveLength(104);
    expect(offsets).toEqual([0, 100]);
  });

  it("no se queda en bucle si la API anuncia más páginas pero devuelve vacío", async () => {
    let calls = 0;
    const result = await collectPages(async () => { calls += 1; return page([], true); });
    expect(result.data).toHaveLength(0);
    expect(calls).toBe(1);
  });
});
