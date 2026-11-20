/**
 * Win view: an in-page, dismissible overlay (no browser alert) showing an ASCII
 * fish and the date or puzzle number. The board is locked by the owner once a
 * board is solved; this module only owns show/hide and dismissal. The owner
 * decides whether to replay on revisit so it never forces a popup when a player
 * reopens an already-solved date (task 8.3).
 */

export interface WinModel {
  /** Local `YYYY-MM-DD` of the solved puzzle. */
  readonly date: string;
  /** One-based puzzle number that was solved. */
  readonly number: number;
}

/** ASCII fish glyph shown at the top of the overlay. */
const WIN_FISH = "<<<[~fish~]>>>";

export interface WinView {
  /** Show the overlay for a solved board. */
  show(model: WinModel): void;
  /** Hide the overlay. */
  hide(): void;
  /** Register a handler fired when the overlay is dismissed. */
  onDismiss(handler: () => void): void;
}

/** Wire up the win overlay element and return its controls. */
export function initWin(overlay: HTMLElement): WinView {
  const body = document.createElement("div");
  body.className = "win-box";

  const art = document.createElement("pre");
  art.textContent = WIN_FISH;

  const message = document.createElement("div");
  message.className = "fish-sub";

  body.append(art, message);
  overlay.appendChild(body);

  const view: WinView = {
    show(model: WinModel) {
      message.textContent = `Puzzle #${model.number} (${model.date}) solved!`;
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
  };

  return view;
}
