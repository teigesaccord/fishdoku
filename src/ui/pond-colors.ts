/**
 * Pond texture and color assignment.
 *
 * Pure logic (no DOM) so it can be unit-tested headlessly. Each pond gets one
 * character from the 11-texture list and one background tint from the 11-color
 * palette, chosen by greedy graph coloring over pond adjacency. Because there
 * are exactly as many palette entries as the largest pond count (N <= 11), each
 * pond ends up with its own unique texture and color, so ponds are easy to tell
 * apart and adjacent ponds never share either. Textures and colors are assigned
 * independently as a defense in depth: if two ponds were ever indistinguishable
 * by tint, their textures would still differ (and vice versa).
 */

import type { Puzzle } from "../core/puzzle";
import { idx } from "../core/puzzle";

/** The 11 pond characters shown dimmed on empty cells, in design.md order. */
export const TEXTURES: readonly string[] = ["~", ".", ":", "'", '"', "*", "-", "+", "=", "^", ","];

/** The 11 background-tint class names, matching the `.board-cell[data-pond="n"` rules in theme.css. */
export const POND_COLORS: readonly string[] = [
  "pond-0",
  "pond-1",
  "pond-2",
  "pond-3",
  "pond-4",
  "pond-5",
  "pond-6",
  "pond-7",
  "pond-8",
  "pond-9",
  "pond-10",
];

/** Per-pond style, indexed by pond id. */
export interface PondStyles {
  /** Texture character per pond id. */
  readonly textures: string[];
  /** Background-tint class name per pond id. */
  readonly colors: string[];
}

/** Count of distinct ponds (max pond id + 1) in a flat pond grid. */
function pondCount(ponds: number[]): number {
  let n = 0;
  for (const p of ponds) if (p + 1 > n) n = p + 1;
  return n;
}

/** Smallest index in [0, max) not present in `used`, preferring `preferred` if free. */
function firstFree(used: Set<number>, max: number, preferred: number): number {
  // Prefer the pond's own index. Since ponds are colored in ascending order and
  // a pond has at most four orthogonal neighbours (all with lower ids already
  // fixed to their own index), `preferred` is normally free. That gives every
  // pond a *unique* texture/color while still guaranteeing adjacent ponds
  // differ, which makes pond boundaries easy to see.
  if (preferred >= 0 && preferred < max && !used.has(preferred)) return preferred;
  for (let i = 0; i < max; i++) if (!used.has(i)) return i;
  // Defensive fallback if there are ever more ponds than palette entries.
  return Math.min(used.size, max - 1);
}

/**
 * Assign one texture and one tint to every pond by greedy coloring over pond
 * adjacency (a pond touches another if any of its cells shares an edge with a
 * cell of the other). Iterating ponds in ascending id order makes this
 * conflict-free: for any adjacent pair, the higher-id pond is colored second and
 * avoids the lower-id neighbor's already-fixed choices. Returns styles indexed by
 * pond id.
 */
export function assignPondStyles(puzzle: Puzzle): PondStyles {
  const size = puzzle.size;
  const ponds = puzzle.ponds;
  const n = pondCount(ponds);

  // Build adjacency once from shared edges, then color each pond by least index.
  const adj = Array.from({ length: n }, () => new Set<number>());
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = idx(r, c, size);
      const p = ponds[i];
      if (c + 1 < size) {
        const q = ponds[idx(r, c + 1, size)];
        if (q !== p) {
          adj[p].add(q);
          adj[q].add(p);
        }
      }
      if (r + 1 < size) {
        const q = ponds[idx(r + 1, c, size)];
        if (q !== p) {
          adj[p].add(q);
          adj[q].add(p);
        }
      }
    }
  }

  const textureIdx = new Array<number>(n).fill(-1);
  const colorIdx = new Array<number>(n).fill(-1);
  for (let pid = 0; pid < n; pid++) {
    const usedT = new Set<number>();
    const usedC = new Set<number>();
    adj[pid].forEach((other) => {
      if (colorIdx[other] >= 0) {
        usedT.add(textureIdx[other]);
        usedC.add(colorIdx[other]);
      }
    });
    textureIdx[pid] = firstFree(usedT, TEXTURES.length, pid);
    colorIdx[pid] = firstFree(usedC, POND_COLORS.length, pid);
  }

  return {
    textures: textureIdx.map((t) => TEXTURES[t]),
    colors: colorIdx.map((c) => POND_COLORS[c]),
  };
}
