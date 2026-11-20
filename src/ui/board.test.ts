import { describe, it, expect, beforeEach } from "vitest";
import type { Puzzle, Board } from "../core/puzzle";
import { CellState, idx } from "../core/puzzle";
import { generate } from "../core/generator";
import { assignPondStyles } from "./pond-colors";
import { BoardController } from "./board";

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
      expect(host.style.getPropertyValue("--cell")).toBe(`min((100vw - 32px) / ${n}, 56px)`);
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
      expect(cells[i].textContent).toBe(styles.textures[puzzle.ponds[i]]);
    }
  });

  it("draws heavy borders only across pond boundaries", () => {
    const { puzzle, board } = fixture(9, "board-border");
    const controller = new BoardController(root, () => {});
    controller.setPuzzle(puzzle);
    controller.render(board);
    const cells = cellsOf(root);

    let checkedBoundary = false;
    let checkedInterior = false;
    for (let r = 0; r < puzzle.size; r++) {
      for (let c = 0; c + 1 < puzzle.size; c++) {
        const i = idx(r, c, puzzle.size);
        const j = idx(r, c + 1, puzzle.size);
        const right = cells[i].style.getPropertyValue("--b-r");
        const left = cells[j].style.getPropertyValue("--b-l");
        if (puzzle.ponds[i] !== puzzle.ponds[j]) {
          expect(right).toBe("3px");
          expect(left).toBe("3px");
          checkedBoundary = true;
        } else {
          expect(right).toBe("0px");
          expect(left).toBe("0px");
          checkedInterior = true;
        }
      }
    }
    expect(checkedBoundary).toBe(true);
    expect(checkedInterior).toBe(true);
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
      expect(cells[i].textContent).toBe(stylesB.textures[b.puzzle.ponds[i]]);
    }
  });
});
