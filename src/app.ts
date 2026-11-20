/**
 * Fishdoku application orchestration: wire the pure core to the UI.
 *
 * All rule logic, puzzle generation and daily mapping live in core/. This module
 * owns only state and flow for one running app instance: pick the playable date,
 * load its puzzle + board from storage, render through the UI modules, save on
 * every change, and react to navigation. It is exposed as a factory so tests can
 * construct an isolated instance against their own DOM instead of hitting global
 * state at import time. The production entry point (`main.ts`) collects the real
 * DOM elements, hands them in, and calls `start()`.
 */

import type { Puzzle } from "./core/puzzle";
import { CellState, decodeCells } from "./core/puzzle";
import { generate } from "./core/generator";
import { isSolved } from "./core/rules";
import {
  canNext,
  canPrev,
  puzzleNumber,
  puzzleSize,
  seedForDate,
} from "./core/daily";
import { readBoard, writeBoard } from "./storage";
import { currentDate, navigateTo, redirectToAvailable } from "./router";
import { BoardController } from "./ui/board";
import type { HeaderModel } from "./ui/header";
import { initHeader } from "./ui/header";
import { initWin } from "./ui/win";
import type { WinModel } from "./ui/win";

/** The DOM elements the app owns, collected by the entry point. */
export interface AppElements {
  readonly boardRoot: HTMLElement;
  readonly headerRoot: HTMLElement;
  readonly prevBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;
  readonly clearBtn: HTMLButtonElement;
  readonly winOverlay: HTMLElement;
}

/** Handle returned to the entry point and to tests. */
export interface App {
  /** Bootstrap: ensure a valid date, load it, and follow browser back/forward. */
  start(): void;
  /** The current playable date (readable by tests). */
  currentDate: () => string;
  /** Reset the current date's board to empty so it can be replayed. */
  clear(): void;
  /**
   * Install the two-tap "really clear?" confirmation on today's clear button.
   * `handler` runs only on the second tap within a few-second window. Tests may
   * instead dispatch clicks directly on the button element they passed in.
   */
  onClearTap(handler: () => void): void;
}

/** Build an isolated app instance from its DOM elements (does not start it). */
export function createApp(elements: AppElements): App {
  const { boardRoot, headerRoot, prevBtn, nextBtn, clearBtn, winOverlay } = elements;

  /** One controller reused across dates; it resizes its grid when the size changes. */
  const board = new BoardController(boardRoot, onTap);
  const headerView = initHeader(headerRoot, { prevBtn, nextBtn });
  headerView.onPrev(() => goToRelative(-1));
  headerView.onNext(() => goToRelative(1));
  const winView = initWin(winOverlay);
  winView.onDismiss(() => {
    if (solved) hideAndLockSolved();
  });

  /** The player's board for the current date, plus whether it is solved. */
  let cells: CellState[] = [];
  let solved = false;
  let current = "";
  /** The puzzle backing `current`; cached so taps never regenerate a size-11 grid. */
  let currentPuzzle: Puzzle | null = null;

  /** Build and load the puzzle + board for a specific playable date. */
  function loadDate(date: string): void {
    current = date;
    const size = puzzleSize(date);
    currentPuzzle = generate("v1", seedForDate(date), size);
    board.setPuzzle(currentPuzzle);

    const stored = readBoard(date);
    if (stored) {
      cells = decodeCells(stored.cells);
      solved = stored.solved;
    } else {
      cells = new Array(size * size).fill(CellState.EMPTY);
      solved = false;
    }

    board.render({ size, cells }, { directionSeed: current });
    headerView.render(headerModel());
    // A date that was already solved shows the solved board and the header
    // indicator, but does NOT replay the win overlay (spec: revisit a solved
    // puzzle without replaying the win screen; task 8.3).
  }

  /** The header model for the current date. */
  function headerModel(): HeaderModel {
    return {
      date: current,
      number: puzzleNumber(current),
      solved,
      canPrev: canPrev(current),
      canNext: canNext(current),
    };
  }

  /** Show the win overlay for the solved board. */
  function showWin(): void {
    winView.show({ date: current, number: puzzleNumber(current) } satisfies WinModel);
  }

  /** Persist the current board to storage. */
  function persist(): void {
    writeBoard(current, { size: puzzleSize(current), cells, solved });
  }

  /** Handle a tap that advances `index` to `nextState`; only acts when unsolved. */
  function onTap(index: number, nextState: CellState): void {
    if (solved) return; // solved boards are locked for replay
    cells[index] = nextState;
    persist();
    board.render({ size: puzzleSize(current), cells }, { directionSeed: current });
    checkWin();
  }

  /** Mark the board solved and show the win overlay when complete. */
  function checkWin(): void {
    if (solved) return;
    const size = currentPuzzle?.size ?? puzzleSize(current);
    const pondLayout = currentPuzzle?.ponds ?? new Array(size).fill(0);
    if (isSolved({ size, ponds: pondLayout }, { size, cells })) {
      solved = true;
      persist();
      board.render({ size, cells }, { directionSeed: current });
      headerView.render(headerModel());
      showWin();
    }
  }

  /** Hide the overlay and keep a solved board locked so it cannot be retapped into. */
  function hideAndLockSolved(): void {
    winView.hide();
    // The lock lives in `solved`; navigation to another date rebuilds state in
    // loadDate(), so there is nothing else to do here.
  }

  /** Reset the current board to empty and allow replay (used by the clear button). */
  function clear(): void {
    solved = false;
    const size = puzzleSize(current);
    cells = new Array(size).fill(CellState.EMPTY);
    persist();
    board.render({ size, cells }, { directionSeed: current });
    headerView.render(headerModel());
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
        handler();
        return;
      }
      clearDeadline = now + CLEAR_WINDOW_MS;
      clearBtn.textContent = "really clear?";
      setTimeout(() => {
        if (clearDeadline !== 0 && Date.now() >= clearDeadline) {
          clearDeadline = 0;
          clearBtn.textContent = "Clear";
        }
      }, CLEAR_WINDOW_MS);
    });
  }

  /** Navigate relative to today by whole days, then load the target date. */
  function goToRelative(delta: number): void {
    const [y, m, d] = current.split("-").map(Number);
    if (Number.isNaN(y)) return;
    // Build in local time and move within local space so the result matches
    // `localIso`'s local getters. Constructing from `Date.UTC(...)` then reading
    // `getDate()` shifts by a whole day whenever the local zone is behind UTC,
    // which would send navigation to the wrong puzzle.
    const off = new Date(y, m - 1, d);
    off.setDate(off.getDate() + delta);
    navigateTo(localIso(off));
    loadDate(currentDate());
  }

  /** Format a Date as `YYYY-MM-DD` in local time. */
  function localIso(date: Date): string {
    return (
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, "0")}-` +
      `${String(date.getDate()).padStart(2, "0")}`
    );
  }

  /** Reload for whatever date the URL now points at (browser back/forward, deep links). */
  function handleUrl(): void {
    const next = currentDate();
    if (next !== current) loadDate(next);
  }

  const app: App = {
    currentDate: () => current,
    start() {
      redirectToAvailable();
      loadDate(currentDate());
      window.addEventListener("hashchange", handleUrl);
      // pushState is silent across browsers; popstate covers browser back/forward.
      window.addEventListener("popstate", handleUrl);
    },
    clear,
    onClearTap,
  };

  return app;
}

