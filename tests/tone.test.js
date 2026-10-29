import { describe, expect, it } from "vitest";
import { bikesTone } from "../src/tone.js";

const station = (mechanical, electric) => ({ bikes: { mechanical, electric } });

describe("bikesTone", () => {
  it("suma mecánicas y eléctricas", () => {
    expect(bikesTone(station(2, 2))).toBe("ok");
    expect(bikesTone(station(0, 4))).toBe("ok");
    expect(bikesTone(station(3, 0))).toBe("few");
    expect(bikesTone(station(0, 1))).toBe("few");
    expect(bikesTone(station(0, 0))).toBe("none");
  });

  it("trata un tipo ausente como cero y ambos ausentes como desconocido", () => {
    expect(bikesTone(station(null, 5))).toBe("ok");
    expect(bikesTone(station(2, undefined))).toBe("few");
    expect(bikesTone(station(null, null))).toBe("unknown");
    expect(bikesTone({})).toBe("unknown");
  });
});
