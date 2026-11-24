import { describe, it, expect } from "vitest";
import { clampDate, today } from "./core/daily";
import {
  parseHash,
  parseRoute,
  hashFor,
  currentDate,
  currentMode,
  redirectToAvailable,
  navigateTo,
} from "./router";

/** Open a specific hash as the current location. */
function openHash(hash: string): void {
  window.location.hash = hash;
}

describe("router: parseHash", () => {
  it("extracts the date from a #/<date> hash and null otherwise", () => {
    openHash("#/2026-11-18");
    expect(parseHash(window.location.hash)).toBe("2026-11-18");

    openHash("#/");
    expect(parseHash(window.location.hash)).toBeNull();

    openHash("#/not-a-date");
    expect(parseHash(window.location.hash)).toBe("not-a-date");
  });
});

describe("router: redirectToAvailable", () => {
  it("keeps a valid in-range hash unchanged and returns today", () => {
    const t = today(); // same clock source as clampDate -> no TZ drift
    openHash(`/#/${t}`);
    expect(redirectToAvailable()).toBe(t);
    expect(parseHash(window.location.hash)).toBe(t);
  });

  it("redirects a future hash to today via replaceState", () => {
    openHash("#/2999-01-01");
    const result = redirectToAvailable();
    expect(result).toBe(clampDate("#/2999-01-01".slice(2)));
    expect(parseHash(window.location.hash)).toBe(clampDate("#/2999-01-01".slice(2)));
  });

  it("redirects a pre-launch hash to today", () => {
    openHash("#/2020-01-01");
    const target = clampDate("2020-01-01");
    expect(redirectToAvailable()).toBe(target);
    expect(parseHash(window.location.hash)).toBe(target);
  });

  it("redirects an invalid hash to today", () => {
    openHash("#/not-a-date");
    const target = clampDate("not-a-date");
    expect(redirectToAvailable()).toBe(target);
    expect(parseHash(window.location.hash)).toBe(target);
  });
});

describe("router: navigateTo", () => {
  it("pushes a valid date onto the hash history for back/forward", () => {
    openHash("#/2026-11-18");
    const before = window.history.length;
    navigateTo("2026-11-19");
    expect(currentDate()).toBe(clampDate("2026-11-19"));
    expect(parseHash(window.location.hash)).toBe(clampDate("2026-11-19"));
    expect(window.history.length).toBe(before + 1);
  });
});

describe("router: subpath hosting", () => {
  it("keeps the page path when navigating (e.g. served from /fishdoku/)", () => {
    window.history.replaceState({}, "", "/fishdoku/#/2026-11-18");
    navigateTo("2026-11-19");
    expect(window.location.pathname).toBe("/fishdoku/");
    window.history.replaceState({}, "", "/fishdoku/#/2999-01-01");
    redirectToAvailable();
    expect(window.location.pathname).toBe("/fishdoku/");
    window.history.replaceState({}, "", "/");
  });
});

describe("router: Deep Water routes", () => {
  it("parses #/deep/<date> and #/deep as Deep, everything else as Classic", () => {
    expect(parseRoute("#/deep/2026-12-04")).toEqual({ mode: "deep", date: "2026-12-04" });
    expect(parseRoute("#/deep")).toEqual({ mode: "deep", date: null });
    expect(parseRoute("#/deep/")).toEqual({ mode: "deep", date: null });
    expect(parseRoute("#/2026-11-20")).toEqual({ mode: "classic", date: "2026-11-20" });
    expect(parseRoute("")).toEqual({ mode: "classic", date: null });
    expect(parseRoute("#/deeper")).toEqual({ mode: "classic", date: "deeper" });
  });

  it("opens a playable shared Deep link as-is", () => {
    const t = today();
    openHash(`#/deep/${t}`);
    expect(redirectToAvailable()).toBe(t);
    expect(currentMode()).toBe("deep");
    expect(window.location.hash).toBe(`#/deep/${t}`);
  });

  it("keeps classic links meaning Classic", () => {
    openHash("#/2026-11-20");
    expect(currentMode()).toBe("classic");
    expect(currentDate()).toBe(clampDate("2026-11-20"));
  });

  it("redirects out-of-range Deep dates to #/deep/<today>", () => {
    for (const bad of ["2999-01-01", "2020-01-01", "nope"]) {
      openHash(`#/deep/${bad}`);
      expect(redirectToAvailable()).toBe(today());
      expect(window.location.hash).toBe(`#/deep/${today()}`);
    }
    openHash("#/deep");
    redirectToAvailable();
    expect(window.location.hash).toBe(`#/deep/${today()}`);
  });

  it("navigates within Deep, keeping the prefix", () => {
    openHash("#/deep");
    navigateTo(today(), "deep");
    expect(window.location.hash).toBe(`#/deep/${today()}`);
    expect(hashFor("deep", "2026-12-04")).toBe("#/deep/2026-12-04");
    expect(hashFor("classic", "2026-12-04")).toBe("#/2026-12-04");
  });
});
