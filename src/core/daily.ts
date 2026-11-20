/**
 * Daily mapping: turn a calendar date into the puzzle that day plays, and back.
 *
 * Pure logic with no DOM access so it can be unit-tested headlessly. All date
 * math goes through `Date.UTC(...)` for the local calendar components, so
 * daylight-saving shifts can never move a puzzle to the wrong day. Output dates
 * are always formatted `YYYY-MM-DD` (local time).
 */

/** The first playable day. Earlier dates have no puzzle. Fixed after launch. */
export const LAUNCH_DATE = "2026-11-16"; // Monday; puzzle #1 is a 7x7.

const MS_PER_DAY = 864e5;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Ordered list of active generator versions, oldest first. Each date uses the
 * latest entry whose `from` date is on or before it, so a future v2 can be added
 * by appending with a later `from` date without changing any earlier output.
 */
export const VERSION_TABLE: ReadonlyArray<{ readonly from: string; readonly version: string }> =
  [{ from: LAUNCH_DATE, version: "v1" }];

/** Prefix for the deterministic seed string, so seeds read as an intent. */
export const SEED_PREFIX = "fishdoku";

/** `YYYY-MM-DD` formatted in local time. */
function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The current local calendar date as `YYYY-MM-DD`. */
export function today(): string {
  return toIso(new Date());
}

/** Parse and validate a `YYYY-MM-DD` string. Normalizes it or returns null. */
export function parseDate(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const m = ISO_RE.exec(input.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  // Construct and round-trip through the local calendar to reject impossible
  // dates such as 2026-02-30 (which Date would otherwise roll over).
  const date = new Date(y, month, day);
  if (date.getFullYear() !== y || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return toIso(date);
}

/** Zero-based weekday for a `YYYY-MM-DD` string: 0=Sun .. 6=Sat. */
export function weekdayOf(dateString: string): number {
  const p = parseDate(dateString);
  if (!p) throw new Error(`invalid date: ${dateString}`);
  const [y, m, d] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Puzzle size for a weekday. Difficulty ramps from the easy launch day (Monday)
 * to a Friday peak and eases back into the weekend. Kept local here so it is
 * easy to retune without touching date math. Index by `weekdayOf` (0 = Sunday).
 * Matches the `daily-puzzle` spec table exactly.
 */
export const WEEKDAY_SIZE: ReadonlyArray<number> = [8, 7, 8, 9, 10, 11, 9]; // Sun Mon Tue Wed Thu Fri Sat

/** Puzzle size for a specific `YYYY-MM-DD` date. */
export function puzzleSize(dateString: string): number {
  return WEEKDAY_SIZE[weekdayOf(dateString)];
}

/** Whole-day difference in local calendar days from `LAUNCH_DATE`. Zero at launch. */
export function daysSinceLaunch(dateString: string): number {
  const p = parseDate(dateString);
  if (!p) throw new Error(`invalid date: ${dateString}`);
  const [y, m, d] = p.split("-").map(Number);
  const launch = LAUNCH_DATE.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - Date.UTC(launch[0], launch[1] - 1, launch[2]);
  return Math.floor(ms / MS_PER_DAY);
}

/** Puzzle number for a date: #1 on the launch day. Pre-launch dates are <= 0. */
export function puzzleNumber(dateString: string): number {
  return daysSinceLaunch(dateString) + 1;
}

/** The generator version in effect for a date (latest entry whose `from` <= date). */
export function versionForDate(dateString: string): string {
  const p = parseDate(dateString);
  if (!p) throw new Error(`invalid date: ${dateString}`);
  let chosen = VERSION_TABLE[0].version;
  for (const entry of VERSION_TABLE) {
    if (entry.from <= p) chosen = entry.version;
  }
  return chosen;
}

/** Deterministic seed string for a date under its in-effect version. */
export function seedForDate(dateString: string): string {
  return `${SEED_PREFIX}:${versionForDate(dateString)}:${dateString}`;
}

/**
 * Clamp an arbitrary hash input to a playable local date, following the routing
 * contract: an invalid, future or pre-launch date resolves to today (the design
 * redirects all three to `today()` via `replaceState`). Valid in-range dates pass
 * through unchanged. Returns null only for malformed input that is not even a date.
 */
export function clampDate(input: string | null | undefined): string {
  const now = today();
  const p = parseDate(input);
  if (!p) return now; // invalid format or impossible calendar date
  const sinceNow = daysSinceLaunch(now);
  const sinceLaunch = daysSinceLaunch(p);
  if (sinceLaunch > sinceNow) return now; // future -> today
  if (sinceLaunch < 0) return now; // pre-launch -> today
  return p;
}

/** Whether an earlier playable puzzle exists for navigation. */
export function canPrev(dateString: string): boolean {
  return daysSinceLaunch(dateString) > 0;
}

/** Whether a later playable puzzle exists for navigation. */
export function canNext(dateString: string): boolean {
  return daysSinceLaunch(dateString) < daysSinceLaunch(today());
}
