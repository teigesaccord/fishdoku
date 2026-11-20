import { describe, it, expect } from "vitest";
import type { Puzzle, Board } from "./puzzle";
import { CellState, idx } from "./puzzle";
import { conflicts, isSolved } from "./rules";

/** Build a puzzle from an explicit flat pond array. */
function puzzleFromPonds(size: number, ponds: number[]): Puzzle {
  return { size, ponds };
}

/** A puzzle where each column is its own pond (pond id == column). */
function columnLayout(size: number): Puzzle {
  const ponds = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      ponds[r * size + c] = c;
    }
  }
  return puzzleFromPonds(size, ponds);
}

/** A puzzle where each row is its own pond (pond id == row). */
function rowLayout(size: number): Puzzle {
  const ponds = new Array<number>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      ponds[r * size + c] = r;
    }
  }
  return puzzleFromPonds(size, ponds);
}

/** A board with fish on exactly the given cell indices. */
function boardWithFish(size: number, cells: number[]): Board {
  const arr = new Array<CellState>(size * size).fill(CellState.EMPTY);
  for (const i of cells) arr[i] = CellState.FISH;
  return { size, cells: arr };
}

describe("conflicts()", () => {
  it("flags two fish in the same row", () => {
    const p = columnLayout(7);
    const b = boardWithFish(7, [idx(0, 0, 7), idx(0, 5, 7)]);
    const c = conflicts(p, b);
    expect(c.has(idx(0, 0, 7))).toBe(true);
    expect(c.has(idx(0, 5, 7))).toBe(true);
  });

  it("flags two fish in the same column", () => {
    const p = rowLayout(7);
    const b = boardWithFish(7, [idx(0, 2, 7), idx(6, 2, 7)]);
    const c = conflicts(p, b);
    expect(c.has(idx(0, 2, 7))).toBe(true);
    expect(c.has(idx(6, 2, 7))).toBe(true);
  });

  it("flags two fish in the same pond", () => {
    // Different rows and columns, not adjacent, but share a pond.
    const size = 5;
    const ponds = new Array<number>(size * size).fill(1);
    ponds[idx(0, 0, size)] = 0;
    ponds[idx(2, 2, size)] = 0;
    const p = puzzleFromPonds(size, ponds);
    const b = boardWithFish(size, [idx(0, 0, size), idx(2, 2, size)]);
    const c = conflicts(p, b);
    expect(c.has(idx(0, 0, size))).toBe(true);
    expect(c.has(idx(2, 2, size))).toBe(true);
  });

  it("flags two diagonally touching fish", () => {
    // Different row/col/pond but orthogonally+diagonally adjacent.
    const p = columnLayout(7);
    const b = boardWithFish(7, [idx(2, 3, 7), idx(3, 4, 7)]);
    const c = conflicts(p, b);
    expect(c.has(idx(2, 3, 7))).toBe(true);
    expect(c.has(idx(3, 4, 7))).toBe(true);
  });

  it("does not flag fish that share nothing and never touch", () => {
    // One fish per row/col/pond (column layout), spaced so no adjacency.
    const size = 7;
    const p = columnLayout(size);
    const perm = [0, 2, 4, 6, 3, 5, 1]; // consecutive columns differ by > 1
    const cells = [];
    for (let r = 0; r < size; r++) cells.push(idx(r, perm[r], size));
    const b = boardWithFish(size, cells);
    expect(conflicts(p, b).size).toBe(0);
  });
});

describe("isSolved()", () => {
  it("reports a complete valid board as solved", () => {
    const size = 7;
    const p = columnLayout(size);
    const perm = [0, 2, 4, 6, 3, 5, 1];
    const cells = [];
    for (let r = 0; r < size; r++) cells.push(idx(r, perm[r], size));
    const b = boardWithFish(size, cells);
    expect(isSolved(p, b)).toBe(true);
  });

  it("reports an incomplete board as not solved", () => {
    const p = columnLayout(7);
    const b = boardWithFish(7, [idx(0, 0, 7), idx(1, 1, 7)]); // only 2 fish
    expect(isSolved(p, b)).toBe(false);
  });

  it("ignores ruled-out marks when a board is solved", () => {
    const size = 7;
    const p = columnLayout(size);
    const perm = [0, 2, 4, 6, 3, 5, 1];
    const cells = [];
    for (let r = 0; r < size; r++) cells.push(idx(r, perm[r], size));
    // Add some ruled-out marks on unrelated cells.
    cells.push(idx(2, 0, size), idx(4, 6, size), idx(6, 3, size));
    const arr = new Array<CellState>(size * size).fill(CellState.EMPTY);
    for (const i of cells.slice(0, size)) arr[i] = CellState.FISH;
    for (const i of cells.slice(size)) arr[i] = CellState.RULED_OUT;
    const b: Board = { size, cells: arr };
    expect(isSolved(p, b)).toBe(true);
  });

  it("reports a board with N fish but a conflict as not solved", () => {
    // Two fish in row 0 forces a missing fish elsewhere; still N fish total.
    const size = 6;
    const p = columnLayout(size);
    // rows: 0->col0, 0->col1 (conflict), 1->2, 2->3, 3->4, 4->5, then 5 has none
    // but that's only 5 distinct rows used with a repeat; add row5 fish too to keep count.
    const cells = [idx(0, 0, size), idx(0, 1, size), idx(1, 2, size), idx(2, 3, size)];
    const b = boardWithFish(size, cells); // 4 < 6 fish -> not solved anyway
    expect(isSolved(p, b)).toBe(false);
  });
});
