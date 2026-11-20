/**
 * Generator dispatch: pick a puzzle by generation version.
 *
 * `generate(version, seed, size)` returns a well-formed, uniquely solvable
 * puzzle for the requested version. Daily puzzles carry an explicit version so a
 * future generator can be added without changing any earlier output (see daily.ts).
 */

import type { Puzzle } from "../puzzle";
import { generateV1 } from "./v1";

export interface GeneratorVersion {
  readonly id: string;
  readonly generate: (seed: string, size: number) => Puzzle;
}

/** All known generator versions. Ordered by the date each became active. */
const VERSIONS: Record<string, GeneratorVersion> = {
  v1: { id: "v1", generate: generateV1 },
};

/** A puzzle together with the version that generated it. */
export interface GeneratedPuzzle extends Puzzle {
  readonly version: string;
}

/**
 * Generate a puzzle for the given version, seed and size (7..11). Throws on an
 * unknown version so callers fail loudly rather than silently using a default.
 */
export function generate(version: string, seed: string, size: number): GeneratedPuzzle {
  const impl = VERSIONS[version];
  if (!impl) {
    throw new Error(`Unknown generator version "${version}"`);
  }
  return { ...impl.generate(seed, size), version };
}
