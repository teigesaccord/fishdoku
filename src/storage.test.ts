import { describe, it, expect, beforeEach } from "vitest";
import { CellState } from "./core/puzzle";
import {
  STORAGE_PREFIX,
  DEEP_STORAGE_PREFIX,
  storageKey,
  readBoard,
  writeBoard,
  __clearMemoryForTests,
} from "./storage";

const ISO = "2026-11-16";

/** Build a row-major grid of N*N cells with the given flat index set to FISH. */
function board(size: number, fishAt: number[]): CellState[] {
  const cells = Array.from({ length: size * size }, () => CellState.EMPTY);
  for (const i of fishAt) cells[i] = CellState.FISH;
  return cells;
}

beforeEach(() => {
  window.localStorage.clear();
  __clearMemoryForTests();
});

describe("storage: key and round-trip", () => {
  it("uses the documented storage key namespace", () => {
    expect(STORAGE_PREFIX).toBe("fishdoku:v1:board:");
    expect(storageKey(ISO)).toBe("fishdoku:v1:board:2026-11-16");
  });

  it("writes and reads a board back with its digit string and solved flag", () => {
    const cells = board(7, [0, 8, 48]); // fish on three cells
    writeBoard(ISO, { size: 7, cells, solved: true });

    const stored = readBoard(ISO);
    expect(stored).not.toBeNull();
    expect(stored!.cells).toBe(
      "2000000" + // row 0, fish at index 0
        "0200000" + // row 1, fish at index 8
        "0000000" + // rows 2-5 all empty
        "0000000" +
        "0000000" +
        "0000000" +
        "0000002", // row 6, fish at index 48
    );
    expect(stored!.solved).toBe(true);
  });

  it("round-trips timing fields and defaults them for older boards", () => {
    writeBoard(ISO, { size: 7, cells: board(7, []), solved: true, elapsedMs: 61_234, solvedMs: 61_234 });
    expect(readBoard(ISO)).toMatchObject({ elapsedMs: 61_234, solvedMs: 61_234 });

    // A board saved before the timer existed has neither field.
    window.localStorage.setItem(storageKey(ISO), JSON.stringify({ cells: "0".repeat(49), solved: false }));
    expect(readBoard(ISO)).toMatchObject({ elapsedMs: 0, solvedMs: null });
  });

  it("returns null for a date with no stored board", () => {
    expect(readBoard("2026-11-17")).toBeNull();
  });

  it("rejects and ignores corrupt payloads instead of throwing", () => {
    window.localStorage.setItem(storageKey(ISO), "{not valid json");
    expect(readBoard(ISO)).toBeNull();

    // Well-formed JSON but wrong shape (missing solved / bad cell type).
    window.localStorage.setItem(storageKey(ISO), JSON.stringify({ cells: [9] }));
    expect(readBoard(ISO)).toBeNull();
  });
});

describe("storage: in-memory fallback", () => {
  it("falls back to an in-memory map when localStorage throws", () => {
    __clearMemoryForTests();
    const ls = window.localStorage;
    const origGet = ls.getItem.bind(ls);
    const origSet = ls.setItem.bind(ls);
    ls.getItem = () => {
      throw new Error("blocked");
    };
    ls.setItem = () => {
      throw new Error("blocked");
    };

    try {
      writeBoard(ISO, { size: 7, cells: board(7, []), solved: false });
      const stored = readBoard(ISO);
      // A value only survives here because the in-memory fallback caught the throws.
      expect(stored).not.toBeNull();
      expect(stored!.cells).toBe(
        "0000000" + // row 0
          "0000000" + // row 1
          "0000000" + // row 2
          "0000000" + // row 3
          "0000000" + // row 4
          "0000000" + // row 5
          "0000000", // row 6 (all empty, size 7 -> 49 chars)
      );
      expect(stored!.solved).toBe(false);
    } finally {
      ls.getItem = origGet;
      ls.setItem = origSet;
    }
  });
});

describe("storage: Deep Water namespace", () => {
  const DATE = "2026-12-04";

  it("uses its own key namespace", () => {
    expect(DEEP_STORAGE_PREFIX).toBe("fishdoku:v1:deep:");
    expect(storageKey(DATE, "deep")).toBe("fishdoku:v1:deep:2026-12-04");
    expect(storageKey(DATE, "classic")).toBe(storageKey(DATE));
  });

  it("round-trips a 2 x 8 x 8 tank", () => {
    const cells = Array.from({ length: 2 * 64 }, () => CellState.EMPTY);
    cells[0] = CellState.FISH;
    cells[127] = CellState.RULED_OUT;
    writeBoard(DATE, { size: 8, cells, solved: false, elapsedMs: 5_000, solvedMs: null }, "deep");
    const stored = readBoard(DATE, "deep");
    expect(stored!.cells.length).toBe(128);
    expect(stored!.cells[0]).toBe("2");
    expect(stored!.cells[127]).toBe("1");
    expect(stored!.elapsedMs).toBe(5_000);
  });

  it("keeps Classic and Deep boards for the same date apart", () => {
    writeBoard(DATE, { size: 8, cells: board(8, [0]), solved: true, solvedMs: 1_000 });
    expect(readBoard(DATE, "deep")).toBeNull();

    const deep = Array.from({ length: 128 }, () => CellState.RULED_OUT);
    writeBoard(DATE, { size: 8, cells: deep, solved: false }, "deep");
    expect(readBoard(DATE)!.solved).toBe(true);
    expect(readBoard(DATE)!.cells).toBe("2" + "0".repeat(63));
    expect(readBoard(DATE, "deep")!.cells).toBe("1".repeat(128));
  });
});
