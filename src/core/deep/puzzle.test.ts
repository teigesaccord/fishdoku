import { describe, it, expect } from "vitest";
import { CellState } from "../puzzle";
import {
  LAYERS,
  deepCoords,
  deepIdx,
  layerBoard,
  layerPuzzle,
  tankCellCount,
  tankFromLayers,
} from "./puzzle";

describe("deep puzzle model", () => {
  it("round-trips flat indices through (layer, row, col)", () => {
    const size = 7;
    for (let i = 0; i < tankCellCount(size); i++) {
      const { layer, row, col } = deepCoords(i, size);
      expect(deepIdx(layer, row, col, size)).toBe(i);
      expect(layer).toBeGreaterThanOrEqual(0);
      expect(layer).toBeLessThan(LAYERS);
    }
  });

  it("assembles layers with global pond ids and slices them back", () => {
    const size = 2;
    const layers = [
      { size, ponds: [0, 0, 1, 1] },
      { size, ponds: [1, 0, 1, 0] },
    ];
    const tank = tankFromLayers(layers);
    expect(tank.ponds).toEqual([0, 0, 1, 1, 3, 2, 3, 2]);
    for (let L = 0; L < LAYERS; L++) expect(layerPuzzle(tank, L)).toEqual(layers[L]);
    expect(() => tankFromLayers([layers[0]])).toThrow();
  });

  it("slices a layer's board", () => {
    const cells = new Array(8).fill(CellState.EMPTY);
    cells[deepIdx(1, 1, 0, 2)] = CellState.FISH;
    expect(layerBoard({ size: 2, cells }, 1).cells).toEqual([0, 0, CellState.FISH, 0]);
  });
});
