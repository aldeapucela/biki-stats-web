import { describe, expect, it } from "vitest";
import { bikesTone } from "../src/tone.js";

const station = (mechanical, electric) => ({ bikes: { mechanical, electric } });

describe("bikesTone", () => {
  it("rojo si no hay ninguna bici", () => {
    expect(bikesTone(station(0, 0))).toBe("none");
  });

  it("naranja si falta un tipo, aunque del otro haya muchas", () => {
    expect(bikesTone(station(0, 1))).toBe("partial");
    expect(bikesTone(station(3, 0))).toBe("partial");
    expect(bikesTone(station(0, 8))).toBe("partial");
  });

  it("verde con de las dos, más oscuro según el tipo con menos bicis", () => {
    expect(bikesTone(station(1, 1))).toBe("ok-low");
    expect(bikesTone(station(9, 1))).toBe("ok-low");
    expect(bikesTone(station(2, 7))).toBe("ok-mid");
    expect(bikesTone(station(3, 3))).toBe("ok-mid");
    expect(bikesTone(station(4, 4))).toBe("ok-high");
    expect(bikesTone(station(11, 5))).toBe("ok-high");
  });

  it("trata un tipo ausente como cero y ambos ausentes como desconocido", () => {
    expect(bikesTone(station(null, 5))).toBe("partial");
    expect(bikesTone(station(2, undefined))).toBe("partial");
    expect(bikesTone(station(null, null))).toBe("unknown");
    expect(bikesTone({})).toBe("unknown");
  });
});
