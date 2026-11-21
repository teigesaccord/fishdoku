/**
 * Hash routing for Fishdoku.
 *
 * The current date lives in the URL hash, e.g. `/#/2026-11-16`. Hash routing
 * needs no server rewrite rules, so any static host works. Out-of-range hashes
 * (invalid, future or pre-launch) are redirected to today with `replaceState`,
 * which updates the address bar without adding a history entry. Real navigation
 * between valid dates uses `pushState` so the browser back/forward buttons work.
 */

import { clampDate } from "./core/daily";

/** Matches `#/something` and captures the (URL-encoded) suffix. */
const HASH_DATE_RE = /^#\/(.+)$/;

/** Extract a raw date string from a location hash, or null if it has no `#/` suffix. */
export function parseHash(hash: string): string | null {
  const m = HASH_DATE_RE.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** The playable date for the live hash: invalid, future and pre-launch resolve to today. */
export function currentDate(): string {
  return clampDate(parseHash(window.location.hash));
}

/**
 * Ensure the URL points at an available date. An out-of-range current hash is
 * rewritten to today via `replaceState` (no history entry). Returns the resolved,
 * playable date for immediate use by the app.
 */
export function redirectToAvailable(): string {
  const current = parseHash(window.location.hash);
  if (current !== null) {
    const safe = clampDate(current);
    if (safe !== current) {
      try {
        window.history.replaceState({}, "", `#/${safe}`);
      } catch {
        window.location.hash = `/${safe}`;
      }
    }
  }
  return currentDate();
}

// URLs are written relative to the page (`#/date`, never `/#/date`) so the app
// keeps working when it is served from a subpath such as teige.dev/fishdoku/.

/** Navigate to a date, adding a history entry so the back/forward buttons work. */
export function navigateTo(date: string): void {
  const safe = clampDate(date);
  try {
    window.history.pushState({}, "", `#/${safe}`);
  } catch {
    // Some environments disallow pushState; fall back to assigning the hash.
    try {
      window.location.hash = `/${safe}`;
    } catch {
      /* no-op */
    }
  }
}
