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

  // Literal v1 layouts captured from the shipped generator, one base-36 digit
  // per cell (pond id), row-major. These pin past daily puzzles: if this test
  // fails, a change has altered puzzles players have already seen.
  const PINNED: ReadonlyArray<readonly [string, string]> = [
    ["2026-11-16", "2200000200011120203112223311422333344465554466555"],
    ["2026-11-17", "0000000010000000112000031222500344225333445553335555566655557666"],
    ["2026-11-18", "000001111000011112000331112033331112333366114353566114555566644575566884775568888"],
    ["2026-11-19", "0000000011000022111100000222110000221113005552141300555444430655544433667777733366877777398887777799"],
    ["2026-11-20", "0000111112200011111122000111311220003333222200004333222055443336660554433336355774433333555744888935557448889955574aa8899"],
    ["2026-11-21", "000000222000022221000000221066022233664422233666442555666477755686777555688777555"],
    ["2026-11-22", "3311100033111020333111203311142233334442353333327533633675336666"],
    ["2026-11-27", "000000000010000001000103000011111336622441113366244111136666411511366655555556666777585566667777885699777777aa6997777777a"],
    ["2026-12-25", "0000000000200000001112000000002223030000002233333333442535553344425555533444655558884446577788888869777888aa86997888aaaaa"],
    ["2027-03-14", "2000000022220100222221002222330052423300522667075266677752226677"],
  ];

  it("matches the pinned literal layouts for past and future dates", () => {
    for (const [date, expected] of PINNED) {
      const size = sizeForDate(date);
      const actual = generateV1(`fishdoku:v1:${date}`, size)
        .ponds.map((p) => p.toString(36))
        .join("");
      expect(actual, `v1 layout for ${date}`).toBe(expected);
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
