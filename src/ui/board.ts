/**
 * Board view: renders a puzzle as a CSS grid of <button> cells and reports the
 * per-cell tap cycle. Purely presentational input glue; all rule logic lives in
 * core/ (rules.conflicts / isSolved) and the player's board lives in app.ts,
 * which this controller reflects on every render(). The controller owns its cell
 * buttons for a single board, so it need not be rebuilt when the date or board
 * changes: setPuzzle reconfigures the grid size, the responsive cell size and
 * per-cell borders/textures/pond ids, and render() refreshes glyphs, states,
 * conflicts and accessible labels.
 */

import type { Puzzle, Board } from "../core/puzzle";
import { CellState, rowOf, colOf } from "../core/puzzle";
import { conflicts } from "../core/rules";
import { assignPondStyles, TEXTURES } from "./pond-colors";

/** The three cell states in tap-cycle order: empty -> ruled out (x) -> fish. */
const CYCLE: CellState[] = [CellState.EMPTY, CellState.RULED_OUT, CellState.FISH];

/** How many texture characters fill an empty cell. */
export const EMPTY_FILL = 3;

/** Border colour for a side: the heavier pond boundary, or the light grid line. */
function edgeColor(px: number): string {
  return px > 1 ? "var(--pond-line)" : "var(--grid-line)";
}

export interface RenderOptions {
  /** Stable seed for choosing "><>" vs "<><" direction; hash of (date, row, col). */
  readonly directionSeed?: string;
  /**
   * Fish indices (local to this grid) to show in the conflict style. When given
   * it replaces the classic rule check, so a multi-layer owner can pass
   * conflicts that involve other grids. Omitted for Classic.
   */
  readonly conflictSet?: ReadonlySet<number>;
}

export interface BoardControllerLike {
  render(board: Board, options?: RenderOptions): void;
}

/**
 * An in-progress press on the board. A press that stays on its starting cell
 * is a normal tap (one step of the cycle) on release. Once it moves onto a
 * second cell it becomes a drag that "paints" one mark: starting on an empty
 * cell crosses off (x) every empty cell it passes; starting on an x erases
 * every x it passes. Fish are never painted or erased by a drag.
 */
interface Press {
  readonly pointerId: number;
  readonly start: number;
  /** null until the press leaves its starting cell; then the paint mode. */
  mode: { from: CellState; to: CellState } | null;
  /** Set when the press started on a fish: it can only ever be a tap. */
  readonly tapOnly: boolean;
}

export class BoardController {
  private puzzle: Puzzle | null = null;
  private cells: HTMLButtonElement[] = [];
  /** The assigned pond texture character for each cell, indexed row-major. */
  private textures: string[] = [];
  private press: Press | null = null;
  /** Called with the hovered/focused cell index, or -1 when the pointer/focus leaves. */
  private hoverHandler: ((index: number) => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    /** Fired on every tap or painted cell with the cell index and its new state. */
    private readonly onTap: (index: number, nextState: CellState) => void,
  ) {
    root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    root.addEventListener("pointerover", (e) => this.onPointerOver(e));
    root.addEventListener("pointerover", (e) => this.hoverHandler?.(this.cellIndexOf(e.target)));
    root.addEventListener("pointerleave", () => this.hoverHandler?.(-1));
    root.addEventListener("focusin", (e) => this.hoverHandler?.(this.cellIndexOf(e.target)));
    root.addEventListener("focusout", () => this.hoverHandler?.(-1));
    // Release can happen anywhere, including outside the board.
    const end = (e: PointerEvent) => this.onPointerEnd(e);
    root.ownerDocument.addEventListener("pointerup", end);
    root.ownerDocument.addEventListener("pointercancel", end);
  }

  /** The cell index under an event target, or -1 when it is not one of our cells. */
  private cellIndexOf(target: EventTarget | null): number {
    const el = (target as Element | null)?.closest?.(".board-cell") as HTMLButtonElement | null;
    return el ? this.cells.indexOf(el) : -1;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return; // left button only
    const i = this.cellIndexOf(e.target);
    if (i < 0) return;
    // Touch pointers are implicitly captured by the pressed element, which
    // would stop `pointerover` firing on the cells the finger slides across.
    const el = this.cells[i];
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    this.press = {
      pointerId: e.pointerId,
      start: i,
      mode: null,
      tapOnly: this.stateAt(i) === CellState.FISH,
    };
  }

  private onPointerOver(e: PointerEvent): void {
    const press = this.press;
    if (!press || e.pointerId !== press.pointerId || press.tapOnly) return;
    const i = this.cellIndexOf(e.target);
    if (i < 0) return;
    if (!press.mode) {
      if (i === press.start) return; // still on the starting cell
      // First move onto another cell: this press is a drag. Its mode comes
      // from the starting cell, which is painted too.
      press.mode =
        this.stateAt(press.start) === CellState.RULED_OUT
          ? { from: CellState.RULED_OUT, to: CellState.EMPTY }
          : { from: CellState.EMPTY, to: CellState.RULED_OUT };
      this.paint(press.start, press.mode);
    }
    this.paint(i, press.mode);
  }

  private onPointerEnd(e: PointerEvent): void {
    const press = this.press;
    if (!press || e.pointerId !== press.pointerId) return;
    this.press = null;
    if (e.type === "pointercancel" || press.mode) return;
    this.cycle(press.start); // released without leaving the cell: a normal tap
  }

  /** Apply a drag's paint to one cell if it is in the mode's source state. */
  private paint(i: number, mode: { from: CellState; to: CellState }): void {
    if (this.stateAt(i) === mode.from) this.onTap(i, mode.to);
  }

  /** Advance one cell a single step through empty -> x -> fish. */
  private cycle(i: number): void {
    this.onTap(i, CYCLE[(CYCLE.indexOf(this.stateAt(i)) + 1) % CYCLE.length]);
  }

  /**
   * Configure the grid for a puzzle: responsive cell size, grid columns and,
   * for every cell, its pond id, texture character and heavy pond-boundary
   * borders. Buttons are rebuilt only when the board size changes.
   */
  setPuzzle(puzzle: Puzzle): void {
    this.puzzle = puzzle;
    const styles = assignPondStyles(puzzle);
    const n = puzzle.size;

    // `--cell` scales with the grid size (36px = 16px page gutters + the 2px board frame) so the board always fits the viewport
    // width (spec: from 320px up, no horizontal scrolling) and caps at 56px so
    // large screens do not show oversized cells. The CSS provides the same
    // formula as a fallback for standalone rendering.
    this.root.style.setProperty("--cell", `min((100vw - 36px) / ${n}, 56px)`);
    this.root.style.gridTemplateColumns = `repeat(${n}, var(--cell))`;

    if (this.cells.length !== n * n) {
      this.buildButtons(puzzle);
    }

    for (let i = 0; i < puzzle.ponds.length; i++) {
      const cell = this.cells[i];
      const pond = puzzle.ponds[i];
      this.textures[i] = styles.textures[pond];
      // Heavy border on each side whose neighbor belongs to a different pond,
      // and a light grid line on every other side so rows and columns stay
      // visible inside a pond.
      const t = this.border(i, -n, puzzle);
      const b = this.border(i, n, puzzle);
      const l = this.border(i, -1, puzzle);
      const r = this.border(i, 1, puzzle);
      cell.style.setProperty("--b-t", `${t}px`);
      cell.style.setProperty("--b-b", `${b}px`);
      cell.style.setProperty("--b-l", `${l}px`);
      cell.style.setProperty("--b-r", `${r}px`);
      cell.style.setProperty("--c-t", edgeColor(t));
      cell.style.setProperty("--c-b", edgeColor(b));
      cell.style.setProperty("--c-l", edgeColor(l));
      cell.style.setProperty("--c-r", edgeColor(r));
      cell.dataset.pond = String(pond);
      cell.dataset.texture = styles.textures[pond];
    }
  }

  /** Register a handler for the hovered or focused cell (-1 when none). */
  onHover(handler: (index: number) => void): void {
    this.hoverHandler = handler;
  }

  /** Mark one cell (or none, with -1) as the highlighted pillar position. */
  setHighlight(index: number): void {
    for (let i = 0; i < this.cells.length; i++) {
      if (i === index) this.cells[i].dataset.pillar = "";
      else delete this.cells[i].dataset.pillar;
    }
  }

  /** Render a board: glyphs (x / fish), states, pond tint, conflicts and labels. */
  render(board: Board, options: RenderOptions = {}): void {
    const puzzle = this.puzzle ?? { size: board.size, ponds: new Array(board.size * board.size).fill(0) };
    const conflictSet = options.conflictSet ?? conflicts(puzzle, board);

    for (let i = 0; i < this.cells.length && i < board.cells.length; i++) {
      const el = this.cells[i];
      const visual = this.visualFor(board.cells[i], i, conflictSet, options.directionSeed);
      el.textContent = visual.text;
      el.dataset.state = visual.state;
      el.setAttribute("aria-label", this.labelFor(i, visual.state, visual.conflict, puzzle.size));
      if (visual.conflict) el.dataset.conflict = "conflict";
      else delete el.dataset.conflict;
    }
  }

  private visualFor(
    state: CellState,
    i: number,
    conflictSet: ReadonlySet<number>,
    directionSeed?: string,
  ): { text: string; state: "empty" | "ruled" | "fish"; conflict: boolean } {
    if (state === CellState.FISH) {
      const conflict = conflictSet.has(i);
      return { text: conflict ? ">x>" : this.fishGlyph(i, directionSeed), state: "fish", conflict };
    }
    if (state === CellState.RULED_OUT) {
      return { text: "x", state: "ruled", conflict: false };
    }
    // Empty cells are filled with their pond's assigned texture repeated across
    // the cell, so a pond reads as one continuous region and its edges are clear.
    const pond = this.puzzle ? this.puzzle.ponds[i] : 0;
    const texture = this.textures[i] ?? TEXTURES[pond % TEXTURES.length];
    return { text: texture.repeat(EMPTY_FILL), state: "empty", conflict: false };
  }

  /** Accessible description of a cell, e.g. "row 3, column 5, fish". */
  private labelFor(
    i: number,
    state: "empty" | "ruled" | "fish",
    conflict: boolean,
    size: number,
  ): string {
    const what =
      state === "fish"
        ? conflict
          ? "fish in conflict"
          : "fish"
        : state === "ruled"
          ? "ruled out"
          : "empty";
    return `row ${rowOf(i, size) + 1}, column ${colOf(i, size) + 1}, ${what}`;
  }

  private fishGlyph(i: number, directionSeed?: string): string {
    // Direction derives from a stable hash of (seed, row, col) so it never flickers.
    const seed = directionSeed ?? "";
    let h = 0;
    for (let k = 0; k < seed.length; k++) h = Math.imul(31, h) + seed.charCodeAt(k);
    const size = this.puzzle ? this.puzzle.size : Math.round(Math.sqrt(this.cells.length));
    const n = ((h >>> 0) + rowOf(i, size) + colOf(i, size)) % 2;
    return n === 0 ? "><>" : "<><";
  }

  /**
   * Border thickness on the side toward `offset`: 3px across a pond boundary,
   * 1px (a light grid line) otherwise. `offset` is ±1 for left/right and
   * ±size for up/down; only the horizontal offsets can wrap, so the row check
   * applies to those alone.
   */
  private border(i: number, offset: number, puzzle: Puzzle): number {
    const j = i + offset;
    if (j < 0 || j >= this.cells.length) return 1; // off the edge of that axis
    if (Math.abs(offset) === 1 && rowOf(i, puzzle.size) !== rowOf(j, puzzle.size)) {
      return 1; // wrapped to the other side of the row
    }
    return puzzle.ponds[i] !== puzzle.ponds[j] ? 3 : 1;
  }

  private buildButtons(puzzle: Puzzle): void {
    this.root.replaceChildren();
    this.cells = [];
    this.textures = [];
    for (let i = 0; i < puzzle.size * puzzle.size; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "board-cell";
      btn.setAttribute("aria-rowindex", String(rowOf(i, puzzle.size) + 1));
      btn.setAttribute("aria-colindex", String(colOf(i, puzzle.size) + 1));
      btn.addEventListener("click", (e) => {
        // Pointer presses are handled by the pointer handlers above; their
        // follow-up click carries a non-zero `detail` and is ignored here.
        // Keyboard activation (Enter/Space) and synthetic clicks still cycle.
        if (e instanceof MouseEvent && e.detail > 0) return;
        this.cycle(i);
      });
      this.cells.push(btn);
      this.root.append(btn);
    }
  }

  /** Read a cell's backing state from its data attribute (kept in sync by render). */
  private stateAt(i: number): CellState {
    const s = this.cells[i].dataset.state;
    return s === "ruled" ? CellState.RULED_OUT : s === "fish" ? CellState.FISH : CellState.EMPTY;
  }
}
