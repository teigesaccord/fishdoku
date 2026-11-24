import { afterEach, describe, expect, it, vi } from "vitest";
import { CellState } from "../core/puzzle";
import { generateDeepV1 } from "../core/deep/generator";
import { LAYERS, deepIdx } from "../core/deep/puzzle";
import { DeepBoardView } from "./deep-board";

const N = 8;
const tank = generateDeepV1("deep-board-view", N);

function emptyBoard() {
  return { size: N, cells: new Array<CellState>(LAYERS * N * N).fill(CellState.EMPTY) };
}

function layerCells(root: HTMLElement, layer: number): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(`.deep-layer[data-layer="${layer}"] button.board-cell`),
  );
}

/** Pretend the viewport is narrow (phone) or wide for the next view built. */
function mockWidth(wide: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({ matches: wide, addEventListener: () => {} })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deep board view", () => {
  it("renders two labeled layers of N x N cells", () => {
    const root = document.createElement("div");
    const view = new DeepBoardView(root, () => {});
    view.setPuzzle(tank);
    view.render(emptyBoard());
    expect(root.querySelectorAll(".deep-layer").length).toBe(2);
    expect([...root.querySelectorAll(".layer-name")].map((e) => e.textContent)).toEqual([
      "~ surface ~",
      "~~~ deep ~~~",
    ]);
    for (let L = 0; L < LAYERS; L++) expect(layerCells(root, L).length).toBe(N * N);
  });

  it("reports taps with flat tank indices", () => {
    const root = document.createElement("div");
    const taps: Array<[number, CellState]> = [];
    const view = new DeepBoardView(root, (i, s) => taps.push([i, s]));
    view.setPuzzle(tank);
    view.render(emptyBoard());
    layerCells(root, 1)[3 * N + 5].dispatchEvent(new Event("click"));
    expect(taps).toEqual([[deepIdx(1, 3, 5, N), CellState.RULED_OUT]]);
  });

  it("shows a cross-layer conflict on both layers", () => {
    const root = document.createElement("div");
    const view = new DeepBoardView(root, () => {});
    view.setPuzzle(tank);
    const board = emptyBoard();
    board.cells[deepIdx(0, 2, 2, N)] = CellState.FISH;
    board.cells[deepIdx(1, 2, 3, N)] = CellState.FISH; // side by side across the layers
    view.render(board);
    expect(layerCells(root, 0)[2 * N + 2].dataset.conflict).toBe("conflict");
    expect(layerCells(root, 1)[2 * N + 3].dataset.conflict).toBe("conflict");

    // A diagonal offset across the layers is fine: no conflict.
    const ok = emptyBoard();
    ok.cells[deepIdx(0, 2, 2, N)] = CellState.FISH;
    ok.cells[deepIdx(1, 3, 3, N)] = CellState.FISH;
    view.render(ok);
    expect(layerCells(root, 0)[2 * N + 2].dataset.conflict).toBeUndefined();
  });

  it("hovering a cell highlights the same pillar in the other layer", () => {
    const root = document.createElement("div");
    const view = new DeepBoardView(root, () => {});
    view.setPuzzle(tank);
    view.render(emptyBoard());
    const i = 2 * N + 5;
    layerCells(root, 0)[i].dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(layerCells(root, 1)[i].dataset.pillar).toBe("");
    expect(layerCells(root, 0)[i].dataset.pillar).toBeUndefined();

    root.querySelector('.deep-layer[data-layer="0"] .layer-board')!.dispatchEvent(new Event("pointerleave"));
    expect(layerCells(root, 1)[i].dataset.pillar).toBeUndefined();
  });

  it("on wide screens both layers are playable side by side", () => {
    mockWidth(true);
    const root = document.createElement("div");
    const view = new DeepBoardView(root, () => {});
    view.setPuzzle(tank);
    expect(root.dataset.layout).toBe("wide");
    const roles = [...root.querySelectorAll<HTMLElement>(".deep-layer")].map((s) => s.dataset.role);
    expect(roles).toEqual(["wide", "wide"]);
  });

  it("on narrow screens shows one full layer and a read-only mini-map", () => {
    mockWidth(false);
    const root = document.createElement("div");
    const taps: number[] = [];
    const view = new DeepBoardView(root, (i) => taps.push(i));
    view.setPuzzle(tank);
    view.render(emptyBoard());
    expect(root.dataset.layout).toBe("narrow");
    const sections = [...root.querySelectorAll<HTMLElement>(".deep-layer")];
    expect(sections.map((s) => s.dataset.role)).toEqual(["full", "mini"]);
    expect(sections[1].getAttribute("aria-hidden")).toBe("true");
    expect(layerCells(root, 1)[0].tabIndex).toBe(-1);

    // Tapping the mini-map does not mark a cell; it switches to that layer.
    layerCells(root, 1)[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(taps).toEqual([]);
    expect(view.activeLayer).toBe(1);
    expect(sections.map((s) => s.dataset.role)).toEqual(["mini", "full"]);

    // The tab strip switches layers too.
    root.querySelectorAll<HTMLButtonElement>(".layer-tab")[0].click();
    expect(view.activeLayer).toBe(0);
    expect(root.querySelectorAll(".layer-tab")[0].getAttribute("aria-selected")).toBe("true");
  });
});
