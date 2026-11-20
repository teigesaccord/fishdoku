/**
 * Generator version v1: build a Fishdoku puzzle from a seed string.
 *
 * Pure logic with no DOM access and only integer-only, cross-engine-stable
 * randomness (see `rng.ts`). The same seed always yields the same puzzle.
 *
 * Algorithm (from design.md):
 *   1. place fish    a no-touching permutation: one fish per row/column with
 *                    |p[r] - p[r+1]| > 1, found by backtracking over shuffled
 *                    columns per row.
 *   2. grow ponds    each fish cell seeds its own pond; repeatedly attach a
 *                    random frontier cell (unassigned and orthogonally next to a
 *                    pond) to one of its adjacent ponds, until every cell is
 *                    assigned. This yields exactly N contiguous ponds.
 *   3. check         countSolutions(puzzle, limit=2). A value of 1 means the
 *                    intended placement is the only solution: done. A value >= 2
 *                    (here, exactly 2) means an alternative exists: repair.
 *   4. repair        invalidate the second solution by moving one of its fish
 *                    cells into a neighboring pond that already holds another of
 *                    that solution's fish, keeping both ponds contiguous and not
 *                    disturbing any intended-fish cell. Repeat up to K repairs;
 *                    if it cannot be fixed, restart with the current RNG state.
 *
 * The intended placement is always valid by construction (one row/column/pond,
 * never touching), so step 3 only ever has to rule out additional solutions.
 */

import { Rng } from "../rng";
import type { Puzzle } from "../puzzle";
import { idx } from "../puzzle";
import { countSolutions, twoSolutions } from "../solver";

/** Orthogonal neighbours of a flat index as flat indices (clamped to the grid). */
function neighbors(index: number, size: number): number[] {
  const r = Math.floor(index / size);
  const c = index % size;
  const out: number[] = [];
  if (r > 0) out.push(index - size); // up
  if (r < size - 1) out.push(index + size); // down
  if (c > 0) out.push(index - 1); // left
  if (c < size - 1) out.push(index + 1); // right
  return out;
}

/** Maximum repair attempts per generation attempt before restarting. */
const MAX_REPAIRS = 100;

/**
 * Place one fish per row and column with no two in orthogonally or diagonally
 * adjacent cells, by backtracking over a PRNG-shuffled column order. Returns the
 * permutation `p[row] = col`, or an empty array if none is found (never happens
 * for the supported sizes 7..11). Every valid placement exists for these sizes.
 */
function placeFishPermutation(rng: Rng, size: number): number[] {
  const order = Array.from({ length: size }, (_, c) => c);
  rng.shuffle(order);

  const placement = new Int32Array(size).fill(-1);
  const used = new Uint8Array(size).fill(0);

  function backtrack(row: number): boolean {
    if (row === size) return true;
    const prev = row > 0 ? placement[row - 1] : -1;
    for (const col of order) {
      if (used[col]) continue; // each column used exactly once (permutation)
      if (prev >= 0 && Math.abs(col - prev) <= 1) continue; // touching previous row
      used[col] = 1; placement[row] = col;
      if (backtrack(row + 1)) return true;
      used[col] = 0; placement[row] = -1;
    }
    return false;
  }

  backtrack(0);
  const out: number[] = [];
  for (let r = 0; r < size; r++) out.push(placement[r]);
  return out;
}

/**
 * Grow N ponds from the fish seeds. `fishCols[row]` is the column of that row's
 * fish, which seeds pond `row`. Frontier cells attach to a random adjacent pond
 * until every cell is assigned. Ponds stay contiguous and non-empty by
 * construction, so there are exactly N of them covering the whole grid.
 */
function growPonds(rng: Rng, size: number, fishCols: number[]): number[] {
  const ponds = new Int32Array(size * size).fill(-1);
  const assigned = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) {
    const c = fishCols[r];
    const cell = idx(r, c, size);
    ponds[cell] = r;
    assigned[cell] = 1;
  }

  let remaining = size * size - fishCols.length;
  while (remaining > 0) {
    // Collect frontier cells: unassigned and orthogonally next to a pond.
    const frontier: number[] = [];
    for (let i = 0; i < size * size; i++) {
      if (assigned[i]) continue;
      let adjPond = false;
      for (const n of neighbors(i, size)) {
        if (assigned[n]) { adjPond = true; break; }
      }
      if (adjPond) frontier.push(i);
    }
    if (frontier.length === 0) return [...ponds]; // disconnected grid: bail

    const cell = frontier[rng.nextInt(frontier.length)];
    // Distinct adjacent pond ids, in ascending order for determinism. Attach to
    // the lowest-id one so early ponds grow steadily and the resulting layout has
    // few enough solutions that repair converges within MAX_REPAIRS.
    const adjPonds = new Set<number>();
    for (const n of neighbors(cell, size)) {
      if (assigned[n]) adjPonds.add(ponds[n]);
    }
    const list = [...adjPonds].sort((a, b) => a - b);
    ponds[cell] = list[0];
    assigned[cell] = 1;
    remaining--;
  }

  return [...ponds];
}


/**
 * Repair by forcing a pond collision in the alternative solution without
 * disturbing the kept one. Given two distinct valid solutions (as per-row
 * columns) `keepCols`/`killCols`, reassign some fish of `killCols` onto a pond
 * that already holds another of its own fish, collapsing two of them into one
 * pond and making `killCols` impossible while `keepCols` keeps exactly one fish
 * per pond. The moved cell is only in the kept solution on an agreeing row (where
 * both solutions share it), so there we additionally require the destination
 * pond holds no other kept fish, preserving the kept solution's one-per-pond
 * invariant. Returns true if the layout changed.
 */
function repair(puzzle: Puzzle, keepCols: number[], killCols: number[]): boolean {
  const size = puzzle.size;

  for (let r = 0; r < size; r++) {
    const cellToMove = idx(r, killCols[r], size); // a fish of the killed solution
    const fromPond = puzzle.ponds[cellToMove];

    // Destination must already hold another `kill` fish to create the collision.
    for (let rr = 0; rr < size; rr++) {
      if (rr === r) continue;
      const to = puzzle.ponds[idx(rr, killCols[rr], size)];
      if (to === fromPond) continue; // same pond: no new collision

      // On an agreeing row the moved cell is also a kept fish; moving it into a
      // pond that already holds another kept fish would break the kept solution.
      if (keepCols[r] === killCols[r]) {
        let toHasKept = false;
        for (let rr2 = 0; rr2 < size; rr2++) {
          if (rr2 !== r && puzzle.ponds[idx(rr2, keepCols[rr2], size)] === to) {
            toHasKept = true;
            break;
          }
        }
        if (toHasKept) continue; // would give the kept solution two fish in `to`
      }

      const candidate = puzzle.ponds.slice();
      candidate[cellToMove] = to;
      if (pondsHasEmptyOrDisconnected(candidate, size, fromPond) ||
          pondsHasEmptyOrDisconnected(candidate, size, to)) {
        continue; // one side emptied or disconnected — try another destination
      }
      puzzle.ponds[cellToMove] = to; // commit the move in place
      return true;
    }
  }
  return false; // no collision move across all kept-solution fish kept both ponds intact
}

/** Whether removing a cell from `pondId` leaves it empty or disconnected. */
function pondsHasEmptyOrDisconnected(
  pondOf: number[],
  size: number,
  pondId: number,
): boolean {
  // Empty check: any remaining cell in this pond?
  let hasCell = false;
  for (const p of pondOf) if (p === pondId) { hasCell = true; break; }
  if (!hasCell) return true;

  // Connectivity: flood fill from the first remaining cell.
  let start = -1;
  const expected = pondOf.filter((p) => p === pondId).length;
  for (let i = 0; i < pondOf.length; i++) {
    if (pondOf[i] === pondId) { start = i; break; }
  }
  const seen = new Uint8Array(pondOf.length);
  const stack: number[] = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    count++;
    for (const n of neighbors(cur, size)) {
      if (pondOf[n] === pondId && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
  }
  return count !== expected;
}

/** One generation attempt: fish + ponds + repair. null means restart. */
function generateAttempt(rng: Rng, size: number): Puzzle | null {
  const fishCols = placeFishPermutation(rng, size);
  if (fishCols.length < size) return null; // no valid no-touching permutation

  const ponds = growPonds(rng, size, fishCols);
  const puzzle: Puzzle = { size, ponds };

  let count = countSolutions(puzzle, 2);
  let repairCount = 0;
  while (count !== 1) {
    if (count === 0 || repairCount++ >= MAX_REPAIRS) {
      return null; // restart
    }
    const sols = twoSolutions(puzzle);
    if (!sols) {
      return null; // cannot happen when count >= 2, but stay safe
    }
    const [firstCols, secondCols] = sols;
    if (repair(puzzle, firstCols, secondCols)) {
      count = countSolutions(puzzle, 2);
    } else {
      return null; // could not invalidate the alternative this attempt
    }
  }
  return puzzle;
}

/** Maximum generation attempts before giving up entirely. */
const MAX_ATTEMPTS = 2000;

/**
 * Generate a v1 puzzle for the given seed string and size (7..11). Always returns
 * a well-formed puzzle with N contiguous ponds covering every cell and exactly
 * one valid fish placement, or throws if it exhausts its safety budget.
 */
export function generateV1(seedStr: string, size: number): Puzzle {
  const rng = Rng.fromString(seedStr);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const puzzle = generateAttempt(rng, size);
    if (puzzle) {
      return puzzle;
    }
  }
  throw new Error("generator v1 failed to produce a puzzle for this seed");
}
