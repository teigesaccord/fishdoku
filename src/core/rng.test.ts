import { describe, it, expect } from "vitest";
import { cyrb128, Rng } from "./rng";

const SEED = "fishdoku:v1:2026-11-16";

describe("cyrb128", () => {
  it("hashes a string to four unsigned 32-bit words", () => {
    expect(cyrb128(SEED)).toEqual([
      1243448990,
      1784427194,
      799767017,
      1214769033,
    ]);
  });

  it("produces only unsigned values in [0, 2^32)", () => {
    const [a, b, c, d] = cyrb128("any input at all");
    for (const w of [a, b, c, d]) {
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(4294967296);
    }
  });
});

describe("Rng", () => {
  it("is deterministic for a fixed seed string (cross-run stable)", () => {
    const first = () => {
      const r = Rng.fromString(SEED);
      return Array.from({ length: 8 }, () => r.nextInt(11));
    };
    expect(first()).toEqual([3, 3, 10, 0, 5, 10, 4, 8]);
    expect(first()).toEqual([3, 3, 10, 0, 5, 10, 4, 8]);
  });

  it("pins the first six nextInt(11) outputs for the launch seed", () => {
    const r = Rng.fromString(SEED);
    expect([
      r.nextInt(11),
      r.nextInt(11),
      r.nextInt(11),
      r.nextInt(11),
      r.nextInt(11),
      r.nextInt(11),
    ]).toEqual([3, 3, 10, 0, 5, 10]);
  });

  it("returns integers in [0, n) for any size", () => {
    const r = Rng.fromString("size-coverage-seed");
    for (const n of [7, 8, 9, 10, 11]) {
      const out = Array.from({ length: 20 }, () => r.nextInt(n));
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
      }
    }
  });

  it("pins a Fisher-Yates shuffle of [0..8]", () => {
    const r = Rng.fromString("pond-seed-test");
    expect(r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual([
      5, 4, 1, 0, 3, 8, 6, 2, 7,
    ]);
  });

  it("shuffle returns a permutation (no lost or duplicated elements)", () => {
    const r = Rng.fromString("permutation-check-seed");
    const input = [10, 20, 30, 40, 50];
    const out = r.shuffle([...input]);
    expect(out.slice().sort((x, y) => x - y)).toEqual(input);
  });

  it("rejects non-positive or non-finite bounds", () => {
    const r = Rng.fromString("bounds-seed");
    expect(() => r.nextInt(0)).toThrow(RangeError);
    expect(() => r.nextInt(-3)).toThrow(RangeError);
    expect(() => r.nextInt(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
