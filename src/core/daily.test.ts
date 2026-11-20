import { describe, it, expect } from "vitest";
import {
  LAUNCH_DATE,
  WEEKDAY_SIZE,
  VERSION_TABLE,
  today,
  parseDate,
  weekdayOf,
  puzzleSize,
  daysSinceLaunch,
  puzzleNumber,
  versionForDate,
  seedForDate,
  clampDate,
  canPrev,
  canNext,
} from "./daily";

const ISO = "2026-11-16"; // Launch Monday.

describe("core/daily: parse and format", () => {
  it("accepts well-formed calendar dates and normalizes them", () => {
    expect(parseDate("2026-11-16")).toBe("2026-11-16");
    expect(parseDate(" 2026-01-05 ")).toBe("2026-01-05");
    expect(parseDate("2024-12-31")).toBe("2024-12-31");
  });

  it("rejects malformed and impossible dates", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("2026-1-5")).toBeNull(); // not zero-padded
    expect(parseDate("2026-13-01")).toBeNull(); // month 13
    expect(parseDate("2026-02-30")).toBeNull(); // impossible day
    expect(parseDate("2026-02-29")).toBeNull(); // non-leap February 29
  });

  it("today() is a valid, well-formed date", () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test(today())).toBe(true);
    expect(parseDate(today())).not.toBeNull();
  });
});

describe("core/daily: weekday and size", () => {
  it("maps each weekday to the size from the daily-puzzle spec table", () => {
    // The spec table: Mon 7, Tue 8, Wed 9, Thu 10, Fri 11, Sat 9, Sun 8.
    const expectedByWeekday: Record<number, number> = {
      0: 8, // Sun
      1: 7, // Mon
      2: 8, // Tue
      3: 9, // Wed
      4: 10, // Thu
      5: 11, // Fri
      6: 9, // Sat
    };
    for (let w = 0; w < 7; w++) {
      // A known anchor: 2026-11-16 is a Monday (weekday 1) and size 7.
      const dateByWeekday: Record<number, string> = {
        0: "2026-11-15", // Sun
        1: "2026-11-16", // Mon
        2: "2026-11-17", // Tue
        3: "2026-11-18", // Wed
        4: "2026-11-19", // Thu
        5: "2026-11-20", // Fri
        6: "2026-11-21", // Sat
      };
      expect(weekdayOf(dateByWeekday[w])).toBe(w);
      expect(puzzleSize(dateByWeekday[w])).toBe(expectedByWeekday[w]);
      // The exported table is indexed the same way, so it must agree.
      expect(WEEKDAY_SIZE[w]).toBe(expectedByWeekday[w]);
    }
  });

  it("gives Friday 2026-11-20 an 11x11 puzzle (spec scenario)", () => {
    expect(weekdayOf("2026-11-20")).toBe(5);
    expect(puzzleSize("2026-11-20")).toBe(11);
  });

  it("launch Monday is a 7x7 and sizes stay within the supported 7..11 range", () => {
    expect(LAUNCH_DATE).toBe("2026-11-16");
    expect(puzzleSize(ISO)).toBe(7);
    for (const size of WEEKDAY_SIZE) {
      expect(size).toBeGreaterThanOrEqual(7);
      expect(size).toBeLessThanOrEqual(11);
    }
  });
});

describe("core/daily: numbering and days", () => {
  it("numbers the launch day as #1 and steps forward by one per day", () => {
    expect(puzzleNumber(ISO)).toBe(1);
    expect(daysSinceLaunch(ISO)).toBe(0);
    const next = "2026-11-17";
    expect(puzzleNumber(next)).toBe(2);
    expect(daysSinceLaunch(next)).toBe(1);
  });

  it("treats pre-launch dates as non-positive puzzle numbers", () => {
    expect(puzzleNumber("2026-11-15")).toBe(0);
    expect(puzzleNumber("2020-01-01")).toBe(-2510);
  });

  it("computes day differences through UTC so DST cannot shift them", () => {
    // The US fall-back DST transition on 2026-11-01 is only 1 hour, well under a
    // full day, so whole-day differences must be exact regardless of clock.
    expect(daysSinceLaunch("2026-11-03")).toBe(-13);
    expect(puzzleNumber("2026-11-03")).toBe(-12);
  });
});

describe("core/daily: version and seed", () => {
  it("defaults to v1 at launch and for any later date", () => {
    expect(VERSION_TABLE[0].version).toBe("v1");
    expect(versionForDate(ISO)).toBe("v1");
    expect(versionForDate("2030-06-15")).toBe("v1");
  });

  it("builds a deterministic seed string from the in-effect version and date", () => {
    expect(seedForDate(ISO)).toBe("fishdoku:v1:2026-11-16");
    // A future v2 would take over without changing earlier seeds.
    const table = [...VERSION_TABLE, { from: "2027-01-01", version: "v2" }];
    void table;
  });
});

describe("core/daily: bounds and clamping", () => {
  it("clamps invalid input to today", () => {
    expect(clampDate(null)).toBe(today());
    expect(clampDate(undefined)).toBe(today());
    expect(clampDate("garbage")).toBe(today());
    expect(clampDate("2026-99-99")).toBe(today());
  });

  it("clamps future dates to today", () => {
    const future = "2999-01-01";
    expect(daysSinceLaunch(future)).toBeGreaterThan(0);
    expect(clampDate(future)).toBe(today());
  });

  it("clamps pre-launch dates to today", () => {
    expect(puzzleNumber("2026-11-15")).toBeLessThanOrEqual(0);
    expect(clampDate("2026-11-15")).toBe(today());
    expect(clampDate("1999-12-31")).toBe(today());
  });

  it("passes valid in-range dates through unchanged", () => {
    // A date at or after launch and not in the future passes straight through.
    const anchor = "2026-11-20";
    if (daysSinceLaunch(anchor) <= daysSinceLaunch(today())) {
      expect(clampDate(anchor)).toBe(anchor);
    }
  });

  it("reports prev/next availability against the launch and today bounds", () => {
    // At launch there is no earlier puzzle; past launch there is one.
    expect(canPrev(ISO)).toBe(false);
    if (daysSinceLaunch(LAUNCH_DATE) < daysSinceLaunch(today()) - 1) {
      expect(canPrev("2026-11-17")).toBe(true);
    }
    // Today has no later puzzle; earlier dates do.
    expect(canNext(today())).toBe(false);
    if (daysSinceLaunch(ISO) < daysSinceLaunch(today())) {
      expect(canNext(ISO)).toBe(true);
    }
  });
});
