import { describe, it, expect } from "vitest";
import { CellState } from "../puzzle";
import type { DeepPuzzle } from "./puzzle";
import { LAYERS, deepIdx, tankCellCount } from "./puzzle";
import { deepConflicts, isDeepSolved } from "./rules";

const N = 8;

/** A tank where, in every layer, each column is its own pond. */
function columnTank(size = N): DeepPuzzle {
  const ponds: number[] = [];
  for (let L = 0; L < LAYERS; L++) {
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) ponds.push(L * size + c);
  }
  return { size, ponds };
}

/** A board with fish at the given (layer, row, col) positions. */
function boardWith(fish: Array<[number, number, number]>, size = N, ruledOut: Array<[number, number, number]> = []) {
  const cells = new Array<CellState>(tankCellCount(size)).fill(CellState.EMPTY);
  for (const [l, r, c] of ruledOut) cells[deepIdx(l, r, c, size)] = CellState.RULED_OUT;
  for (const [l, r, c] of fish) cells[deepIdx(l, r, c, size)] = CellState.FISH;
  return { size, cells };
}

/**
 * A valid two-layer solution for N = 8 under the column-pond tank (columns per
 * row for each layer), found by brute force. Same row: different columns that
 * differ by > 1. Consecutive rows: differ by > 1 within a layer and are never
 * equal across the layers.
 */
const SOLUTION: number[][] = [
  [0, 2, 4, 1, 5, 7, 3, 6],
  [4, 6, 0, 7, 3, 1, 5, 2],
];

function solutionFish(): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  SOLUTION.forEach((cols, L) => cols.forEach((c, r) => out.push([L, r, c])));
  return out;
}

describe("deep rules: layer rules", () => {
  it("flags two fish in one row of a layer", () => {
    const set = deepConflicts(columnTank(), boardWith([[1, 4, 0], [1, 4, 5]]));
    expect(set.size).toBe(2);
  });

  it("allows the same row in different layers", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 4, 1], [1, 4, 5]])).size).toBe(0);
  });

  it("flags a diagonal touch within a layer", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 2, 3], [0, 3, 4]])).size).toBe(2);
  });

  it("flags two fish in one pond of a layer", () => {
    // Column ponds: (0,0) and (3,0) share pond 0 in layer 0.
    expect(deepConflicts(columnTank(), boardWith([[0, 0, 0], [0, 3, 0]])).size).toBe(2);
  });
});

describe("deep rules: cross-layer rules", () => {
  it("flags fish stacked in the surface and deep layers (pillar)", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 3, 3], [1, 3, 3]])).size).toBe(2);
  });

  it("flags side-by-side fish across the layers", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 2, 2], [1, 2, 3]])).size).toBe(2);
  });

  it("flags above/below fish across the layers", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 4, 5], [1, 5, 5]])).size).toBe(2);
  });

  it("flags both fish of a cross-layer touch", () => {
    const set = deepConflicts(columnTank(), boardWith([[0, 0, 0], [1, 1, 0]]));
    expect([...set].sort((a, b) => a - b)).toEqual([deepIdx(0, 0, 0, N), deepIdx(1, 1, 0, N)]);
  });

  it("allows a diagonal offset across the layers", () => {
    expect(deepConflicts(columnTank(), boardWith([[0, 2, 2], [1, 3, 3]])).size).toBe(0);
  });

  it("does not flag a fish that breaks no rule", () => {
    const set = deepConflicts(columnTank(), boardWith([[0, 0, 0], [1, 0, 3], [1, 5, 5]]));
    expect(set.size).toBe(0);
  });
});

describe("deep rules: solved detection", () => {
  it("accepts a complete valid tank", () => {
    expect(deepConflicts(columnTank(), boardWith(solutionFish())).size).toBe(0);
    expect(isDeepSolved(columnTank(), boardWith(solutionFish()))).toBe(true);
  });

  it("is not solved when only one layer is complete", () => {
    const fish = solutionFish().filter(([l]) => l === 0);
    expect(isDeepSolved(columnTank(), boardWith(fish))).toBe(false);
  });

  it("ignores ruled-out marks", () => {
    const board = boardWith(solutionFish(), N, [[0, 0, 1], [1, 6, 7]]);
    expect(isDeepSolved(columnTank(), board)).toBe(true);
  });

  it("rejects a board of the wrong length", () => {
    expect(isDeepSolved(columnTank(), { size: N, cells: [] })).toBe(false);
  });
});
