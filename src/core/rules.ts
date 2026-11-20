/**
 * Rules for Fishdoku boards: conflict detection and solved detection.
 *
 * Pure logic with no DOM access, so it can be unit-tested headlessly. A board
 * is judged against a puzzle's pond layout using the placement rules from the
 * `puzzle-rules` spec: exactly one fish per row, column and pond, plus no two
 * fish touching (orthogonally or diagonally).
 */

import type { Puzzle, Board } from "./puzzle";
import { CellState, rowOf, colOf } from "./puzzle";

/** Indices of every cell currently marked with a fish. */
function fishIndices(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === CellState.FISH) out.push(i);
  }
  return out;
}

/** Whether two marked fish participate in a rule violation together. */
function fishConflict(
  i: number,
  j: number,
  size: number,
  puzzle: Puzzle,
): boolean {
  const ri = rowOf(i, size);
  const ci = colOf(i, size);
  const rj = rowOf(j, size);
  const cj = colOf(j, size);
  // Two fish in the same row.
  if (ri === rj) return true;
  // Two fish in the same column.
  if (ci === cj) return true;
  // Two fish in the same pond.
  if (puzzle.ponds[i] === puzzle.ponds[j]) return true;
  // Two fish touching orthogonally or diagonally.
  const dr = Math.abs(ri - rj);
  const dc = Math.abs(ci - cj);
  if (dr <= 1 && dc <= 1) return true;
  return false;
}

/** The set of fish indices that participate in a rule violation. */
export function conflicts(puzzle: Puzzle, board: Board): Set<number> {
  const size = puzzle.size;
  const result = new Set<number>();
  const fishes = fishIndices(board);
  for (let a = 0; a < fishes.length; a++) {
    for (let b = a + 1; b < fishes.length; b++) {
      const i = fishes[a];
      const j = fishes[b];
      if (fishConflict(i, j, size, puzzle)) {
        result.add(i);
        result.add(j);
      }
    }
  }
  return result;
}

/** Whether the board is solved: exactly N fish and none in conflict. */
export function isSolved(puzzle: Puzzle, board: Board): boolean {
  if (board.cells.length !== puzzle.size * puzzle.size) return false;
  let count = 0;
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === CellState.FISH) count++;
  }
  if (count !== puzzle.size) return false;
  return conflicts(puzzle, board).size === 0;
}
