import { describe, it, expect } from "vitest";
import { Rng } from "../rng";
import { CellState } from "../puzzle";
import type { DeepPuzzle } from "./puzzle";
import { LAYERS, deepIdx, tankCellCount } from "./puzzle";
import { deepConflicts, isDeepSolved } from "./rules";
import { countDeepSolutions, findDeepSolutions } from "./solver";

const N = 8;

/** All column permutations of size n with no two consecutive rows touching. */
function noTouchPerms(n: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  (function rec() {
    if (cur.length === n) { out.push(cur.slice()); return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      if (cur.length > 0 && Math.abs(cur[cur.length - 1] - c) <= 1) continue;
      used[c] = true; cur.push(c); rec(); cur.pop(); used[c] = false;
    }
  })();
  return out;
}
const PERMS = noTouchPerms(N);

/** Every layer's ponds are its columns: the pond rule then equals the column rule. */
const columnTank: DeepPuzzle = {
  size: N,
  ponds: Array.from({ length: LAYERS * N * N }, (_, i) => Math.floor(i / (N * N)) * N + (i % N)),
};

/** Fish cells for some layers' placements (missing layers stay empty). */
function fishBoard(placements: number[][]) {
  const cells = new Array<CellState>(tankCellCount(N)).fill(CellState.EMPTY);
  placements.forEach((cols, L) => cols.forEach((col, r) => (cells[deepIdx(L, r, col, N)] = CellState.FISH)));
  return { size: N, cells };
}

/**
 * Whether the two layers' placements can coexist, written straight from the
 * spec: never the same pillar, and no edge-to-edge touch across the layers.
 */
function compatible(a: number[], b: number[]): boolean {
  for (let r = 0; r < N; r++) {
    if (a[r] === b[r]) return false;
    if (Math.abs(a[r] - b[r]) === 1) return false; // side by side
    if (r + 1 < N && (a[r + 1] === b[r] || b[r + 1] === a[r])) return false; // above/below
  }
  return true;
}

/** A random valid two-layer fish placement, confirmed by the rules module. */
function plantFish(rng: Rng): number[][] {
  const order = PERMS.map((_, i) => i);
  for (;;) {
    rng.shuffle(order);
    const a = PERMS[order[0]];
    const b = order.map((i) => PERMS[i]).find((p) => compatible(a, p));
    if (!b) continue;
    const placed = [a, b];
    expect(deepConflicts(columnTank, fishBoard(placed)).size).toBe(0);
    return placed;
  }
}

/**
 * A random tank with at least one solution: each layer grows N ponds from its
 * planted fish cells, attaching random unassigned cells to a random neighbor.
 */
function randomTank(rng: Rng): DeepPuzzle {
  const planted = plantFish(rng);
  const ponds: number[] = [];
  for (let L = 0; L < LAYERS; L++) {
    const layer = new Array<number>(N * N).fill(-1);
    planted[L].forEach((col, r) => (layer[r * N + col] = r));
    let left = N * N - N;
    while (left > 0) {
      const i = rng.nextInt(N * N);
      if (layer[i] >= 0) continue;
      const r = Math.floor(i / N), c = i % N;
      const nbs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([y, x]) => y >= 0 && y < N && x >= 0 && x < N)
        .map(([y, x]) => layer[y * N + x])
        .filter((p) => p >= 0);
      if (nbs.length === 0) continue;
      layer[i] = nbs[rng.nextInt(nbs.length)];
      left--;
    }
    for (const p of layer) ponds.push(L * N + p);
  }
  return { size: N, ponds };
}

/** Classic solutions of one layer, by filtering every no-touch permutation. */
function layerSolutions(tank: DeepPuzzle, L: number): number[][] {
  return PERMS.filter((perm) => {
    const seen = new Set<number>();
    for (let r = 0; r < N; r++) seen.add(tank.ponds[deepIdx(L, r, perm[r], N)]);
    return seen.size === N;
  });
}

/** Reference count: every compatible combination of layer solutions. */
function referenceCount(tank: DeepPuzzle): number {
  const [s0, s1] = [0, 1].map((L) => layerSolutions(tank, L));
  let count = 0;
  for (const a of s0) for (const b of s1) {
    if (!compatible(a, b)) continue;
    // Cross-check each counted tank with the rules module too.
    expect(isDeepSolved(tank, fishBoard([a, b]))).toBe(true);
    count++;
  }
  return count;
}

describe("deep solver", () => {
  it("matches a brute-force reference on random tanks", () => {
    const rng = Rng.fromString("deep-solver-reference");
    let checked = 0;
    let withSolutions = 0;
    while (checked < 25) {
      const tank = randomTank(rng);
      const sizes = [0, 1].map((L) => layerSolutions(tank, L).length);
      if (sizes[0] * sizes[1] > 200_000) continue; // keep the reference fast
      const expected = referenceCount(tank);
      expect(countDeepSolutions(tank, 1_000_000)).toBe(expected);
      if (expected > 0) withSolutions++;
      checked++;
    }
    expect(withSolutions).toBe(checked); // every planted tank has a solution
  });

  it("returns solutions that the rules module accepts, and honors the limit", () => {
    const rng = Rng.fromString("deep-solver-limit");
    for (let t = 0; t < 50; t++) {
      const tank = randomTank(rng);
      const total = countDeepSolutions(tank, 5);
      const sols = findDeepSolutions(tank, 3);
      expect(sols.length).toBe(Math.min(total, 3));
      for (const sol of sols) {
        const cells = new Array<CellState>(tankCellCount(N)).fill(CellState.EMPTY);
        sol.forEach((cols, L) => cols.forEach((col, r) => (cells[deepIdx(L, r, col, N)] = CellState.FISH)));
        expect(isDeepSolved(tank, { size: N, cells })).toBe(true);
      }
    }
  });
});
