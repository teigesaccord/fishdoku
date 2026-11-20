/**
 * Board persistence for Fishdoku.
 *
 * Each day's board is stored as a JSON object `{ cells, solved }` under the key
 * `fishdoku:v1:board:<YYYY-MM-DD>`, where `cells` is a digit string of length
 * N*N ("0" empty, "1" ruled out, "2" fish) and `solved` marks completion.
 *
 * Every localStorage access is wrapped in try/catch. If storage throws (blocked
 * cookies, private window quota errors, missing API), the wrapper falls back to
 * an in-memory map so the game still works. The fallback never persists across
 * reloads, but keeps a session consistent within one page load.
 */

import type { CellState } from "./core/puzzle";
import { encodeCells, decodeCells } from "./core/puzzle";

/** Namespace for all persisted keys; bump when the schema changes. */
export const STORAGE_PREFIX = "fishdoku:v1:board:";

/** A board's persisted representation: a digit string of cell states plus solved flag. */
export interface StoredBoard {
  /** Digit string ("0"/"1"/"2") of length N*N, row-major. */
  readonly cells: string;
  /** Whether the puzzle has been fully and correctly solved. */
  readonly solved: boolean;
}

/** The localStorage key for a given `YYYY-MM-DD` date. */
export function storageKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

interface StoredPayload {
  cells: string;
  solved: boolean;
}

/** In-memory fallback, keyed by the same localStorage key strings. */
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Read a raw value, transparently falling back to the in-memory map. */
function readRaw(key: string): string | null {
  const ls = storage();
  try {
    if (ls) return ls.getItem(key);
  } catch {
    // fall through to memory
  }
  return memory.get(key) ?? null;
}

/** Write a raw value, transparently falling back to the in-memory map. */
function writeRaw(key: string, value: string): void {
  const ls = storage();
  try {
    if (ls) {
      ls.setItem(key, value);
      return;
    }
  } catch {
    // fall through to memory
  }
  memory.set(key, value);
}

/** Clear the in-memory fallback map. Exposed for tests. */
export function __clearMemoryForTests(): void {
  memory.clear();
}

/** Read today's board from storage, or null if absent/unreadable/corrupt. */
export function readBoard(date: string): StoredBoard | null {
  const raw = readRaw(storageKey(date));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.cells !== "string") return null;
    if (typeof parsed.solved !== "boolean") return null;
    // Decode then re-encode to validate the digit string and normalize it.
    const decoded = decodeCells(parsed.cells);
    const cells = encodeCells(decoded);
    return { cells, solved: parsed.solved };
  } catch {
    return null; // corrupt payload -> treat as missing
  }
}

/** Persist a board on every change, falling back to memory if localStorage fails. */
export function writeBoard(date: string, board: { readonly size: number; readonly cells: CellState[]; readonly solved: boolean }): void {
  const payload = JSON.stringify({ cells: encodeCells(board.cells), solved: board.solved });
  writeRaw(storageKey(date), payload);
}
