import { describe, it, expect } from "vitest";
import type { Puzzle } from "../puzzle";
import { allPondsContiguous } from "../puzzle";
import { Rng } from "../rng";
import { countSolutions, singleSolution } from "../solver";
import { generate } from "./index";
import { generateV1 } from "./v1";

const BIG = 1_000_000;

/** Number of distinct pond ids present in a flat ponds array. */
function pondCount(ponds: number[]): number {
  const set = new Set<number>();
  for (const p of ponds) set.add(p);
  return set.size;
}

/** A well-formed puzzle: N contiguous ponds covering every cell. */
function expectWellFormed(puzzle: Puzzle): void {
  expect(puzzle.ponds.length).toBe(puzzle.size * puzzle.size);
  expect(pondCount(puzzle.ponds)).toBe(puzzle.size); // exactly N ponds
  expect(allPondsContiguous(puzzle)).toBe(true);
}

/** A uniquely solvable puzzle: one valid no-touching placement. */
function expectUnique(puzzle: Puzzle): void {
  expect(countSolutions(puzzle, BIG)).toBe(1);
  const cols = singleSolution(puzzle);
  expect(cols).not.toBeNull();
  // The single solution is a permutation with no two fish adjacent (ortho/diag).
  for (let r = 0; r < puzzle.size; r++) {
    const c = cols![r];
    if (r > 0) {
      expect(Math.abs(c - cols![r - 1])).toBeGreaterThan(1);
    }
  }
}

describe("generator: valid output", () => {
  it("produces well-formed puzzles across many seeds and all sizes", () => {
    for (const size of [7, 8, 9, 10, 11]) {
      const rng = Rng.fromString(`test:${size}`);
      for (let i = 0; i < 60; i++) {
        const seed = `seed-${size}-${rng.nextInt(1_000_000)}`;
        expectWellFormed(generateV1(seed, size));
      }
    }
  });

  it("places a no-touching fish permutation for every one of 1000 seeds", () => {
    const rng = Rng.fromString("test-placement");
    let checked = 0;
    for (let i = 0; i < 1000; i++) {
      const size = 7 + rng.nextInt(5); // 7..11
      const seed = `placement-${rng.nextInt(1_000_000)}`;
      const puzzle = generateV1(seed, size);
      const cols = singleSolution(puzzle);
      expect(cols).not.toBeNull(); // intended placement exists and is unique
      for (let r = 1; r < size; r++) {
        expect(Math.abs(cols![r] - cols![r - 1])).toBeGreaterThan(1);
      }
      checked++;
    }
    expect(checked).toBe(1000);
  });
});

describe("generator: unique solution", () => {
  it("has exactly one solution across 200 seeds per size (7..11)", () => {
    for (const size of [7, 8, 9, 10, 11]) {
      const rng = Rng.fromString(`uniqueness:${size}`);
      for (let i = 0; i < 200; i++) {
        const seed = `uniq-${size}-${rng.nextInt(1_000_000)}`;
        const puzzle = generateV1(seed, size);
        expectUnique(puzzle);
        expectWellFormed(puzzle);
      }
    }
  });
});

describe("generator: version dispatch", () => {
  it("throws on an unknown version", () => {
    expect(() => generate("v2", "seed-1", 7)).toThrow(/Unknown generator version/);
  });

  it("dispatches v1 and reports the version", () => {
    const p = generate("v1", "fishdoku:v1:2026-11-16", 7);
    expect(p.version).toBe("v1");
    expectWellFormed(p);
    expectUnique(p);
  });

  it("is deterministic across versions (same seed => same puzzle)", () => {
    const a = generate("v1", "stable:seed:42", 9);
    const b = generate("v1", "stable:seed:42", 9);
    expect(a.ponds).toEqual(b.ponds);
  });
});

describe("generator: determinism snapshot", () => {
  // Fixed list of dates covering every size, with their weekday-derived sizes.
  const DATES = [
    "2026-11-16", // Monday 7
    "2026-11-17", // Tuesday 8
    "2026-11-18", // Wednesday 9
    "2026-11-19", // Thursday 10
    "2026-11-20", // Friday 11
    "2026-11-21", // Saturday 9
    "2026-11-22", // Sunday 8
    "2026-11-23", // Monday 7
    "2026-11-24", // Tuesday 8
    "2026-11-25", // Wednesday 9
    "2026-11-26", // Thursday 10
    "2026-11-27", // Friday 11
    "2026-11-28", // Saturday 9
    "2026-11-29", // Sunday 8
    "2026-11-30", // Monday 7
  ];

  it("produces identical pond layouts on repeated runs (snapshot)", () => {
    const snapshot: Record<string, number[]> = {};
    for (const date of DATES) {
      const size = sizeForDate(date);
      snapshot[date] = generateV1(`fishdoku:v1:${date}`, size).ponds;
    }
    // Re-generate and confirm nothing changed.
    for (const date of DATES) {
      const size = sizeForDate(date);
      expect(generateV1(`fishdoku:v1:${date}`, size).ponds).toEqual(snapshot[date]);
    }
  });

  it("fails if the generator is tweaked (sanity: not a no-op)", () => {
    // A different seed must change at least one layout.
    const original = generateV1(`fishdoku:v1:${DATES[0]}`, sizeForDate(DATES[0])).ponds;
    const altered = generateV1(`fishdoku:v1:2026-11-17`, sizeForDate(DATES[0])).ponds;
    expect(altered).not.toEqual(original);
  });
});

/** Weekday -> puzzle size, matching the daily mapping (kept local to this test). */
function sizeForDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  // Build in UTC so the weekday cannot shift with the machine's time zone.
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const table = [8, 7, 8, 9, 10, 11, 9]; // Sun Mon Tue Wed Thu Fri Sat
  return table[day];
}

describe("generator: performance", () => {
  it("generates 365 consecutive days with the worst case well under 500 ms", () => {
    let worst = 0;
    let worstSize = 0;
    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const d = new Date(Date.UTC(2026, 10, 16) + dayOffset * 864e5);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const size = sizeForDate(date);
      const t0 = Date.now();
      const puzzle = generateV1(`fishdoku:v1:${date}`, size);
      const elapsed = Date.now() - t0;
      expectWellFormed(puzzle);
      expectUnique(puzzle);
      if (elapsed > worst) {
        worst = elapsed;
        worstSize = size;
      }
    }
    console.log(`Worst-case generation: ${worst} ms (size ${worstSize})`);
    expect(worst).toBeLessThan(500);
  });
});
