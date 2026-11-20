/**
 * Core data model for Fishdoku puzzles and boards.
 *
 * This module is pure logic with no DOM access so it can be unit-tested
 * headlessly. The `Board` type mirrors the persisted cell-string encoding:
 * a flat array of length N*N where each entry is an integer state value.
 */

/** A single cell's encoded state. */
export enum CellState {
  /** Empty / unknown; nothing marked on this cell. */
  EMPTY = 0,
  /** Ruled out (no fish here). Ignored by solved detection. */
  RULED_OUT = 1,
  /** A fish sits on this cell. */
  FISH = 2,
}

/** A puzzle: the pond layout that defines a single daily grid. */
export interface Puzzle {
  /** Grid size N (7..11). The grid is N x N. */
  readonly size: number;
  /** Flat array of length N*N: pond id (0..N-1) for each cell, row-major. */
  readonly ponds: number[];
}

/** A player's board over a puzzle: what fish and ruled-out marks are placed. */
export interface Board {
  /** Grid size N, must match the owning puzzle's size. */
  readonly size: number;
  /** Flat array of length N*N: CellState for each cell, row-major. */
  readonly cells: CellState[];
}

/** Index in a flat, row-major grid for a given (row, col). */
export function idx(row: number, col: number, size: number): number {
  return row * size + col;
}

/** Row of a flat index. */
export function rowOf(index: number, size: number): number {
  return Math.floor(index / size);
}

/** Column of a flat index. */
export function colOf(index: number, size: number): number {
  return index % size;
}

/** Orthogonal neighbours of a flat index as flat indices, clamped to the grid. */
function neighbors(index: number, size: number): number[] {
  const r = rowOf(index, size);
  const c = colOf(index, size);
  const out: number[] = [];
  if (r > 0) out.push(index - size); // up
  if (r < size - 1) out.push(index + size); // down
  if (c > 0) out.push(index - 1); // left
  if (c < size - 1) out.push(index + 1); // right
  return out;
}

/** Whether a single pond (by id) is orthogonally connected. */
export function isPondConnected(ponds: number[], size: number, pondId: number): boolean {
  const cellCount = ponds.length; // == size * size
  let start = -1;
  let expected = 0;
  for (let i = 0; i < cellCount; i++) {
    if (ponds[i] === pondId) {
      if (start < 0) start = i;
      expected++;
    }
  }
  if (start < 0) return true; // no cells -> trivially connected

  const seen = new Uint8Array(cellCount);
  const stack: number[] = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    count++;
    const nb = neighbors(cur, size);
    for (let k = 0; k < nb.length; k++) {
      const n = nb[k];
      if (ponds[n] === pondId && !seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return count === expected;
}

/** Whether every pond in the puzzle is orthogonally connected. */
export function allPondsContiguous(puzzle: Puzzle): boolean {
  const seen = new Uint8Array(puzzle.size * puzzle.size);
  for (let i = 0; i < puzzle.ponds.length; i++) {
    const id = puzzle.ponds[i];
    if (!seen[id]) {
      seen[id] = 1;
      if (!isPondConnected(puzzle.ponds, puzzle.size, id)) return false;
    }
  }
  return true;
}

/**
 * Encode a board's cells to the persisted digit string: "0" empty, "1" ruled
 * out, "2" fish. Length is exactly N*N and every character is one of 0/1/2.
 */
export function encodeCells(cells: CellState[]): string {
  let out = "";
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v !== CellState.EMPTY && v !== CellState.RULED_OUT && v !== CellState.FISH) {
      throw new Error(`invalid cell state ${v}`);
    }
    out += v;
  }
  return out;
}

/** Decode a persisted digit string back into cells. Rejects wrong length / chars. */
export function decodeCells(encoded: string): CellState[] {
  const cells: CellState[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const c = encoded[i];
    if (c === "0") cells.push(CellState.EMPTY);
    else if (c === "1") cells.push(CellState.RULED_OUT);
    else if (c === "2") cells.push(CellState.FISH);
    else throw new Error(`invalid cell char "${c}"`);
  }
  return cells;
}
