/**
 * Header view: ASCII title, a Classic / Deep mode switch, puzzle number + date,
 * a running timer, a solved
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
  /** Which daily puzzle is shown; Classic when omitted. */
  readonly mode?: "classic" | "deep";
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
  /** Register a handler fired when the player picks a mode in the mode switch. */
  onModeChange(handler: (mode: "classic" | "deep") => void): void;
}

/** The two modes in switch order, with their button labels. */
const MODES: ReadonlyArray<{ readonly mode: "classic" | "deep"; readonly label: string }> = [
  { mode: "classic", label: "Classic" },
  { mode: "deep", label: "Deep" },
];

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

  // Mode switch: a two-button segmented control (Classic / Deep).
  const modeSwitch = document.createElement("div");
  modeSwitch.className = "mode-switch";
  modeSwitch.setAttribute("role", "group");
  modeSwitch.setAttribute("aria-label", "Puzzle mode");
  const modeButtons = MODES.map(({ mode, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-btn";
    btn.dataset.mode = mode;
    btn.textContent = label;
    btn.setAttribute("aria-pressed", String(mode === "classic"));
    modeSwitch.append(btn);
    return btn;
  });

  root.append(title, modeSwitch, sub, timer, solvedBadge);

  const view: HeaderView = {
    render(model: HeaderModel) {
      const deep = model.mode === "deep";
      sub.textContent = `${deep ? "Deep" : "Puzzle"} #${model.number} · ${model.date}`;
      for (const btn of modeButtons) {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === (model.mode ?? "classic")));
      }
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
    onModeChange(handler: (mode: "classic" | "deep") => void) {
      for (const btn of modeButtons) {
        btn.addEventListener("click", () => handler(btn.dataset.mode as "classic" | "deep"));
      }
    },
  };

  return view;
}
