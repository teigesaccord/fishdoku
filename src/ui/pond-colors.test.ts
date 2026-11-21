import { describe, it, expect } from "vitest";
import type { Puzzle } from "../core/puzzle";
import { idx } from "../core/puzzle";
import { generate } from "../core/generator";
import { assignPondStyles, POND_COLORS, TEXTURES } from "./pond-colors";

/** Build a puzzle of the given size for a fixed seed. */
function puzzle(size: number, seed: string): Puzzle {
  return generate("v1", `seed:${seed}`, size);
}

/** Indices (as [row,col]) of every cell that borders a different pond. */
function adjacentPondPairs(ponds: number[], size: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(r, c, size);
      if (c + 1 < size) {
        const q = ponds[idx(r, c + 1, size)];
        if (q !== ponds[i]) pairs.push([ponds[i], q]);
      }
      if (r + 1 < size) {
        const q = ponds[idx(r + 1, c, size)];
        if (q !== ponds[i]) pairs.push([ponds[i], q]);
      }
    }
  }
  return pairs;
}

describe("pond-colors: greedy adjacency coloring", () => {
  it("gives a distinct texture to every pair of adjacent ponds", () => {
    for (const size of [4, 5, 7, 9, 11]) {
      for (let s = 0; s < 60; s++) {
        const p = puzzle(size, `adj-texture-${s}`);
        const styles = assignPondStyles(p);
        const seen = new Set<string>();
        for (const [a, b] of adjacentPondPairs(p.ponds, size)) {
          expect(styles.textures[a]).not.toBe(styles.textures[b]);
          seen.add(`${a}:${styles.textures[a]}|${b}:${styles.textures[b]}`);
        }
        // Sanity: at least one adjacency exists for a multi-pond grid.
        expect(seen.size).toBeGreaterThan(0);
      }
    }
  });

  it("gives a distinct color to every pair of adjacent ponds", () => {
    for (const size of [5, 7, 9, 11]) {
      for (let s = 0; s < 60; s++) {
        const p = puzzle(size, `adj-color-${s}`);
        const styles = assignPondStyles(p);
        for (const [a, b] of adjacentPondPairs(p.ponds, size)) {
          expect(styles.colors[a]).not.toBe(styles.colors[b]);
        }
      }
    }
  });

  it("gives every pond a unique texture and color (there are as many as ponds)", () => {
    for (const size of [7, 9, 11]) {
      for (let s = 0; s < 20; s++) {
        const p = puzzle(size, `unique-${s}`);
        const styles = assignPondStyles(p);
        const n = Math.max(...p.ponds) + 1;
        expect(n).toBe(size);
        expect(new Set(styles.textures.slice(0, n)).size).toBe(n);
        expect(new Set(styles.colors.slice(0, n)).size).toBe(n);
      }
    }
  });

  it("stays within the declared palette and lists every pond id", () => {
    for (const size of [4, 7, 11]) {
      const p = puzzle(size, "bounds");
      const styles = assignPondStyles(p);
      expect(styles.textures.length).toBeGreaterThanOrEqual(Math.max(...p.ponds) + 1);
      for (const t of styles.textures) expect(TEXTURES.includes(t)).toBe(true);
      for (const c of styles.colors) expect(POND_COLORS.includes(c)).toBe(true);
    }
  });

  it("is deterministic: the same puzzle always yields identical styles", () => {
    const p = puzzle(7, "stable");
    const a = assignPondStyles(p);
    const b = assignPondStyles(p);
    expect(a).toEqual(b);
  });
});
