import { describe, it, expect } from "vitest";
import type { Puzzle } from "./puzzle";
import { idx } from "./puzzle";
import { countSolutions } from "./solver";

const BIG = 1_000_000; // enough to read exact counts for small boards

/** Pond layout where each row is its own pond (N connected horizontal strips). */
function rowPonds(size: number): Puzzle {
  const ponds = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      ponds[idx(r, c, size)] = r;
    }
  }
  return { size, ponds };
}

/** Pond layout where each column is its own pond. Symmetric to `rowPonds`. */
function colPonds(size: number): Puzzle {
  const ponds = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      ponds[idx(r, c, size)] = c;
    }
  }
  return { size, ponds };
}

/**
 * Independent reference counter: plain recursive backtracking with no
 * bitmasking or pruning beyond the raw rules. Used to cross-check `countSolutions`
 * on many random boards rather than trusting one implementation alone.
 */
function bruteCount(puzzle: Puzzle): number {
  const size = puzzle.size;
  const ponds = puzzle.ponds;
  let n = 0;
  const colUsed = new Array<boolean>(size).fill(false);
  const pondUsed = new Map<number, boolean>();
  const rowCol = new Int32Array(size).fill(-1);

  function bt(row: number): void {
    if (row === size) {
      n++;
      return;
    }
    const prev = row > 0 ? rowCol[row - 1] : -1;
    for (let c = 0; c < size; c++) {
      if (colUsed[c]) continue;
      if (pondUsed.get(ponds[row * size + c])) continue;
      if (prev >= 0 && Math.abs(c - prev) <= 1) continue;
      colUsed[c] = true;
      pondUsed.set(ponds[row * size + c], true);
      rowCol[row] = c;
      bt(row + 1);
      rowCol[row] = -1;
      pondUsed.delete(ponds[row * size + c]);
      colUsed[c] = false;
    }
  }

  bt(0);
  return n;
}

describe("countSolutions correctness", () => {
  it("agrees with a brute-force reference across random small boards", () => {
    const rngSeed = 0x51_8F_3A_C7; // fixed so the sweep is reproducible
    let state = rngSeed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    };
    for (let iter = 0; iter < 400; iter++) {
      const size = 1 + (next() % 8); // sizes 1..8
      const asRowPonds = (next() & 1) === 0;
      const puzzle = asRowPonds ? rowPonds(size) : colPonds(size);
      expect(countSolutions(puzzle, BIG)).toBe(bruteCount(puzzle));
    }
  });

  it("caps at the requested limit", () => {
    // rowPonds(5) has 14 valid placements; a limit of 2 must return exactly 2.
    expect(countSolutions(rowPonds(5), BIG)).toBe(14);
    expect(countSolutions(rowPonds(5), 2)).toBe(2);
  });

  it("handles an empty board as one trivial solution", () => {
    expect(countSolutions({ size: 0, ponds: [] }, BIG)).toBe(1);
  });
});

describe("countSolutions hand-made cases (0 / 1 / 2+)", () => {
  it("finds zero solutions when constraints are unsatisfiable", () => {
    // N=3 row-ponds: every permutation of {0,1,2} puts two consecutive rows in
    // adjacent columns, so |dr - dc| <= 1 always binds. No valid placement.
    expect(countSolutions(rowPonds(3), BIG)).toBe(0);
  });

  it("finds exactly one solution when a pond removes the only alternative", () => {
    const size = 4;
    // Row-ponds give two valid placements: [1,3,0,2] and [2,0,3,1].
    // Merge cell (0,1) into cell (1,3)'s pond so the first placement puts two
    // fish in that shared pond and is rejected; the second stays valid.
    const ponds = new Array<number>(size * size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        ponds[idx(r, c, size)] = r;
      }
    }
    ponds[idx(0, 1, size)] = 4;
    ponds[idx(1, 3, size)] = 4;
    const puzzle: Puzzle = { size, ponds };
    expect(countSolutions(puzzle, BIG)).toBe(1);
    // Sanity: the two placements are exactly what row-ponds alone would allow;
    // the merged pond removes [1,3,0,2] (two fish in pond 4), leaving one.
    expect(bruteCount(rowPonds(size))).toBe(2);
  });

  it("reports two or more solutions", () => {
    expect(countSolutions(rowPonds(4), BIG)).toBe(2);
  });
});
