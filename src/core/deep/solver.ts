/**
 * Solver for Deep Water tanks: find fish placements that satisfy every rule.
 *
 * Pure logic with no DOM access. Every layer holds exactly one fish per row, so
 * every rule only links a row to itself and to the row above. The search goes
 * row by row and, within a row, picks a column for each layer in turn:
 *
 *   same row      the columns are pairwise different (pillar rule), and
 *                 neighboring layers differ by more than 1 (side-by-side touch)
 *   row above     within a layer, columns differ by more than 1 (classic touch);
 *                 between neighboring layers, columns are not equal
 *                 (above/below touch). Diagonal offsets across layers are fine.
 *
 * Each layer keeps a used-column and a used-pond bitmask, like the classic
 * solver. Pond ids are global (layer L owns L*N..L*N+N-1); they are reduced to
 * the layer-local 0..N-1 for the masks.
 */

import type { DeepPuzzle } from "./puzzle";
import { LAYERS } from "./puzzle";

/** A tank placement: `cols[layer][row]` is the column of that row's fish. */
export type DeepSolution = number[][];

/**
 * Search for solutions, calling `onSolution` with the current placement for each
 * one found, until `limit` have been found. Returns the number found
 * (`min(actual, limit)`).
 */
function search(
  puzzle: DeepPuzzle,
  limit: number,
  onSolution: ((cols: Int32Array[]) => void) | null,
): number {
  const size = puzzle.size;
  const area = size * size;
  const ponds = puzzle.ponds;
  const cols: Int32Array[] = [];
  for (let L = 0; L < LAYERS; L++) cols.push(new Int32Array(size).fill(-1));
  const usedCols = new Int32Array(LAYERS);
  const usedPonds = new Int32Array(LAYERS);
  let count = 0;

  function place(row: number, layer: number): void {
    if (count >= limit) return;
    if (layer === LAYERS) {
      if (row === size - 1) {
        count++;
        if (onSolution) onSolution(cols);
        return;
      }
      place(row + 1, 0);
      return;
    }
    const base = layer * area + row * size;
    const pondBase = layer * size;
    for (let col = 0; col < size; col++) {
      if ((usedCols[layer] & (1 << col)) !== 0) continue;
      const pid = ponds[base + col] - pondBase;
      if ((usedPonds[layer] & (1 << pid)) !== 0) continue;
      // Same row, layers already placed in this row (all lower layers).
      let ok = true;
      for (let other = 0; other < layer; other++) {
        const oc = cols[other][row];
        if (oc === col) { ok = false; break; } // pillar
        if (layer - other === 1 && Math.abs(oc - col) <= 1) { ok = false; break; } // side by side
      }
      if (!ok) continue;
      if (row > 0) {
        if (Math.abs(cols[layer][row - 1] - col) <= 1) continue; // touching within the layer
        if (layer > 0 && cols[layer - 1][row - 1] === col) continue; // above/below, layer up
        if (layer < LAYERS - 1 && cols[layer + 1][row - 1] === col) continue; // above/below, layer down
      }
      cols[layer][row] = col;
      usedCols[layer] |= 1 << col;
      usedPonds[layer] |= 1 << pid;
      place(row, layer + 1);
      usedCols[layer] &= ~(1 << col);
      usedPonds[layer] &= ~(1 << pid);
      cols[layer][row] = -1;
      if (count >= limit) return;
    }
  }

  place(0, 0);
  return count;
}

/** Count tank solutions, stopping once `limit` have been found. */
export function countDeepSolutions(puzzle: DeepPuzzle, limit: number): number {
  return search(puzzle, limit, null);
}

/** Up to `limit` tank solutions, in search order. */
export function findDeepSolutions(puzzle: DeepPuzzle, limit: number): DeepSolution[] {
  const out: DeepSolution[] = [];
  search(puzzle, limit, (cols) => out.push(cols.map((c) => Array.from(c))));
  return out;
}
