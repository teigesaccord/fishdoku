/**
 * Solve-time formatting and the Wordle-style share message.
 *
 * The share text never reveals fish positions: it only carries the puzzle
 * number, grid size, solve time and a link back to that day's puzzle, so it is
 * safe to paste into a group chat before everyone has played.
 */

/** Format milliseconds as `m:ss`, or `h:mm:ss` from one hour up. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export interface ShareModel {
  /** One-based puzzle number. */
  readonly number: number;
  /** Local `YYYY-MM-DD` of the puzzle. */
  readonly date: string;
  /** Grid side length N. */
  readonly size: number;
  /** First-solve time in ms, or null for boards solved before the timer existed. */
  readonly solvedMs: number | null;
  /** Absolute URL of the page (without hash); the date is appended as `#/date`. */
  readonly baseUrl: string;
}

/** Build the clipboard message for a solved puzzle. */
export function shareText(model: ShareModel): string {
  const lines = [`Fishdoku #${model.number} 🐟 ${model.size}×${model.size}`];
  if (model.solvedMs !== null) lines.push(`⏱️ ${formatTime(model.solvedMs)}`);
  lines.push(`${model.baseUrl}#/${model.date}`);
  return lines.join("\n");
}

/**
 * Copy text to the clipboard. Uses the async Clipboard API when available and
 * falls back to a hidden textarea + `execCommand("copy")` for older browsers
 * and non-secure contexts. Resolves to whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
