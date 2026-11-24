/**
 * Hash routing for Fishdoku.
 *
 * The current date lives in the URL hash, e.g. `/#/2026-11-16` for Classic or
 * `/#/deep/2026-12-04` for Deep Water. Hash routing
 * needs no server rewrite rules, so any static host works. Out-of-range hashes
 * (invalid, future or pre-launch) are redirected to today with `replaceState`,
 * which updates the address bar without adding a history entry. Real navigation
 * between valid dates uses `pushState` so the browser back/forward buttons work.
 */

import type { Mode } from "./core/daily";
import { clampDateFor } from "./core/daily";

/** Matches `#/something` and captures the (URL-encoded) suffix. */
const HASH_DATE_RE = /^#\/(.+)$/;

/** Matches a Deep Water hash, `#/deep` or `#/deep/<date>`, capturing the date part. */
const HASH_DEEP_RE = /^#\/deep(?:\/(.*))?$/;

/** A parsed route: which mode, and the raw (unvalidated) date or null. */
export interface Route {
  readonly mode: Mode;
  readonly date: string | null;
}

/** Decode a URL-encoded hash segment, keeping it raw if it is malformed. */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Extract a raw date string from a location hash, or null if it has no `#/` suffix. */
export function parseHash(hash: string): string | null {
  const m = HASH_DATE_RE.exec(hash);
  if (!m) return null;
  return decode(m[1]);
}

/**
 * Parse a location hash into a mode and raw date. `#/deep/<date>` and `#/deep`
 * are Deep Water; everything else is Classic, exactly as before Deep existed.
 */
export function parseRoute(hash: string): Route {
  const deep = HASH_DEEP_RE.exec(hash);
  if (deep) return { mode: "deep", date: deep[1] ? decode(deep[1]) : null };
  return { mode: "classic", date: parseHash(hash) };
}

/** The relative hash for a mode and date: `#/<date>` or `#/deep/<date>`. */
export function hashFor(mode: Mode, date: string): string {
  return mode === "deep" ? `#/deep/${date}` : `#/${date}`;
}

/** The mode and playable date for the live hash (out-of-range dates resolve to today). */
export function currentRoute(): { mode: Mode; date: string } {
  const route = parseRoute(window.location.hash);
  return { mode: route.mode, date: clampDateFor(route.mode, route.date) };
}

/** The playable date for the live hash: invalid, future and pre-launch resolve to today. */
export function currentDate(): string {
  return currentRoute().date;
}

/** The mode of the live hash (Classic unless it is a `#/deep` hash). */
export function currentMode(): Mode {
  return parseRoute(window.location.hash).mode;
}

/** Replace the current history entry's hash (no new entry), with a fallback. */
function replaceHash(hash: string): void {
  try {
    window.history.replaceState({}, "", hash);
  } catch {
    window.location.hash = hash.slice(1);
  }
}

/**
 * Ensure the URL points at an available date. An out-of-range current hash is
 * rewritten to today in the same mode via `replaceState` (no history entry), and
 * a bare `#/deep` gains today's date. Returns the resolved, playable date.
 */
export function redirectToAvailable(): string {
  const route = parseRoute(window.location.hash);
  if (route.date !== null || route.mode === "deep") {
    const safe = clampDateFor(route.mode, route.date);
    if (safe !== route.date) replaceHash(hashFor(route.mode, safe));
  }
  return currentDate();
}

// URLs are written relative to the page (`#/date`, never `/#/date`) so the app
// keeps working when it is served from a subpath such as teige.dev/fishdoku/.

/** Navigate to a date in a mode (Classic by default), adding a history entry. */
export function navigateTo(date: string, mode: Mode = "classic"): void {
  const safe = clampDateFor(mode, date);
  const hash = hashFor(mode, safe);
  try {
    window.history.pushState({}, "", hash);
  } catch {
    // Some environments disallow pushState; fall back to assigning the hash.
    try {
      window.location.hash = hash.slice(1);
    } catch {
      /* no-op */
    }
  }
}
