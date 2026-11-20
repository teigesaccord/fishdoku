/**
 * Solver for Fishdoku puzzles: count placements of fish that satisfy the rules.
 *
 * Pure logic with no DOM access, so it can be unit-tested headlessly. The
 * generator uses `countSolutions` to keep only puzzles with a unique solution.
 *
 * A solution places exactly one fish per row and column, one fish per pond, and
 * never puts two fish in orthogonally or diagonally adjacent cells. Because each
 * row holds exactly one fish, the only adjacency constraint that can bind is
 * between two consecutive rows, which reduces to "their columns differ by more
 * than one". That lets the search keep a single previous-row column instead of a
 * whole board and prune against it.
 */

import type { Puzzle } from "./puzzle";

/**
 * Count the number of valid fish placements for a puzzle, stopping early once
 * `limit` solutions have been found. The returned value is therefore
 * `min(actualSolutionCount, limit)`.
 *
 * Assumes pond ids fit in 32 bits (true here: ids are 0..N-1 with N <= 11).
 */
export function countSolutions(puzzle: Puzzle, limit: number): number {
  const size = puzzle.size;
  const ponds = puzzle.ponds;
  let count = 0;

  // Column chosen for each row as the search descends (-1 while unset).
  const placedCol = new Int32Array(size);

  function backtrack(row: number, usedCols: number, usedPonds: number): void {
    if (count >= limit) return;
    if (row === size) {
      count++;
      return;
    }
    const prevCol = row > 0 ? placedCol[row - 1] : -1;
    for (let col = 0; col < size; col++) {
      if ((usedCols & (1 << col)) !== 0) continue; // column already used
      const pondIdx = row * size + col;
      const pid = ponds[pondIdx];
      if ((usedPonds & (1 << pid)) !== 0) continue; // pond already used
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue; // touching
      placedCol[row] = col;
      backtrack(row + 1, usedCols | (1 << col), usedPonds | (1 << pid));
    }
  }

  backtrack(0, 0, 0);
  return count;
}

/**
 * The columns of the single valid solution, or null if there is zero or more
 * than one. Useful to a puzzle's intended placement and for win detection tests.
 */
export function singleSolution(puzzle: Puzzle): number[] | null {
  const size = puzzle.size;
  const ponds = puzzle.ponds;
  let count = 0;
  const out = new Int32Array(size).fill(-1);
  let found: number[] | null = null;

  function backtrack(row: number, usedCols: number, usedPonds: number): void {
    if (count >= 2) return;
    if (row === size) {
      count++;
      // At the base case `out` holds exactly this solution's columns (set by the
      // descent), so capture it here rather than after the search, when later
      // dead-end branches would overwrite it.
      if (count === 1) found = Array.from(out);
      return;
    }
    const prevCol = row > 0 ? out[row - 1] : -1;
    for (let col = 0; col < size; col++) {
      if ((usedCols & (1 << col)) !== 0) continue;
      const pid = ponds[row * size + col];
      if ((usedPonds & (1 << pid)) !== 0) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue;
      out[row] = col;
      backtrack(row + 1, usedCols | (1 << col), usedPonds | (1 << pid));
    }
  }

  backtrack(0, 0, 0);
  if (count !== 1) return null;
  return found;
}

/**
 * The first two distinct valid solutions in ascending-column order, or null if
 * there are fewer than two. Used by the generator to repair away extra
 * solutions: `first` is kept intact as the intended placement.
 */
export function twoSolutions(puzzle: Puzzle): [number[], number[]] | null {
  const size = puzzle.size;
  const ponds = puzzle.ponds;
  let count = 0;
  const out = new Int32Array(size).fill(-1);
  let first: number[] | null = null;
  let second: number[] | null = null;

  function backtrack(row: number, usedCols: number, usedPonds: number): void {
    if (count >= 2) return;
    if (row === size) {
      count++;
      if (count === 1) first = Array.from(out);
      else second = Array.from(out);
      return;
    }
    const prevCol = row > 0 ? out[row - 1] : -1;
    for (let col = 0; col < size; col++) {
      if ((usedCols & (1 << col)) !== 0) continue;
      const pid = ponds[row * size + col];
      if ((usedPonds & (1 << pid)) !== 0) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue;
      out[row] = col;
      backtrack(row + 1, usedCols | (1 << col), usedPonds | (1 << pid));
    }
  }

  backtrack(0, 0, 0);
  if (count !== 2) return null;
  return [first!, second!];
}
