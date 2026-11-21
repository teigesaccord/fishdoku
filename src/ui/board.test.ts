import { describe, it, expect, beforeEach } from "vitest";
import type { Puzzle, Board } from "../core/puzzle";
import { CellState, idx } from "../core/puzzle";
import { generate } from "../core/generator";
import { assignPondStyles } from "./pond-colors";
import { BoardController, EMPTY_FILL } from "./board";

/** A fixed puzzle and an all-empty board for it. */
function fixture(size: number, seed: string): { puzzle: Puzzle; board: Board } {
  const puzzle = generate("v1", seed, size);
  const board: Board = { size, cells: new Array(size * size).fill(CellState.EMPTY) };
  return { puzzle, board };
}

function cellsOf(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button.board-cell"));
}

let root: HTMLElement;
beforeEach(() => {
  root = document.createElement("div");
});

describe("board: grid and cells", () => {
  it("renders one button per cell with grid position and an aria-label", () => {
    const { puzzle, board } = fixture(7, "board-render");
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(puzzle);
    controller.render(board);

    const cells = cellsOf(root);
    expect(cells.length).toBe(49);
    expect(cells[0].getAttribute("aria-rowindex")).toBe("1");
    expect(cells[0].getAttribute("aria-colindex")).toBe("1");
    expect(cells[8].getAttribute("aria-rowindex")).toBe("2");
    expect(cells[8].getAttribute("aria-colindex")).toBe("2");
    expect(cells[0].getAttribute("aria-label")).toBe("row 1, column 1, empty");
  });

  it("sizes the cells with the formula for the puzzle's N", () => {
    const { puzzle } = fixture(11, "board-size");
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(puzzle);
    expect(root.style.getPropertyValue("--cell")).toContain("/ 11");
    expect(root.style.gridTemplateColumns).toBe("repeat(11, var(--cell))");
  });

  it("uses the viewport cell formula and meets the responsive guarantees", () => {
    for (const n of [7, 8, 9, 10, 11]) {
      const { puzzle } = fixture(n, `size-${n}`);
      const host = document.createElement("div");
      new BoardController(host, () => {}).setPuzzle(puzzle);
      expect(host.style.getPropertyValue("--cell")).toBe(`min((100vw - 36px) / ${n}, 56px)`);
    }
    // Numeric check of the spec: 11x11 fits (no horizontal scroll) down to 320px,
    // and each cell is at least 28px at 360px.
    const cell = (vw: number, n: number) => Math.min((vw - 32) / n, 56);
    const boardWidth = (vw: number, n: number) => n * cell(vw, n) + 4; // +2px padding each side
    for (const vw of [320, 360]) {
      expect(boardWidth(vw, 11)).toBeLessThanOrEqual(vw - 16); // gutters are 8px each side
    }
    expect(cell(360, 11)).toBeGreaterThanOrEqual(28);
    // A 7x7 board is capped on a large screen instead of becoming oversized.
    expect(cell(1920, 7)).toBe(56);
  });

  it("shows each empty cell's own assigned pond texture", () => {
    const { puzzle, board } = fixture(7, "board-texture");
    const styles = assignPondStyles(puzzle);
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(puzzle);
    controller.render(board);

    const cells = cellsOf(root);
    for (let i = 0; i < 49; i++) {
      // Empty cells are filled with the pond's texture repeated across the cell.
      expect(cells[i].textContent).toBe(styles.textures[puzzle.ponds[i]].repeat(EMPTY_FILL));
    }
  });

  it("draws heavy pond boundaries and light grid lines, in both directions", () => {
    const { puzzle, board } = fixture(9, "board-border");
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(puzzle);
    controller.render(board);
    const cells = cellsOf(root);
    const n = puzzle.size;

    let boundaries = 0;
    let interior = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = idx(r, c, n);
        // Horizontal neighbour to the right.
        if (c + 1 < n) {
          const j = idx(r, c + 1, n);
          const across = puzzle.ponds[i] !== puzzle.ponds[j];
          expect(cells[i].style.getPropertyValue("--b-r")).toBe(across ? "3px" : "1px");
          expect(cells[j].style.getPropertyValue("--b-l")).toBe(across ? "3px" : "1px");
          if (across) boundaries++;
          else interior++;
        }
        // Vertical neighbour below (this side used to be missing entirely).
        if (r + 1 < n) {
          const j = idx(r + 1, c, n);
          const across = puzzle.ponds[i] !== puzzle.ponds[j];
          expect(cells[i].style.getPropertyValue("--b-b")).toBe(across ? "3px" : "1px");
          expect(cells[j].style.getPropertyValue("--b-t")).toBe(across ? "3px" : "1px");
          if (across) boundaries++;
          else interior++;
        }
      }
    }
    expect(boundaries).toBeGreaterThan(0);
    expect(interior).toBeGreaterThan(0);
  });

  it("uses a stable fish direction and marks conflicts distinctly", () => {
    const { puzzle, board } = fixture(8, "board-fish");
    const controller = new BoardController(root, () => {});

    board.cells[idx(0, 2, 8)] = CellState.FISH;
    // Two fish in the same row -> both flagged as conflicts.
    board.cells[idx(0, 5, 8)] = CellState.FISH;
    controller.setPuzzle(puzzle);
    controller.render(board);
    let cells = cellsOf(root);
    expect(cells[idx(0, 2, 8)].textContent).toBe(">x>");
    expect(cells[idx(0, 5, 8)].textContent).toBe(">x>");
    expect(cells[idx(0, 2, 8)].dataset.conflict).toBe("conflict");
    expect(cells[idx(0, 2, 8)].getAttribute("aria-label")).toContain("in conflict");

    // Remove the conflict: the remaining fish shows a normal, stable glyph.
    board.cells[idx(0, 5, 8)] = CellState.EMPTY;
    controller.render(board);
    cells = cellsOf(root);
    const glyph = cells[idx(0, 2, 8)].textContent;
    expect(["><>", "<><"]).toContain(glyph);
    controller.render(board);
    expect(cellsOf(root)[idx(0, 2, 8)].textContent).toBe(glyph);
  });

  it("reconfigures textures and ponds when the layout changes at the same size", () => {
    const a = fixture(9, "layout-a");
    const b = fixture(9, "layout-b");
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(a.puzzle);
    controller.render(a.board);
    controller.setPuzzle(b.puzzle);
    controller.render(b.board);

    const cells = cellsOf(root);
    const stylesB = assignPondStyles(b.puzzle);
    for (let i = 0; i < cells.length; i++) {
      expect(cells[i].dataset.pond).toBe(String(b.puzzle.ponds[i]));
      expect(cells[i].textContent).toBe(stylesB.textures[b.puzzle.ponds[i]].repeat(EMPTY_FILL));
    }
  });
});

describe("board: click and drag", () => {
  /** A board wired to a live state array, re-rendered on every reported change. */
  function live(size = 7) {
    const { puzzle } = fixture(size, "board-drag");
    const cells: CellState[] = new Array(size * size).fill(CellState.EMPTY);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const controller = new BoardController(host, (i, next) => {
      cells[i] = next;
      controller.render({ size, cells });
    });
    controller.setPuzzle(puzzle);
    controller.render({ size, cells });
    const els = cellsOf(host);
    const fire = (type: string, i: number, pointerId = 1) =>
      els[i].dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId, pointerType: "mouse", button: 0 }),
      );
    const set = (i: number, s: CellState) => {
      cells[i] = s;
      controller.render({ size, cells });
    };
    return { cells, els, fire, set };
  }

  it("a press and release on one cell is a single tap", () => {
    const b = live();
    b.fire("pointerdown", 3);
    b.fire("pointerup", 3);
    expect(b.cells[3]).toBe(CellState.RULED_OUT);
    // The browser's follow-up click (detail 1) must not cycle it again.
    b.els[3].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(b.cells[3]).toBe(CellState.RULED_OUT);
  });

  it("dragging from an empty cell crosses off every empty cell passed, leaving fish alone", () => {
    const b = live();
    b.set(2, CellState.FISH);
    b.fire("pointerdown", 0);
    for (const i of [1, 2, 3, 10]) b.fire("pointerover", i);
    b.fire("pointerup", 10);
    expect([0, 1, 3, 10].map((i) => b.cells[i])).toEqual(new Array(4).fill(CellState.RULED_OUT));
    expect(b.cells[2]).toBe(CellState.FISH);
    expect(b.cells[4]).toBe(CellState.EMPTY);
  });

  it("dragging from an x erases the x marks passed", () => {
    const b = live();
    for (const i of [0, 1, 2]) b.set(i, CellState.RULED_OUT);
    b.fire("pointerdown", 0);
    b.fire("pointerover", 1);
    b.fire("pointerover", 2);
    b.fire("pointerover", 3); // empty: stays empty
    b.fire("pointerup", 3);
    expect([0, 1, 2, 3].map((i) => b.cells[i])).toEqual(new Array(4).fill(CellState.EMPTY));
  });

  it("a press that starts on a fish never paints", () => {
    const b = live();
    b.set(0, CellState.FISH);
    b.fire("pointerdown", 0);
    b.fire("pointerover", 1);
    b.fire("pointerup", 1);
    expect(b.cells[1]).toBe(CellState.EMPTY);
  });

  it("moving the mouse without a press paints nothing", () => {
    const b = live();
    b.fire("pointerover", 1);
    b.fire("pointerover", 2);
    expect(b.cells.every((s) => s === CellState.EMPTY)).toBe(true);
  });

  it("keyboard activation (click with detail 0) still cycles a cell", () => {
    const b = live();
    b.els[5].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(b.cells[5]).toBe(CellState.RULED_OUT);
  });
});
