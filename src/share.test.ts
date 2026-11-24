import { describe, expect, it } from "vitest";
import { formatTime, shareText } from "./share";

describe("share: formatTime", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9_999)).toBe("0:09");
    expect(formatTime(154_000)).toBe("2:34");
  });

  it("adds hours from one hour up", () => {
    expect(formatTime(3_600_000)).toBe("1:00:00");
    expect(formatTime(3_725_000)).toBe("1:02:05");
  });
});

describe("share: shareText", () => {
  const base = { number: 7, date: "2026-11-22", size: 9, baseUrl: "https://teige.dev/fishdoku/" };

  it("includes number, size, time and a link to that day", () => {
    expect(shareText({ ...base, solvedMs: 154_000 })).toBe(
      "Fishdoku #7 🐟 9×9\n⏱️ 2:34\nhttps://teige.dev/fishdoku/#/2026-11-22",
    );
  });

  it("omits the time line for untimed solves", () => {
    expect(shareText({ ...base, solvedMs: null })).not.toContain("⏱️");
  });
});

describe("share: Deep Water shareText", () => {
  it("names the mode, number and tank size, with time and a Deep link", () => {
    const text = shareText({
      mode: "deep",
      number: 3,
      date: "2026-11-25",
      size: 8,
      solvedMs: 724_000,
      baseUrl: "https://teige.dev/fishdoku/",
    });
    expect(text).toContain("Fishdoku Deep #3");
    expect(text).toContain("2×8×8");
    expect(text).toContain("12:04");
    expect(text.split("\n").at(-1)).toBe("https://teige.dev/fishdoku/#/deep/2026-11-25");
  });

  it("never includes board glyphs that could reveal fish positions", () => {
    const text = shareText({ mode: "deep", number: 1, date: "2026-11-23", size: 8, solvedMs: 1, baseUrl: "x/" });
    expect(text).not.toMatch(/><>|<></);
  });
});
