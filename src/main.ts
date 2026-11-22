/**
 * Fishdoku entry point: collect the real DOM elements, then hand them to the app
 * factory and start it. The two-tap clear confirmation lives in `app.ts` as part
 * of the running instance so today's board is actually reset on confirm.
 *
 * Orchestration (puzzle generation, daily mapping, rule logic) all lives in
 * core/; this module only binds production element IDs and boots one instance.
 */

import "./ui/theme.css";
import { createApp } from "./app";
import { initHelp } from "./ui/help";

const getElement = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as HTMLElement;
};

function collect() {
  return {
    boardRoot: getElement("board"),
    headerRoot: getElement("fishdoku-header"),
    prevBtn: getElement("prev-day") as HTMLButtonElement,
    nextBtn: getElement("next-day") as HTMLButtonElement,
    clearBtn: getElement("clear-btn") as HTMLButtonElement,
    winOverlay: getElement("win-overlay"),
  };
}

const runtime = createApp(collect());

// Two-tap "really clear?" confirmation (task 8.2): reset today's board so it can
// be replayed. The window + label revert live inside the running instance.
runtime.onClearTap(() => runtime.clear());

runtime.start();

initHelp(getElement("help-overlay"), getElement("help-btn") as HTMLButtonElement);
