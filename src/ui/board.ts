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

interface RenderOptions {
  /** Stable seed for choosing "><>" vs "<><" direction; hash of (date, row, col). */
  readonly directionSeed?: string;
}

export interface BoardControllerLike {
  render(board: Board, options?: RenderOptions): void;
}

export class BoardController {
  private puzzle: Puzzle | null = null;
  private cells: HTMLButtonElement[] = [];
  /** The assigned pond texture character for each cell, indexed row-major. */
  private textures: string[] = [];

  constructor(
    private readonly root: HTMLElement,
    /** Fired on every tap with the cell index and its next cycle state. */
    private readonly onTap: (index: number, nextState: CellState) => void,
  ) {}

  /**
   * Configure the grid for a puzzle: responsive cell size, grid columns and,
   * for every cell, its pond id, texture character and heavy pond-boundary
   * borders. Buttons are rebuilt only when the board size changes.
   */
  setPuzzle(puzzle: Puzzle): void {
    this.puzzle = puzzle;
    const styles = assignPondStyles(puzzle);
    const n = puzzle.size;

    // `--cell` scales with the grid size so the board always fits the viewport
    // width (spec: from 320px up, no horizontal scrolling) and caps at 56px so
    // large screens do not show oversized cells. The CSS provides the same
    // formula as a fallback for standalone rendering.
    this.root.style.setProperty("--cell", `min((100vw - 32px) / ${n}, 56px)`);
    this.root.style.gridTemplateColumns = `repeat(${n}, var(--cell))`;

    if (this.cells.length !== n * n) {
      this.buildButtons(puzzle);
    }

    for (let i = 0; i < puzzle.ponds.length; i++) {
      const cell = this.cells[i];
      const pond = puzzle.ponds[i];
      this.textures[i] = styles.textures[pond];
      // Heavy border on each side whose neighbor belongs to a different pond.
      cell.style.setProperty("--b-t", `${this.border(i, -n, puzzle)}px`);
      cell.style.setProperty("--b-b", `${this.border(i, n, puzzle)}px`);
      cell.style.setProperty("--b-l", `${this.border(i, -1, puzzle)}px`);
      cell.style.setProperty("--b-r", `${this.border(i, 1, puzzle)}px`);
      cell.dataset.pond = String(pond);
      cell.dataset.texture = styles.textures[pond];
    }
  }

  /** Render a board: glyphs (x / fish), states, pond tint, conflicts and labels. */
  render(board: Board, options: RenderOptions = {}): void {
    const puzzle = this.puzzle ?? { size: board.size, ponds: new Array(board.size * board.size).fill(0) };
    const conflictSet = conflicts(puzzle, board);

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
    conflictSet: Set<number>,
    directionSeed?: string,
  ): { text: string; state: "empty" | "ruled" | "fish"; conflict: boolean } {
    if (state === CellState.FISH) {
      const conflict = conflictSet.has(i);
      return { text: conflict ? ">x>" : this.fishGlyph(i, directionSeed), state: "fish", conflict };
    }
    if (state === CellState.RULED_OUT) {
      return { text: "x", state: "ruled", conflict: false };
    }
    // Empty cells show their pond's assigned, dimmed texture character.
    const pond = this.puzzle ? this.puzzle.ponds[i] : 0;
    const texture = this.textures[i] ?? TEXTURES[pond % TEXTURES.length];
    return { text: texture, state: "empty", conflict: false };
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

  /** Border thickness on the side toward `offset` neighbor: 3px across a pond boundary, else 0. */
  private border(i: number, offset: number, puzzle: Puzzle): number {
    const j = i + offset;
    if (j < 0 || j >= this.cells.length) return 0; // off the edge of that axis
    // Reject a neighbor that wrapped to the other side of the row/column.
    if (rowOf(i, puzzle.size) !== rowOf(j, puzzle.size)) return 0;
    return puzzle.ponds[i] !== puzzle.ponds[j] ? 3 : 0;
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
      btn.addEventListener("click", () => {
        const next = CYCLE[(CYCLE.indexOf(this.stateAt(i)) + 1) % CYCLE.length];
        this.onTap(i, next);
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
