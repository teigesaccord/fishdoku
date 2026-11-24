import { describe, it, expect } from "vitest";
import { isPondConnected } from "../puzzle";
import { countSolutions } from "../solver";
import { generateDeep, generateDeepV1, tankLayers } from "./generator";
import { countDeepSolutions } from "./solver";
import { LAYERS } from "./puzzle";

const N = 8;
const SEEDS = Array.from({ length: 60 }, (_, i) => `fishdoku:deep-v1:test-${i}`);

describe("deep-v1 generator: output", () => {
  it("produces well-formed tanks: two layers, N contiguous ponds each", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const tank = generateDeepV1(seed, N);
      expect(tank.size).toBe(N);
      expect(tank.ponds.length).toBe(LAYERS * N * N);
      tankLayers(tank).forEach((layer, L) => {
        // Global ids of layer L are L*N..L*N+N-1, so local ids are 0..N-1.
        const ids = new Set(layer.ponds);
        expect(ids.size).toBe(N);
        for (const id of ids) {
          expect(id).toBeGreaterThanOrEqual(0);
          expect(id).toBeLessThan(N);
          expect(isPondConnected(layer.ponds, N, id), `layer ${L} pond ${id}`).toBe(true);
        }
      });
    }
  });

  it("has exactly one tank solution, and every layer is ambiguous alone", () => {
    for (const seed of SEEDS) {
      const tank = generateDeepV1(seed, N);
      expect(countDeepSolutions(tank, 2), seed).toBe(1);
      for (const layer of tankLayers(tank)) {
        expect(countSolutions(layer, 2), seed).toBe(2);
      }
    }
  });

  it("tags output with its version and rejects unknown versions", () => {
    expect(generateDeep("deep-v1", SEEDS[0], N).version).toBe("deep-v1");
    expect(() => generateDeep("deep-v0", SEEDS[0], N)).toThrow();
  });
});

describe("deep-v1 generator: determinism", () => {
  it("returns the same tank for the same seed", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(generateDeepV1(seed, N).ponds).toEqual(generateDeepV1(seed, N).ponds);
    }
  });

  // Literal deep-v1 layouts, one base-36 digit (global pond id) per cell,
  // layer-major. These pin daily tanks: if this fails, a change has altered
  // Deep Water puzzles players may already have seen.
  const PINNED: ReadonlyArray<readonly [string, string]> = [
    ["2026-12-01", "000001110000111200031122003331120033412266334552667345526677752288888888899888889999a888b99aaa8cb9daaa8cbbddaaaafddddeeeffdddeee"],
    ["2026-12-25", "0000011100001122000011223300111433011444355554446655444455555774999aaa889999aa88999aaaa8999abbb89cccbbbb9ccccbdbfcceeebbfccceeeb"],
    ["2027-03-14", "1111000011110030112200304452333045523333445533334455366644477666aa888889a8888999a88bb9ccabbbbcccabbbbbbceedddccceeddcccceeeccfff"],
  ];

  it("matches the pinned literal layouts", () => {
    for (const [date, expected] of PINNED) {
      const actual = generateDeepV1(`fishdoku:deep-v1:${date}`, N)
        .ponds.map((p) => p.toString(36))
        .join("");
      expect(actual, `deep-v1 tank for ${date}`).toBe(expected);
    }
  });

  it("returns different tanks for different seeds", () => {
    expect(generateDeepV1(SEEDS[0], N).ponds).not.toEqual(generateDeepV1(SEEDS[1], N).ponds);
  });
});
