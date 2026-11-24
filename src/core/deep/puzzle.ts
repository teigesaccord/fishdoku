/**
 * Core data model for Deep Water tanks: two stacked N x N layers.
 *
 * Pure logic with no DOM access. A tank is stored as flat, layer-major arrays of
 * length LAYERS*N*N, indexed `layer * N*N + row * N + col`, so the classic cell
 * encoding (`encodeCells` / `decodeCells`) works unchanged and a saved tank is a
 * single digit string. Pond ids are global: layer L owns ids L*N .. L*N + N-1.
 */

import type { Board, CellState, Puzzle } from "../puzzle";

/** Number of layers in a tank: surface (0) and deep (1). */
export const LAYERS = 2;

/** Human-readable layer names, indexed by layer. */
export const LAYER_NAMES: readonly string[] = ["surface", "deep"];

/** A Deep Water puzzle: the pond layout of every layer. */
export interface DeepPuzzle {
  /** Layer size N. Each layer is N x N. */
  readonly size: number;
  /** Flat array of length LAYERS*N*N: global pond id for each cell, layer-major. */
  readonly ponds: number[];
}

/** A player's tank: fish and ruled-out marks across every layer. */
export interface DeepBoard {
  /** Layer size N, must match the owning puzzle's size. */
  readonly size: number;
  /** Flat array of length LAYERS*N*N: CellState for each cell, layer-major. */
  readonly cells: CellState[];
}

/** Number of cells in a tank with layer size N. */
export function tankCellCount(size: number): number {
  return LAYERS * size * size;
}

/** Flat tank index for (layer, row, col). */
export function deepIdx(layer: number, row: number, col: number, size: number): number {
  return layer * size * size + row * size + col;
}

/** Decompose a flat tank index into its layer, row and column. */
export function deepCoords(index: number, size: number): { layer: number; row: number; col: number } {
  const area = size * size;
  const layer = Math.floor(index / area);
  const rest = index - layer * area;
  return { layer, row: Math.floor(rest / size), col: rest % size };
}

/**
 * A classic puzzle for one layer, with pond ids remapped to 0..N-1, so the
 * classic solver, rules and board view can work on a single layer.
 */
export function layerPuzzle(deep: DeepPuzzle, layer: number): Puzzle {
  const area = deep.size * deep.size;
  const base = layer * deep.size;
  const ponds = deep.ponds.slice(layer * area, (layer + 1) * area).map((p) => p - base);
  return { size: deep.size, ponds };
}

/** The classic board for one layer of a tank. */
export function layerBoard(board: DeepBoard, layer: number): Board {
  const area = board.size * board.size;
  return { size: board.size, cells: board.cells.slice(layer * area, (layer + 1) * area) };
}

/** Assemble a tank from one classic puzzle per layer (pond ids 0..N-1 each). */
export function tankFromLayers(layers: readonly Puzzle[]): DeepPuzzle {
  if (layers.length !== LAYERS) throw new Error(`a tank needs ${LAYERS} layers`);
  const size = layers[0].size;
  const ponds: number[] = [];
  layers.forEach((layer, L) => {
    if (layer.size !== size) throw new Error("all layers must share one size");
    for (const p of layer.ponds) ponds.push(L * size + p);
  });
  return { size, ponds };
}
