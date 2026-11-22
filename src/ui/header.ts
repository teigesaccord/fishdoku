/**
 * Header view: ASCII title, puzzle number + date, a running timer, a solved
 * badge (tappable to reopen the win/share screen), and wired
 * prev/next buttons disabled at the available bounds. Navigation itself lives in
 * main (via the router); this module only reports tap events so it stays small
 * and testable. The clear button's two-tap confirmation lives in main too (8.2).
 */

import { formatTime } from "../share";

/** Decorative ASCII fish used as the app title. */
const TITLE_ART = "<<<[~fish~]>>>";

export interface HeaderModel {
  /** Local `YYYY-MM-DD` for the current puzzle. */
  readonly date: string;
  /** One-based puzzle number (#1 at launch). */
  readonly number: number;
  /** Whether the board is already solved (loaded from storage). */
  readonly solved: boolean;
  /** Whether an earlier playable puzzle exists. */
  readonly canPrev: boolean;
  /** Whether a later playable puzzle exists. */
  readonly canNext: boolean;
}

export interface HeaderControls {
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
}

export interface HeaderView {
  /** Update label, solved badge and nav-disabled state from the model. */
  render(model: HeaderModel): void;
  /** Register a handler fired when the previous-day button is tapped. */
  onPrev(handler: () => void): void;
  /** Register a handler fired when the next-day button is tapped. */
  onNext(handler: () => void): void;
  /** Update the timer readout (called every tick, so it touches only the timer). */
  setTime(ms: number | null): void;
  /** Register a handler fired when the solved badge is tapped. */
  onSolvedTap(handler: () => void): void;
}

/** Build the header once and return it for later state updates. */
export function initHeader(root: HTMLElement, controls: HeaderControls): HeaderView {
  const title = document.createElement("div");
  title.className = "fish-title";
  title.textContent = TITLE_ART;

  const sub = document.createElement("p");
  sub.className = "fish-sub";

  const timer = document.createElement("div");
  timer.className = "fish-timer";
  timer.setAttribute("aria-label", "Elapsed time");
  timer.setAttribute("role", "timer");

  const solvedBadge = document.createElement("button");
  solvedBadge.type = "button";
  solvedBadge.className = "solved-badge";
  solvedBadge.title = "Show result & share";
  solvedBadge.hidden = true;

  root.append(title, sub, timer, solvedBadge);

  const view: HeaderView = {
    render(model: HeaderModel) {
      sub.textContent = `Puzzle #${model.number} · ${model.date}`;
      solvedBadge.hidden = !model.solved;
      solvedBadge.textContent = model.solved ? "SOLVED ✓ · SHARE" : "";
      controls.prevBtn.disabled = !model.canPrev;
      controls.nextBtn.disabled = !model.canNext;
    },
    onPrev(handler: () => void) {
      controls.prevBtn.addEventListener("click", handler);
    },
    onNext(handler: () => void) {
      controls.nextBtn.addEventListener("click", handler);
    },
    setTime(ms: number | null) {
      const text = ms === null ? "" : formatTime(ms);
      if (timer.textContent !== text) timer.textContent = text;
    },
    onSolvedTap(handler: () => void) {
      solvedBadge.addEventListener("click", handler);
    },
  };

  return view;
}
