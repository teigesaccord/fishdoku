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
