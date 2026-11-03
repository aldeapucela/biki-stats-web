import { describe, expect, it } from "vitest";
import { bestAndWorstHour, heatmapRows, hourlyAverages, madridParts, stationSlots, totalBikes } from "../src/history-stats.js";

const point = (timestamp, mechanical, electric = 0, free_docks = 0) => ({ timestamp, mechanical, electric, free_docks });

describe("madridParts", () => {
  it("usa la hora de Madrid en invierno (UTC+1) y pasa al día siguiente", () => {
    expect(madridParts("2026-10-29T22:30:00Z")).toMatchObject({ hour: 23, day: 29, weekday: 3 });
    expect(madridParts("2026-10-29T23:30:00Z")).toMatchObject({ hour: 0, day: 30, weekday: 4 });
  });

  it("usa la hora de Madrid en verano (UTC+2)", () => {
    expect(madridParts("2026-07-15T22:30:00Z")).toMatchObject({ hour: 0, day: 16, weekday: 3 });
  });
});

describe("hourlyAverages", () => {
  it("promedia por hora de Madrid y deja null las horas sin lecturas", () => {
    const points = [point("2026-10-29T09:00:00Z", 4, 2), point("2026-10-30T09:00:00Z", 2, 0), point("2026-10-29T10:00:00Z", 10)];
    const averages = hourlyAverages(points, totalBikes);
    expect(averages).toHaveLength(24);
    expect(averages[10]).toBe(4);
    expect(averages[11]).toBe(10);
    expect(averages[3]).toBeNull();
  });
});

describe("bestAndWorstHour", () => {
  it("devuelve la hora más alta y la más baja ignorando las horas sin datos", () => {
    const averages = Array(24).fill(null);
    averages[7] = 3;
    averages[13] = 12;
    averages[20] = 1.5;
    expect(bestAndWorstHour(averages)).toEqual({ best: { hour: 13, value: 12 }, worst: { hour: 20, value: 1.5 } });
  });

  it("en un empate gana la hora más temprana y sin datos devuelve null", () => {
    const averages = Array(24).fill(null);
    averages[5] = 4;
    averages[9] = 4;
    expect(bestAndWorstHour(averages)).toEqual({ best: { hour: 5, value: 4 }, worst: { hour: 5, value: 4 } });
    expect(bestAndWorstHour(Array(24).fill(null))).toBeNull();
  });
});

describe("heatmapRows", () => {
  const points = [
    point("2026-10-26T08:00:00Z", 2, 1), // lun 26, 09:00
    point("2026-10-26T09:00:00Z", 6, 0), // lun 26, 10:00
    point("2026-10-27T08:00:00Z", 0, 0), // mar 27, 09:00 (cero real)
    point("2026-11-02T08:00:00Z", 5, 1), // lun 2 nov, 09:00
  ];

  it("a 7 días da una fila por día natural, ordenada, y null donde no hay lectura", () => {
    const { rows, max } = heatmapRows(points, "7d");
    expect(rows.map((row) => row.label)).toEqual(["lun 26", "mar 27", "lun 2"]);
    expect(rows[0].cells[9]).toBe(3);
    expect(rows[0].cells[10]).toBe(6);
    expect(rows[0].cells[11]).toBeNull();
    expect(rows[1].cells[9]).toBe(0);
    expect(max).toBe(6);
  });

  it("a 30 días agrupa por día de la semana con la media de todas sus semanas", () => {
    const { rows } = heatmapRows(points, "30d");
    expect(rows.map((row) => row.label)).toEqual(["lun", "mar"]);
    expect(rows[0].cells[9]).toBe(4.5); // (3 + 6) / 2
  });
});

describe("stationSlots", () => {
  it("cuenta bicis y huecos de la última lectura", () => {
    expect(stationSlots(point("2026-10-30T10:00:00Z", 15, 6, 9))).toEqual({ mechanical: 15, electric: 6, free: 9, total: 30 });
    expect(stationSlots(undefined)).toEqual({ mechanical: 0, electric: 0, free: 0, total: 0 });
  });
});
