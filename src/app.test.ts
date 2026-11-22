import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { CellState } from "./core/puzzle";
import { generate } from "./core/generator";
import { singleSolution } from "./core/solver";
import { readBoard, writeBoard } from "./storage";
import { today, puzzleNumber, seedForDate, puzzleSize, canNext, canPrev, LAUNCH_DATE } from "./core/daily";

/** Fresh DOM + storage for one app instance. */
function fresh() {
  window.localStorage.clear();
  window.location.hash = "#/" + today();
  const body = document.createElement("div");
  document.body.appendChild(body);

  const boardRoot = el("board", "board");
  const headerRoot = el("fishdoku-header");
  const clearBtn = button("clear-btn");
  const prevBtn = button("prev-day");
  const nextBtn = button("next-day");
  const winOverlay = el("win-overlay", "win-hidden");

  return {
    boardRoot,
    headerRoot,
    clearBtn,
    prevBtn,
    nextBtn,
    winOverlay,
    app: createApp({ boardRoot, headerRoot, clearBtn, prevBtn, nextBtn, winOverlay }),
  };
}

function el(id: string, ...extraClasses: string[]): HTMLElement {
  const e = document.createElement("div");
  e.id = id;
  for (const c of extraClasses) e.classList.add(c);
  document.body.appendChild(e);
  return e;
}

function button(id: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.id = id;
  document.body.appendChild(b);
  return b;
}

/** Tap a cell until it shows FISH (the cycle is empty -> ruled -> fish). */
function setFish(root: HTMLElement, index: number): void {
  const all = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button.board-cell"),
  );
  const btn = all[index];
  if (!btn) throw new Error(`no cell ${index}`);
  for (let i = 0; i < 4 && btn.dataset.state !== "fish"; i++) {
    btn.dispatchEvent(new Event("click"));
  }
}

function encoded(date: string): string | null {
  const b = readBoard(date);
  return b ? b.cells : null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("app: orchestration", () => {
  it("loads today's puzzle, renders an NxN board and labels the header", () => {
    const f = fresh();
    f.app.start();

    expect(f.app.currentDate()).toBe(today());
    // Board rendered exactly size*size buttons.
    const all = f.boardRoot.querySelectorAll<HTMLButtonElement>("button.board-cell");
    const n = puzzleSize(today());
    expect(all.length).toBe(n * n);
    for (let i = 0; i < all.length; i++) {
      expect(all[i].dataset.pond).toBeTruthy();
    }
    // Header shows puzzle #1 at launch and today's date.
    const sub = f.headerRoot.querySelector(".fish-sub") as HTMLElement;
    expect(sub.textContent).toBe(`Puzzle #${puzzleNumber(today())} · ${today()}`);
  });

  it("persists a tap to storage and reflects it on re-render", () => {
    const f = fresh();
    f.app.start();
    const boardRoot = f.boardRoot;

    setFish(boardRoot, 0); // RULED_OUT -> FISH over two taps
    expect(encoded(today())).toContain("2");

    // Re-read storage: the placed fish is persisted under today's key.
    const afterRead = readBoard(today());
    expect(afterRead?.cells).toContain("2");
  });

  it("revisits a solved date: solved board shown and locked, without replaying the win", () => {
    const date = today();
    const size = puzzleSize(date);
    const puzzle = generate("v1", seedForDate(date), size);
    const sol = singleSolution(puzzle)!;
    // Place exactly the unique solution: one fish per row at its column.
    const cells = new Array(size * size).fill(CellState.EMPTY);
    for (let r = 0; r < size; r++) cells[r * size + sol[r]] = CellState.FISH;

    const f = fresh();
    // Write AFTER fresh() so its localStorage.clear() does not wipe the board.
    writeBoard(date, { size, cells, solved: true });
    f.app.start();

    // The win overlay is NOT replayed when reopening an already-solved date.
    expect(f.winOverlay.classList.contains("win-hidden")).toBe(true);
    // The solved indicator is shown in the header instead.
    const badge = f.headerRoot.querySelector(".solved-badge") as HTMLElement;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toContain("SOLVED");
    // The board is locked: tapping a cell leaves the stored board unchanged.
    const before = encoded(date);
    const all = Array.from(
      f.boardRoot.querySelectorAll<HTMLButtonElement>("button.board-cell"),
    );
    all[0].dispatchEvent(new Event("click"));
    expect(encoded(date)).toBe(before);
  });

  it("wins by tapping toward the unique solution", () => {
    const date = today();
    const size = puzzleSize(date);
    const sol = singleSolution(generate("v1", seedForDate(date), size))!;

    const f = fresh();
    // Fresh, unsolved board: nothing solved yet.
    expect(readBoard(date)?.solved ?? false).toBe(false);
    f.app.start();
    const root = f.boardRoot;

    for (let r = 0; r < size; r++) setFish(root, r * size + sol[r]);

    expect(!f.winOverlay.classList.contains("win-hidden")).toBe(true);
  });

  it("clear button: two taps within the window clear and allow replay", () => {
    const date = today();
    const f = fresh();
    f.app.start();
    // The entry point wires this once (main.ts); register it here.
    f.app.onClearTap(() => f.app.clear());
    setFish(f.boardRoot, 0);
    expect(encoded(date)).toContain("2"); // something placed

    const clearBtn = f.clearBtn;
    clearBtn.dispatchEvent(new Event("click"));
    // First tap: ask for confirmation.
    expect(clearBtn.textContent).toBe("really clear?");

    // Second tap within the window: confirm, clearing today's board.
    clearBtn.dispatchEvent(new Event("click"));
    expect(clearBtn.textContent).toBe("Clear");
    expect(encoded(date)).not.toContain("2");
    expect(readBoard(date)?.solved ?? false).toBe(false);
  });

  it("clear resets every cell on every row, not just the first", () => {
    const date = today();
    const f = fresh();
    f.app.start();
    const size = puzzleSize(date);
    const cellsEls = () => Array.from(f.boardRoot.querySelectorAll<HTMLButtonElement>(".board-cell"));
    // Mark cells in the first, a middle and the last row.
    setFish(f.boardRoot, 0);
    setFish(f.boardRoot, Math.floor(size / 2) * size + 1);
    setFish(f.boardRoot, size * size - 1);

    f.app.clear();

    expect(encoded(date)).toBe("0".repeat(size * size));
    expect(cellsEls().every((el) => el.dataset.state === "empty")).toBe(true);
    // The board is still fully playable after clearing.
    setFish(f.boardRoot, size * size - 1);
    expect(encoded(date)?.length).toBe(size * size);
  });

  it("a short board saved by the old clear loads as a fresh board", () => {
    const date = today();
    const f = fresh();
    const size = puzzleSize(date);
    writeBoard(date, { size, cells: new Array(size).fill(0), solved: false });
    f.app.start();
    const els = f.boardRoot.querySelectorAll<HTMLButtonElement>(".board-cell");
    expect(els.length).toBe(size * size);
    expect(Array.from(els).every((el) => el.dataset.state === "empty")).toBe(true);
  });

  it("clear button: a lone tap reverts to 'Clear' after the window", () => {
    const f = fresh();
    f.app.start();
    f.app.onClearTap(() => f.app.clear());
    const clearBtn = f.clearBtn;
    clearBtn.dispatchEvent(new Event("click"));
    expect(clearBtn.textContent).toBe("really clear?");

    // Advance past the 3000 ms window: the label reverts and nothing clears.
    vi.advanceTimersByTime(3001);
    expect(clearBtn.textContent).toBe("Clear");
  });

  it("prev button steps to earlier dates and stops at the launch date", () => {
    const f = fresh();
    f.app.start();
    const start = today();

    // One step back lands on the previous calendar day (today is not launch).
    if (start !== LAUNCH_DATE) {
      f.prevBtn.dispatchEvent(new Event("click"));
      expect(f.app.currentDate()).not.toBe(start);
      // The URL reflects the navigation (pushState updates location.hash).
      expect(window.location.hash.includes(f.app.currentDate())).toBe(true);
    }

    // Walking back must stop at the launch date, where prev is disabled.
    let guard = 0;
    while (f.app.currentDate() !== LAUNCH_DATE && guard < 400) {
      f.prevBtn.dispatchEvent(new Event("click"));
      guard++;
    }
    expect(f.app.currentDate()).toBe(LAUNCH_DATE);
    expect(canPrev(f.app.currentDate())).toBe(false);
    // Forward is available from launch (today is later).
    expect(canNext(f.app.currentDate())).toBe(true);
  });

  it("keeps progress separate per date across navigation", () => {
    const f = fresh();
    f.app.start();
    const first = f.app.currentDate();
    if (!canPrev(first)) return; // needs at least one earlier playable date

    setFish(f.boardRoot, 0);
    const firstEncoded = encoded(first);
    expect(firstEncoded).toContain("2");

    // Move to the previous day: it starts with no stored progress of its own.
    f.prevBtn.dispatchEvent(new Event("click"));
    const second = f.app.currentDate();
    expect(second).not.toBe(first);
    expect(encoded(second)).toBeNull();

    // Mark the second date, then return to the first and confirm its board.
    setFish(f.boardRoot, 0);
    expect(encoded(second)).toContain("2");

    f.nextBtn.dispatchEvent(new Event("click"));
    expect(f.app.currentDate()).toBe(first);
    expect(encoded(first)).toBe(firstEncoded);
  });

  it("browser back / deep link (hashchange) reloads the previous date", () => {
    const f = fresh();
    f.app.start();
    const start = today();

    // Emulate browser back or a deep link: the URL changes and hashchange fires.
    window.location.hash = "#/" + LAUNCH_DATE;
    window.dispatchEvent(new Event("hashchange"));
    expect(f.app.currentDate()).toBe(LAUNCH_DATE);
    expect(f.app.currentDate()).not.toBe(start);
  });
});

describe("app: timer and share", () => {
  function solve(f: ReturnType<typeof fresh>, date: string): void {
    const size = puzzleSize(date);
    const sol = singleSolution(generate("v1", seedForDate(date), size))!;
    for (let r = 0; r < size; r++) setFish(f.boardRoot, r * size + sol[r]);
  }

  it("counts up while playing and records the solve time", () => {
    const date = today();
    const f = fresh();
    f.app.start();
    vi.advanceTimersByTime(83_000);
    const timer = f.headerRoot.querySelector(".fish-timer")!;
    expect(timer.textContent).toBe("1:23");

    solve(f, date);
    expect(readBoard(date)?.solvedMs).toBe(83_000);
    expect(f.winOverlay.querySelector(".win-time")!.textContent).toContain("1:23");

    // The clock stops once solved.
    vi.advanceTimersByTime(10_000);
    expect(timer.textContent).toBe("1:23");
  });

  it("keeps the official time when a solved board is cleared and replayed", () => {
    const date = today();
    const f = fresh();
    f.app.start();
    vi.advanceTimersByTime(60_000);
    solve(f, date);
    f.app.clear();
    vi.advanceTimersByTime(5_000);
    solve(f, date);
    expect(readBoard(date)?.solvedMs).toBe(60_000);
    expect(f.winOverlay.querySelector(".win-replay")!.textContent).toContain("0:05");
  });

  it("does not reset the clock when clearing an unsolved board", () => {
    const date = today();
    const f = fresh();
    f.app.start();
    vi.advanceTimersByTime(30_000);
    f.app.clear();
    vi.advanceTimersByTime(10_000);
    solve(f, date);
    expect(readBoard(date)?.solvedMs).toBe(40_000);
  });

  it("share copies a spoiler-free message with the time", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const date = today();
    const f = fresh();
    f.app.start();
    vi.advanceTimersByTime(154_000);
    solve(f, date);

    const btn = f.winOverlay.querySelector<HTMLButtonElement>(".win-share")!;
    btn.click();
    await vi.waitFor(() => expect(btn.textContent).toBe("Copied!"));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain(`Fishdoku #${puzzleNumber(date)}`);
    expect(text).toContain("2:34");
    expect(text).toContain(`#/${date}`);
  });
});
