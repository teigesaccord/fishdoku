/**
 * Win view: an in-page, dismissible overlay (no browser alert) showing an ASCII
 * fish, the date or puzzle number, the solve time and a Share button that copies
 * a Wordle-style message to the clipboard. The board is locked by the owner once a
 * board is solved; this module only owns show/hide and dismissal. The owner
 * decides whether to replay on revisit so it never forces a popup when a player
 * reopens an already-solved date (task 8.3).
 */

import { formatTime } from "../share";

export interface WinModel {
  /** Local `YYYY-MM-DD` of the solved puzzle. */
  readonly date: string;
  /** One-based puzzle number that was solved. */
  readonly number: number;
  /** Official (first-solve) time in ms, or null if the solve was never timed. */
  readonly solvedMs: number | null;
  /** This attempt's time in ms when it differs from the official one (a replay). */
  readonly replayMs?: number | null;
  /** Which daily puzzle was solved; Classic when omitted. */
  readonly mode?: "classic" | "deep";
}

/** How long the "Copied!" confirmation stays on the Share button. */
const SHARE_FEEDBACK_MS = 2000;

/** ASCII fish glyph shown at the top of the overlay. */
const WIN_FISH = "<<<[~fish~]>>>";

export interface WinView {
  /** Show the overlay for a solved board. */
  show(model: WinModel): void;
  /** Hide the overlay. */
  hide(): void;
  /** Register a handler fired when the overlay is dismissed. */
  onDismiss(handler: () => void): void;
  /** Register the share action; it resolves to whether the copy succeeded. */
  onShare(handler: () => Promise<boolean>): void;
}

/** Wire up the win overlay element and return its controls. */
export function initWin(overlay: HTMLElement): WinView {
  const body = document.createElement("div");
  body.className = "win-box";

  const art = document.createElement("pre");
  art.textContent = WIN_FISH;

  const message = document.createElement("div");
  message.className = "fish-sub";

  const time = document.createElement("div");
  time.className = "win-time";

  const replay = document.createElement("div");
  replay.className = "fish-sub win-replay";

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "win-share";
  shareBtn.textContent = "Share";

  const hint = document.createElement("p");
  hint.className = "win-hint";
  hint.textContent = "tap outside to close";

  body.append(art, message, time, replay, shareBtn, hint);
  overlay.appendChild(body);

  let shareHandler: (() => Promise<boolean>) | null = null;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  shareBtn.addEventListener("click", async () => {
    if (!shareHandler) return;
    const ok = await shareHandler();
    shareBtn.textContent = ok ? "Copied!" : "Copy failed";
    shareBtn.toggleAttribute("data-copied", ok);
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      shareBtn.textContent = "Share";
      shareBtn.removeAttribute("data-copied");
    }, SHARE_FEEDBACK_MS);
  });

  const view: WinView = {
    show(model: WinModel) {
      const name = model.mode === "deep" ? "Deep" : "Puzzle";
      message.textContent = `${name} #${model.number} (${model.date}) solved!`;
      time.textContent = model.solvedMs !== null ? `⏱️ ${formatTime(model.solvedMs)}` : "";
      time.hidden = model.solvedMs === null;
      const isReplay = model.replayMs != null && model.replayMs !== model.solvedMs;
      replay.textContent = isReplay ? `this replay: ${formatTime(model.replayMs!)}` : "";
      replay.hidden = !isReplay;
      clearTimeout(feedbackTimer);
      shareBtn.textContent = "Share";
      shareBtn.removeAttribute("data-copied");
      overlay.classList.remove("win-hidden");
    },
    hide() {
      overlay.classList.add("win-hidden");
    },
    onDismiss(handler: () => void) {
      // Tap anywhere on the backdrop (not the box itself) to dismiss.
      overlay.addEventListener("click", (event: MouseEvent) => {
        if (event.target === overlay) handler();
      });
    },
    onShare(handler: () => Promise<boolean>) {
      shareHandler = handler;
    },
  };

  return view;
}
