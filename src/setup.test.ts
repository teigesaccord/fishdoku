import { describe, it, expect } from "vitest";
import { Rng } from "./core/rng";

describe("placeholder", () => {
  it("computes", () => {
    expect(1 + 1).toBe(2);
  });

  it("Rng is deterministic for a fixed seed string", () => {
    const a = Rng.fromString("fishdoku:v1:2026-11-16");
    const b = Rng.fromString("fishdoku:v1:2026-11-16");
    expect(a.nextInt(11)).toBe(b.nextInt(11));
  });
});
