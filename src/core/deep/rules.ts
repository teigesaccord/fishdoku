/**
 * Rules for Deep Water tanks: conflict detection and solved detection.
 *
 * Pure logic with no DOM access. Within a layer the classic rules apply (one
 * fish per row, column and pond; no touching). Across layers two more rules
 * apply: no two fish on the same (row, col) pillar, and no edge-to-edge touching
 * between neighboring layers (|layer difference| = 1, same row and columns 1
 * apart, or same column and rows 1 apart).
 */

import { CellState } from "../puzzle";
import type { DeepBoard, DeepPuzzle } from "./puzzle";
import { deepCoords, tankCellCount, LAYERS } from "./puzzle";

/** Whether two fish (flat tank indices) break a rule together. */
function fishConflict(i: number, j: number, puzzle: DeepPuzzle): boolean {
  const size = puzzle.size;
  const a = deepCoords(i, size);
  const b = deepCoords(j, size);
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  if (a.layer === b.layer) {
    if (dr === 0 || dc === 0) return true; // same row or column
    if (puzzle.ponds[i] === puzzle.ponds[j]) return true; // same pond
    return dr <= 1 && dc <= 1; // touching within the layer
  }
  if (dr === 0 && dc === 0) return true; // pillar rule
  // Neighboring layers may not touch edge to edge (the "+" shadow): side by
  // side in a row or above/below in a column. Diagonal offsets are allowed.
  // With two layers, surface and deep are neighbors.
  return Math.abs(a.layer - b.layer) === 1 && dr + dc === 1;
}

/** The set of fish (flat tank indices) that take part in a rule violation. */
export function deepConflicts(puzzle: DeepPuzzle, board: DeepBoard): Set<number> {
  const fishes: number[] = [];
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === CellState.FISH) fishes.push(i);
  }
  const result = new Set<number>();
  for (let a = 0; a < fishes.length; a++) {
    for (let b = a + 1; b < fishes.length; b++) {
      if (fishConflict(fishes[a], fishes[b], puzzle)) {
        result.add(fishes[a]);
        result.add(fishes[b]);
      }
    }
  }
  return result;
}

/** Whether the tank is solved: exactly LAYERS*N fish and none in conflict. */
export function isDeepSolved(puzzle: DeepPuzzle, board: DeepBoard): boolean {
  if (board.cells.length !== tankCellCount(puzzle.size)) return false;
  let count = 0;
  for (const c of board.cells) if (c === CellState.FISH) count++;
  if (count !== LAYERS * puzzle.size) return false;
  return deepConflicts(puzzle, board).size === 0;
}
