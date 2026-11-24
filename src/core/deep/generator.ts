/**
 * Deep Water generator, version deep-v1: build a tank from a seed string.
 *
 * Pure logic with no DOM access, using only the integer-only seeded `Rng`, so the
 * same seed always yields the same tank on every engine. Versioned separately
 * from the classic generator: nothing here can change a classic puzzle.
 *
 *   1. place fish     cols[L][r], row by row and layer by layer over shuffled
 *                     column orders, backtracking on every Deep Water rule.
 *                     This is the intended solution.
 *   2. grow ponds     per layer, the classic pond-growing step seeded from that
 *                     layer's fish (pond r grows from the fish in row r).
 *   3. layer check    each layer taken alone must have >= 2 classic solutions;
 *                     a layer that is already unique alone is re-grown.
 *   4. tank check     find up to two tank solutions. If the intended one is the
 *                     only one, done; otherwise repair.
 *   5. repair         in a layer where the other solution differs from the
 *                     intended one, move one of the other solution's fish cells
 *                     into a neighboring pond that already holds another of its
 *                     fish, so it gets two fish in one pond and dies. The intended
 *                     solution is untouched (the moved cell is never one of its
 *                     fish). Accept the first move that keeps both ponds
 *                     contiguous and leaves the layer still ambiguous alone.
 */

import { Rng } from "../rng";
import type { Puzzle } from "../puzzle";
import { countSolutions } from "../solver";
import { growPonds, pondsHasEmptyOrDisconnected } from "../generator/v1";
import type { DeepPuzzle } from "./puzzle";
import { LAYERS, layerPuzzle, tankFromLayers } from "./puzzle";
import type { DeepSolution } from "./solver";
import { findDeepSolutions } from "./solver";

/** Re-grow attempts for a layer that comes out unique on its own. */
const MAX_REGROWS = 30;
/** Repairs per attempt before restarting. */
const MAX_REPAIRS = 200;
/** Attempts before giving up entirely. */
const MAX_ATTEMPTS = 500;

/** Place a valid tank of fish (the intended solution), or null if none found. */
function placeTankFish(rng: Rng, size: number): DeepSolution | null {
  const orders: number[][] = [];
  for (let L = 0; L < LAYERS; L++) {
    const order = Array.from({ length: size }, (_, c) => c);
    rng.shuffle(order);
    orders.push(order);
  }
  const cols: number[][] = [];
  for (let L = 0; L < LAYERS; L++) cols.push(new Array<number>(size).fill(-1));
  const used: number[] = new Array<number>(LAYERS).fill(0);

  function place(row: number, layer: number): boolean {
    if (layer === LAYERS) return row === size - 1 ? true : place(row + 1, 0);
    for (const col of orders[layer]) {
      if (used[layer] & (1 << col)) continue;
      let ok = true;
      for (let other = 0; other < layer; other++) {
        const oc = cols[other][row];
        if (oc === col || (layer - other === 1 && Math.abs(oc - col) <= 1)) { ok = false; break; }
      }
      if (!ok) continue;
      if (row > 0) {
        if (Math.abs(cols[layer][row - 1] - col) <= 1) continue;
        if (layer > 0 && cols[layer - 1][row - 1] === col) continue;
        if (layer < LAYERS - 1 && cols[layer + 1][row - 1] === col) continue;
      }
      cols[layer][row] = col;
      used[layer] |= 1 << col;
      if (place(row, layer + 1)) return true;
      used[layer] &= ~(1 << col);
      cols[layer][row] = -1;
    }
    return false;
  }

  return place(0, 0) ? cols : null;
}

/** Whether a classic layer has two or more solutions on its own. */
function ambiguousAlone(layer: Puzzle): boolean {
  return countSolutions(layer, 2) >= 2;
}

/**
 * Try to kill `other` in `layer` without touching `keep` (both per-row columns
 * for this layer). Mutates `layer.ponds` and returns true on success.
 */
function repairLayer(layer: Puzzle, keep: number[], other: number[]): boolean {
  const size = layer.size;
  const ponds = layer.ponds;
  for (let r = 0; r < size; r++) {
    // On a row where both agree the cell is an intended fish; every pond already
    // holds exactly one intended fish, so moving it would break the intended
    // solution. Only cells unique to `other` can move.
    if (keep[r] === other[r]) continue;
    const cell = r * size + other[r];
    const from = ponds[cell];
    for (let rr = 0; rr < size; rr++) {
      if (rr === r) continue;
      const to = ponds[rr * size + other[rr]];
      if (to === from) continue;
      ponds[cell] = to;
      if (
        !pondsHasEmptyOrDisconnected(ponds, size, from) &&
        !pondsHasEmptyOrDisconnected(ponds, size, to) &&
        ambiguousAlone(layer)
      ) {
        return true;
      }
      ponds[cell] = from; // revert and keep looking
    }
  }
  return false;
}

/** Whether two tank solutions are identical. */
function sameSolution(a: DeepSolution, b: DeepSolution): boolean {
  for (let L = 0; L < LAYERS; L++) {
    for (let r = 0; r < a[L].length; r++) if (a[L][r] !== b[L][r]) return false;
  }
  return true;
}

/** Optional counters filled in by the generator (for benchmarks; no effect on output). */
export interface DeepGenStats {
  /** Generation attempts used, including the successful one. */
  attempts: number;
  /** Repair moves applied across all attempts. */
  repairs: number;
}

/** One generation attempt; null means restart with the current RNG state. */
function attempt(rng: Rng, size: number, stats: DeepGenStats): DeepPuzzle | null {
  const intended = placeTankFish(rng, size);
  if (!intended) return null;

  const layers: Puzzle[] = [];
  for (let L = 0; L < LAYERS; L++) {
    let layer: Puzzle | null = null;
    for (let g = 0; g < MAX_REGROWS; g++) {
      const candidate: Puzzle = { size, ponds: growPonds(rng, size, intended[L]) };
      if (ambiguousAlone(candidate)) { layer = candidate; break; }
    }
    if (!layer) return null;
    layers.push(layer);
  }

  for (let repairs = 0; repairs <= MAX_REPAIRS; repairs++) {
    const tank = tankFromLayers(layers);
    const other = findDeepSolutions(tank, 2).find((s) => !sameSolution(s, intended));
    if (!other) return tank; // the intended solution is the only one
    if (repairs === MAX_REPAIRS) return null;

    // Try layers where the two solutions differ, in a seeded order.
    const order = Array.from({ length: LAYERS }, (_, L) => L);
    rng.shuffle(order);
    let repaired = false;
    for (const L of order) {
      if (intended[L].every((c, r) => c === other[L][r])) continue;
      if (repairLayer(layers[L], intended[L], other[L])) { repaired = true; stats.repairs++; break; }
    }
    if (!repaired) return null;
  }
  return null;
}

/** Generate a deep-v1 tank for a seed and layer size. Throws if the budget runs out. */
export function generateDeepV1(
  seed: string,
  size: number,
  stats: DeepGenStats = { attempts: 0, repairs: 0 },
): DeepPuzzle {
  const rng = Rng.fromString(seed);
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    stats.attempts++;
    const tank = attempt(rng, size, stats);
    if (tank) return tank;
  }
  throw new Error("generator deep-v1 failed to produce a tank for this seed");
}

/** Deep Water generator versions, kept apart from the classic ones. */
const DEEP_VERSIONS: Record<string, (seed: string, size: number) => DeepPuzzle> = {
  "deep-v1": (seed, size) => generateDeepV1(seed, size),
};

/** A generated tank tagged with the generator version that produced it. */
export interface GeneratedDeepPuzzle extends DeepPuzzle {
  readonly version: string;
}

/** Generate a tank with a named Deep Water generator version. */
export function generateDeep(version: string, seed: string, size: number): GeneratedDeepPuzzle {
  const impl = DEEP_VERSIONS[version];
  if (!impl) throw new Error(`Unknown deep generator version "${version}"`);
  return { ...impl(seed, size), version };
}

/** Classic view of each layer, for tests and the board view. */
export function tankLayers(tank: DeepPuzzle): Puzzle[] {
  return Array.from({ length: LAYERS }, (_, L) => layerPuzzle(tank, L));
}
