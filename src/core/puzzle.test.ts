import { describe, it, expect } from "vitest";
import type { Puzzle } from "./puzzle";
import { idx, rowOf, colOf, isPondConnected, allPondsContiguous } from "./puzzle";

/** A puzzle where each column is its own pond: every cell assigned, N ponds, all connected. */
function columnPuzzle(size: number): Puzzle {
  const ponds = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      ponds[idx(r, c, size)] = c;
    }
  }
  return { size, ponds };
}

describe("index helpers", () => {
  it("rowOf and colOf round-trip through idx", () => {
    const size = 7;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const i = idx(r, c, size);
        expect(rowOf(i, size)).toBe(r);
        expect(colOf(i, size)).toBe(c);
      }
    }
  });
});

describe("puzzle structure", () => {
  it("assigns every cell to exactly one of N ponds", () => {
    const size = 6;
    const p = columnPuzzle(size);
    expect(p.ponds.length).toBe(size * size);
    const seen = new Uint8Array(size);
    for (let i = 0; i < p.ponds.length; i++) {
      const id = p.ponds[i];
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(size);
      seen[id] = 1;
    }
    let distinct = 0;
    for (let i = 0; i < size; i++) distinct += seen[i];
    expect(distinct).toBe(size);
  });
});

describe("pond contiguity", () => {
  it("reports a column layout as fully connected", () => {
    const p = columnPuzzle(7);
    for (let id = 0; id < p.size; id++) {
      expect(isPondConnected(p.ponds, p.size, id)).toBe(true);
    }
    expect(allPondsContiguous(p)).toBe(true);
  });

  it("reports an L-shaped pond as connected", () => {
    const size = 5;
    // (0,0),(1,0),(1,1) form an L, each step orthogonally adjacent.
    const ponds = new Array<number>(size * size).fill(0);
    ponds[idx(0, 0, size)] = 1;
    ponds[idx(1, 0, size)] = 1;
    ponds[idx(1, 1, size)] = 1;
    expect(isPondConnected(ponds, size, 1)).toBe(true);
  });

  it("reports a single cell as trivially connected", () => {
    const size = 8;
    const ponds = new Array<number>(size * size).fill(0);
    ponds[idx(3, 3, size)] = 2;
    expect(isPondConnected(ponds, size, 2)).toBe(true);
  });

  it("reports two far-apart cells in the same pond as not connected", () => {
    const size = 5;
    // Pond 1 has cells at (0,0) and (0,4): never orthogonally adjacent.
    const ponds = new Array<number>(size * size).fill(0);
    ponds[idx(0, 0, size)] = 1;
    ponds[idx(0, 4, size)] = 1;
    expect(isPondConnected(ponds, size, 1)).toBe(false);
    expect(allPondsContiguous({ size, ponds })).toBe(false);
  });

  it("reports a connected pond as not connected once a straggler cell is added", () => {
    const size = 5;
    // (0,0),(1,0),(2,0) connected vertically, plus an isolated cell at (4,4).
    const ponds = new Array<number>(size * size).fill(0);
    ponds[idx(0, 0, size)] = 1;
    ponds[idx(1, 0, size)] = 1;
    ponds[idx(2, 0, size)] = 1;
    ponds[idx(4, 4, size)] = 1;
    expect(isPondConnected(ponds, size, 1)).toBe(false);
  });
});
