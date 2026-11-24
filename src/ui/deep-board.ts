/**
 * Deep Water board view: the stacked layers, drawn with one BoardController
 * each. Purely presentational; the tank, its rules and the player's cells live in
 * core/ and app.ts.
 *
 * Layout:
 *  - wide screens: both layers side by side, both playable.
 *  - narrow screens: a tab strip picks the full-size, playable layer; the other
 *    other shrinks to a read-only mini-map (tapping it switches to it).
 *
 * Cross-layer conflicts are computed here with `deepConflicts` and handed to each
 * layer's controller, and hovering or focusing a cell highlights the same pillar
 * in the other layers (including the mini-maps).
 */

import { CellState } from "../core/puzzle";
import type { DeepBoard, DeepPuzzle } from "../core/deep/puzzle";
import { LAYERS, LAYER_NAMES, layerBoard, layerPuzzle } from "../core/deep/puzzle";
import { deepConflicts } from "../core/deep/rules";
import { BoardController } from "./board";

/** Screens at least this wide show the layers side by side. */
export const WIDE_QUERY = "(min-width: 720px)";

/** ASCII labels for the layers, getting "deeper" with more waves. */
const LAYER_LABELS = ["~ surface ~", "~~~ deep ~~~"];

/**
 * Cell size formulas per layout role. The page gutter matches the classic 36px;
 * side by side there is a 20px gap and a 2px frame on each side of every layer.
 */
const CELL_WIDE = (n: number) =>
  `min((100vw - 36px - ${LAYERS - 1} * 20px - ${2 * LAYERS} * 2px) / ${LAYERS * n}, 48px)`;
const CELL_FULL = (n: number) => `min((100vw - 36px) / ${n}, 56px)`;
const CELL_MINI = (n: number) => `min((100vw - 36px) / ${2 * n}, 22px)`;

export interface DeepBoardRenderOptions {
  /** Stable seed for fish glyph direction. */
  readonly directionSeed?: string;
}

/** Whether the wide (side-by-side) layout applies; jsdom/no matchMedia counts as wide. */
function isWideScreen(win: Window): boolean {
  return typeof win.matchMedia !== "function" || win.matchMedia(WIDE_QUERY).matches;
}

export class DeepBoardView {
  private readonly controllers: BoardController[] = [];
  private readonly sections: HTMLElement[] = [];
  private readonly grids: HTMLElement[] = [];
  private readonly tabs: HTMLButtonElement[] = [];
  private tank: DeepPuzzle | null = null;
  private active = 0;
  private wide: boolean;

  constructor(
    private readonly root: HTMLElement,
    /** Fired with the flat tank index and the cell's new state. */
    onTap: (index: number, nextState: CellState) => void,
  ) {
    const win = root.ownerDocument.defaultView ?? window;
    this.wide = isWideScreen(win);
    root.classList.add("deep-tank");

    const tabStrip = document.createElement("div");
    tabStrip.className = "layer-tabs";
    tabStrip.setAttribute("role", "tablist");
    tabStrip.setAttribute("aria-label", "Tank layers");

    const layers = document.createElement("div");
    layers.className = "deep-layers";

    for (let L = 0; L < LAYERS; L++) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "layer-tab";
      tab.setAttribute("role", "tab");
      tab.textContent = LAYER_NAMES[L];
      tab.addEventListener("click", () => this.setActiveLayer(L));
      this.tabs.push(tab);
      tabStrip.append(tab);

      const section = document.createElement("section");
      section.className = "deep-layer";
      section.dataset.layer = String(L);
      const label = document.createElement("h2");
      label.className = "layer-name";
      label.textContent = LAYER_LABELS[L];
      const grid = document.createElement("div");
      grid.className = "layer-board";
      grid.setAttribute("role", "grid");
      grid.setAttribute("aria-label", `${LAYER_NAMES[L]} layer`);
      section.append(label, grid);

      // A mini-map is read-only: swallow presses before the board sees them,
      // and treat a tap on it as "switch to this layer".
      const guard = (e: Event) => {
        if (!this.isMini(L)) return;
        e.stopPropagation();
        e.preventDefault();
        if (e.type === "click") this.setActiveLayer(L);
      };
      section.addEventListener("pointerdown", guard, true);
      section.addEventListener("click", guard, true);

      const area = () => (this.tank ? this.tank.size * this.tank.size : 0);
      const controller = new BoardController(grid, (i, state) => onTap(L * area() + i, state));
      controller.onHover((i) => this.highlightPillar(L, i));

      this.controllers.push(controller);
      this.sections.push(section);
      this.grids.push(grid);
      layers.append(section);
    }

    root.replaceChildren(tabStrip, layers);

    if (typeof win.matchMedia === "function") {
      win.matchMedia(WIDE_QUERY).addEventListener?.("change", (e) => {
        this.wide = e.matches;
        this.applyLayout();
      });
    }
    this.applyLayout();
  }

  /** The layer currently shown full size on narrow screens. */
  get activeLayer(): number {
    return this.active;
  }

  /** Configure every layer grid for a tank. */
  setPuzzle(tank: DeepPuzzle): void {
    this.tank = tank;
    for (let L = 0; L < LAYERS; L++) this.controllers[L].setPuzzle(layerPuzzle(tank, L));
    this.applyLayout();
  }

  /** Render a tank: per-layer glyphs plus cross-layer conflicts. */
  render(board: DeepBoard, options: DeepBoardRenderOptions = {}): void {
    if (!this.tank) return;
    const area = this.tank.size * this.tank.size;
    const conflicts = deepConflicts(this.tank, board);
    const perLayer: Set<number>[] = Array.from({ length: LAYERS }, () => new Set<number>());
    for (const i of conflicts) perLayer[Math.floor(i / area)].add(i % area);
    for (let L = 0; L < LAYERS; L++) {
      this.controllers[L].render(layerBoard(board, L), {
        directionSeed: options.directionSeed ? `${options.directionSeed}:${L}` : undefined,
        conflictSet: perLayer[L],
      });
    }
  }

  /** Show a layer full size (narrow screens) and mark its tab. */
  setActiveLayer(layer: number): void {
    this.active = layer;
    this.applyLayout();
  }

  /** Whether a layer is currently a read-only mini-map. */
  private isMini(layer: number): boolean {
    return !this.wide && layer !== this.active;
  }

  /** Highlight `index` (local to `from`) in every other layer; -1 clears all. */
  private highlightPillar(from: number, index: number): void {
    for (let L = 0; L < LAYERS; L++) this.controllers[L].setHighlight(L === from ? -1 : index);
  }

  /** Apply the wide/narrow layout: roles, cell sizes, tabs and accessibility. */
  private applyLayout(): void {
    const n = this.tank?.size ?? 8;
    this.root.dataset.layout = this.wide ? "wide" : "narrow";
    for (let L = 0; L < LAYERS; L++) {
      const mini = this.isMini(L);
      const role = this.wide ? "wide" : mini ? "mini" : "full";
      const section = this.sections[L];
      section.dataset.role = role;
      const grid = this.grids[L];
      const cell = role === "wide" ? CELL_WIDE(n) : role === "mini" ? CELL_MINI(n) : CELL_FULL(n);
      grid.style.setProperty("--cell", cell);
      // Mini-maps are pictures, not controls: keep them out of the tab order.
      if (mini) section.setAttribute("aria-hidden", "true");
      else section.removeAttribute("aria-hidden");
      for (const btn of Array.from(grid.querySelectorAll<HTMLButtonElement>("button.board-cell"))) {
        btn.tabIndex = mini ? -1 : 0;
      }
      const tab = this.tabs[L];
      tab.setAttribute("aria-selected", String(L === this.active));
      tab.tabIndex = L === this.active ? 0 : -1;
    }
  }
}
