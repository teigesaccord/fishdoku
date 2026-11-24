/**
 * Fishdoku application orchestration: wire the pure core to the UI.
 *
 * All rule logic, puzzle generation and daily mapping live in core/. This module
 * owns only state and flow for one running app instance: pick the playable mode
 * and date, load its puzzle + board from storage, render through the UI modules,
 * save on every change, and react to navigation. It is exposed as a factory so
 * tests can construct an isolated instance against their own DOM instead of
 * hitting global state at import time. The production entry point (`main.ts`)
 * collects the real DOM elements, hands them in, and calls `start()`.
 *
 * Two modes share this one flow (timer, clear confirmation, win lock, saving):
 * Classic and Deep Water. What differs between them (generating the puzzle,
 * drawing the board, judging a solve) lives behind a small `ModeAdapter`.
 */

import type { Puzzle } from "./core/puzzle";
import { CellState, decodeCells } from "./core/puzzle";
import { generate } from "./core/generator";
import { isSolved } from "./core/rules";
import type { DeepPuzzle } from "./core/deep/puzzle";
import { tankCellCount } from "./core/deep/puzzle";
import { generateDeep } from "./core/deep/generator";
import { isDeepSolved } from "./core/deep/rules";
import type { Mode } from "./core/daily";
import {
  canNextFor,
  canPrevFor,
  isPlayable,
  numberFor,
  seedFor,
  sizeFor,
  today,
  versionFor,
} from "./core/daily";
import { readBoard, writeBoard } from "./storage";
import { currentRoute, navigateTo, redirectToAvailable } from "./router";
import { BoardController } from "./ui/board";
import { DeepBoardView } from "./ui/deep-board";
import type { HeaderModel } from "./ui/header";
import { initHeader } from "./ui/header";
import { initWin } from "./ui/win";
import type { WinModel } from "./ui/win";
import { copyToClipboard, shareText } from "./share";

/** How often the on-screen timer is refreshed. */
const TICK_MS = 250;

/** The DOM elements the app owns, collected by the entry point. */
export interface AppElements {
  readonly boardRoot: HTMLElement;
  readonly headerRoot: HTMLElement;
  readonly prevBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;
  readonly clearBtn: HTMLButtonElement;
  readonly winOverlay: HTMLElement;
  /**
   * Container for the Deep Water tank, shown instead of `boardRoot` in Deep
   * mode. Created next to `boardRoot` when the entry point does not supply one.
   */
  readonly deepRoot?: HTMLElement;
}

/** Handle returned to the entry point and to tests. */
export interface App {
  /** Bootstrap: ensure a valid date, load it, and follow browser back/forward. */
  start(): void;
  /** The current playable date (readable by tests). */
  currentDate: () => string;
  /** The current mode (readable by tests). */
  currentMode: () => Mode;
  /** Switch to a mode, keeping the date when it is playable there (else today). */
  switchMode(mode: Mode): void;
  /** Reset the current date's board to empty so it can be replayed. */
  clear(): void;
  /**
   * Install the two-tap "really clear?" confirmation on today's clear button.
   * `handler` runs only on the second tap within a few-second window. Tests may
   * instead dispatch clicks directly on the button element they passed in.
   */
  onClearTap(handler: () => void): void;
}

/** What differs between Classic and Deep Water for one loaded date. */
interface ModeAdapter {
  /** Generate the puzzle for a date, configure its board view and return the cell count. */
  setup(date: string): number;
  /** Draw the player's cells. */
  render(cells: CellState[], date: string): void;
  /** Whether the cells solve the loaded puzzle. */
  isSolved(cells: CellState[]): boolean;
  /** Show this mode's board and hide the other one. */
  show(): void;
}

/** Build an isolated app instance from its DOM elements (does not start it). */
export function createApp(elements: AppElements): App {
  const { boardRoot, headerRoot, prevBtn, nextBtn, clearBtn, winOverlay } = elements;

  /** Deep Water container: supplied, or created right after the classic board. */
  const deepRoot =
    elements.deepRoot ??
    (() => {
      const el = document.createElement("div");
      el.id = "deep-board";
      boardRoot.insertAdjacentElement("afterend", el);
      return el;
    })();
  deepRoot.hidden = true;

  /** One controller reused across dates; it resizes its grid when the size changes. */
  const board = new BoardController(boardRoot, onTap);
  /** The Deep Water view is built on first use so Classic-only sessions never pay for it. */
  let deepView: DeepBoardView | null = null;

  const headerView = initHeader(headerRoot, { prevBtn, nextBtn });
  headerView.onPrev(() => goToRelative(-1));
  headerView.onNext(() => goToRelative(1));
  headerView.onModeChange((target) => switchMode(target));
  const winView = initWin(winOverlay);
  winView.onDismiss(() => {
    if (solved) hideAndLockSolved();
  });
  winView.onShare(() =>
    copyToClipboard(
      shareText({
        mode,
        number: numberFor(mode, current),
        date: current,
        size: sizeFor(mode, current),
        solvedMs,
        baseUrl: window.location.origin + window.location.pathname,
      }),
    ),
  );
  headerView.onSolvedTap(() => {
    if (solved) showWin();
  });

  /** The player's board for the current date, plus whether it is solved. */
  let cells: CellState[] = [];
  let solved = false;
  let current = "";
  let mode: Mode = "classic";

  /** The classic puzzle backing `current`; cached so taps never regenerate a size-11 grid. */
  let currentPuzzle: Puzzle | null = null;
  /** The Deep Water tank backing `current` in Deep mode. */
  let currentTank: DeepPuzzle | null = null;

  const adapters: Record<Mode, ModeAdapter> = {
    classic: {
      setup(date) {
        const size = sizeFor("classic", date);
        currentPuzzle = generate(versionFor("classic", date), seedFor("classic", date), size);
        board.setPuzzle(currentPuzzle);
        return size * size;
      },
      render(c, date) {
        const size = currentPuzzle?.size ?? sizeFor("classic", date);
        board.render({ size, cells: c }, { directionSeed: date });
      },
      isSolved(c) {
        const size = currentPuzzle?.size ?? sizeFor("classic", current);
        const pondLayout = currentPuzzle?.ponds ?? new Array(size).fill(0);
        return isSolved({ size, ponds: pondLayout }, { size, cells: c });
      },
      show() {
        boardRoot.hidden = false;
        deepRoot.hidden = true;
      },
    },
    deep: {
      setup(date) {
        const size = sizeFor("deep", date);
        currentTank = generateDeep(versionFor("deep", date), seedFor("deep", date), size);
        deepView ??= new DeepBoardView(deepRoot, onTap);
        deepView.setPuzzle(currentTank);
        return tankCellCount(size);
      },
      render(c, date) {
        if (!deepView || !currentTank) return;
        deepView.render({ size: currentTank.size, cells: c }, { directionSeed: date });
      },
      isSolved(c) {
        return currentTank !== null && isDeepSolved(currentTank, { size: currentTank.size, cells: c });
      },
      show() {
        boardRoot.hidden = true;
        deepRoot.hidden = false;
      },
    },
  };

  /** The adapter for the current mode. */
  function adapter(): ModeAdapter {
    return adapters[mode];
  }

  // Solve timer. Time accrues only while the current date is on screen, unsolved
  // and the tab is visible; it is persisted with the board so reloads and
  // switching days pick up where the player left off.
  /** Time banked on this board, excluding the segment currently running. */
  let elapsedMs = 0;
  /** `Date.now()` when the running segment started, or null while paused. */
  let runningSince: number | null = null;
  /** The official first-solve time; replays after a clear never change it. */
  let solvedMs: number | null = null;

  /** Total time on this board including the running segment. */
  function totalElapsed(): number {
    return elapsedMs + (runningSince === null ? 0 : Date.now() - runningSince);
  }

  /** Bank the running segment and stop the clock. */
  function pauseClock(): void {
    elapsedMs = totalElapsed();
    runningSince = null;
  }

  /** Start the clock if the board is unsolved and the page is visible. */
  function resumeClock(): void {
    if (solved || runningSince !== null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    runningSince = Date.now();
  }

  /** Refresh the header readout: live time while playing, official time once solved. */
  function renderTime(): void {
    headerView.setTime(solved ? solvedMs : totalElapsed());
  }

  /** Build and load the puzzle + board for a playable date in a mode. */
  function load(nextMode: Mode, date: string): void {
    // Bank and save the time spent on the board we are leaving (in its own mode).
    if (current !== "") {
      pauseClock();
      persist();
    }
    mode = nextMode;
    current = date;
    const count = adapter().setup(date);
    adapter().show();

    const stored = readBoard(date, mode);
    // A stored board of the wrong length (e.g. saved by the old, broken clear)
    // cannot be mapped onto the grid, so start that date fresh instead.
    if (stored && stored.cells.length === count) {
      cells = decodeCells(stored.cells);
      solved = stored.solved;
      elapsedMs = stored.elapsedMs;
      solvedMs = stored.solvedMs;
    } else {
      cells = emptyCells(count);
      solved = false;
      elapsedMs = 0;
      solvedMs = null;
    }
    runningSince = null;
    resumeClock();

    adapter().render(cells, current);
    headerView.render(headerModel());
    renderTime();
    // A date that was already solved shows the solved board and the header
    // indicator, but does NOT replay the win overlay (spec: revisit a solved
    // puzzle without replaying the win screen; task 8.3).
  }

  /** The header model for the current date. */
  function headerModel(): HeaderModel {
    return {
      date: current,
      number: numberFor(mode, current),
      solved,
      canPrev: canPrevFor(mode, current),
      canNext: canNextFor(mode, current),
      mode,
    };
  }

  /** Show the win overlay for the solved board. */
  function showWin(replayMs: number | null = null): void {
    winView.show({
      date: current,
      number: numberFor(mode, current),
      solvedMs,
      replayMs,
      mode,
    } satisfies WinModel);
  }

  /** Persist the current board to storage. */
  function persist(): void {
    writeBoard(
      current,
      {
        size: sizeFor(mode, current),
        cells,
        solved,
        elapsedMs: totalElapsed(),
        solvedMs,
      },
      mode,
    );
  }

  /** Handle a tap that advances `index` to `nextState`; only acts when unsolved. */
  function onTap(index: number, nextState: CellState): void {
    if (solved) return; // solved boards are locked for replay
    cells[index] = nextState;
    persist();
    adapter().render(cells, current);
    checkWin();
  }

  /** Mark the board solved and show the win overlay when complete. */
  function checkWin(): void {
    if (solved) return;
    if (adapter().isSolved(cells)) {
      pauseClock();
      solved = true;
      if (solvedMs === null) solvedMs = elapsedMs;
      persist();
      adapter().render(cells, current);
      headerView.render(headerModel());
      renderTime();
      showWin(elapsedMs);
    }
  }

  /** Hide the overlay and keep a solved board locked so it cannot be retapped into. */
  function hideAndLockSolved(): void {
    winView.hide();
    // The lock lives in `solved`; navigation to another date rebuilds state in
    // load(), so there is nothing else to do here.
  }

  /** A fresh, untouched board: every cell empty. */
  function emptyCells(count: number): CellState[] {
    return new Array(count).fill(CellState.EMPTY);
  }

  /**
   * Reset the current board to how the player started it and allow replay
   * (used by the clear button). Every cell is reset: N*N for Classic, every
   * layer for Deep Water.
   */
  function clear(): void {
    // Clearing mid-attempt keeps the clock running (no free restarts). Once the
    // puzzle has been solved, a clear starts a fresh, unofficial replay timer;
    // the official solvedMs is untouched.
    if (solvedMs !== null) {
      elapsedMs = 0;
      runningSince = null;
    }
    solved = false;
    resumeClock();
    cells = emptyCells(cells.length);
    persist();
    adapter().render(cells, current);
    headerView.render(headerModel());
    renderTime();
    winView.hide();
  }

  // Two-tap "really clear?" confirmation (task 8.2): the first tap asks for
  // confirmation and reverts after a window; the second tap within it invokes
  // the handler. No browser dialog is used.
  const CLEAR_WINDOW_MS = 3000;
  let clearDeadline = 0; // 0 = no pending confirmation
  function onClearTap(handler: () => void): void {
    clearBtn.addEventListener("click", () => {
      const now = Date.now();
      if (clearDeadline !== 0 && now <= clearDeadline) {
        clearDeadline = 0;
        clearBtn.textContent = "Clear";
        delete clearBtn.dataset.confirm;
        handler();
        return;
      }
      clearDeadline = now + CLEAR_WINDOW_MS;
      clearBtn.textContent = "really clear?";
      clearBtn.dataset.confirm = "";
      setTimeout(() => {
        if (clearDeadline !== 0 && Date.now() >= clearDeadline) {
          clearDeadline = 0;
          clearBtn.textContent = "Clear";
          delete clearBtn.dataset.confirm;
        }
      }, CLEAR_WINDOW_MS);
    });
  }

  /** Navigate relative to the current date by whole days, then load the target date. */
  function goToRelative(delta: number): void {
    const [y, m, d] = current.split("-").map(Number);
    if (Number.isNaN(y)) return;
    // Build in local time and move within local space so the result matches
    // `localIso`'s local getters. Constructing from `Date.UTC(...)` then reading
    // `getDate()` shifts by a whole day whenever the local zone is behind UTC,
    // which would send navigation to the wrong puzzle.
    const off = new Date(y, m - 1, d);
    off.setDate(off.getDate() + delta);
    navigateTo(localIso(off), mode);
    const route = currentRoute();
    load(route.mode, route.date);
  }

  /** Switch modes, keeping the current date when it is playable there (else today). */
  function switchMode(target: Mode): void {
    if (target === mode) return;
    const date = isPlayable(target, current) ? current : today();
    navigateTo(date, target);
    const route = currentRoute();
    load(route.mode, route.date);
  }

  /** Format a Date as `YYYY-MM-DD` in local time. */
  function localIso(date: Date): string {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, "0")}-` +
      `${String(date.getDate()).padStart(2, "0")}`
    );
  }

  /** Reload for whatever mode and date the URL now points at (back/forward, deep links). */
  function handleUrl(): void {
    const route = currentRoute();
    if (route.mode !== mode || route.date !== current) load(route.mode, route.date);
  }

  const app: App = {
    currentDate: () => current,
    currentMode: () => mode,
    switchMode,
    start() {
      redirectToAvailable();
      const route = currentRoute();
      load(route.mode, route.date);
      window.addEventListener("hashchange", handleUrl);
      // pushState is silent across browsers; popstate covers browser back/forward.
      window.addEventListener("popstate", handleUrl);
      // Pause while the tab is hidden and save on the way out so closing the
      // tab neither loses time nor keeps counting.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          pauseClock();
          persist();
        } else {
          resumeClock();
        }
      });
      window.addEventListener("pagehide", () => {
        pauseClock();
        persist();
      });
      setInterval(renderTime, TICK_MS);
    },
    clear,
    onClearTap,
  };

  return app;
}
