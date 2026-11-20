/**
 * Deterministic seeded PRNG.
 *
 * Everything here uses 32-bit integer operations only (Math.imul, >>> 0, <<, ^)
 * which are exactly specified in ECMAScript and produce identical results across
 * every JavaScript engine. This is the foundation of cross-engine determinism:
 * the same seed always yields the same sequence, forever.
 */

/** cyrb128: hash an arbitrary string to a 128-bit state [a, b, c, d]. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703 >>> 0;
  let h2 = 3144134277 >>> 0;
  let h3 = 1013904242 >>> 0;
  let h4 = 277348076 >>> 0;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 2950171384);
    h2 = Math.imul(h2 ^ k, 3266489917);
    h3 = Math.imul(h3 ^ k, 668265265);
    h4 = Math.imul(h4 ^ k, 2246822507);
  }
  h1 = Math.imul(h2 ^ (h1 >>> 18), 31) >>> 0;
  h2 = Math.imul(h4 ^ (h2 >>> 42), 37) >>> 0;
  h3 = Math.imul(h1 ^ (h3 >>> 17), 49) >>> 0;
  h4 = Math.imul(h3 ^ (h4 >>> 18), 23) >>> 0;
  return [h1, h2, h3, h4];
}

/**
 * sfc32: a small 128-bit counter PRNG. Returns a function producing floats in
 * [0, 1). Uses only integer ops plus one final division that is floored via the
 * caller (nextInt), so no uncontrolled floating point leaks into outputs.
 */
function makeSfc32(
  a: number,
  b: number,
  c: number,
  d: number,
): () => number {
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    b = c ^ (c >>> 15);
    c = d ^ (d >>> 16);
    d = (d + 0x7746ac9c) | 0;
    const t = (a + b) | 0;
    // Reinterpret the XOR result as unsigned before dividing so next() lands in
    // [0, 1). Without `>>> 0` the `^` operator coerces to a signed int32 and the
    // value would span [-0.5, 0.5), breaking every downstream integer draw.
    return ((t ^ (d >>> 0)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with a reproducible integer-only implementation. */
export class Rng {
  private readonly rand: () => number;

  constructor(seed: [number, number, number, number]) {
    this.rand = makeSfc32(
      seed[0] >>> 0,
      seed[1] >>> 0,
      seed[2] >>> 0,
      seed[3] >>> 0,
    );
  }

  /** Build a PRNG from a string by hashing it with cyrb128 first. */
  static fromString(str: string): Rng {
    return new Rng(cyrb128(str));
  }

  /** A float in [0, 1). */
  next(): number {
    return this.rand();
  }

  /** A uniform integer in [0, n) by flooring an integer-derived value. */
  nextInt(n: number): number {
    if (!Number.isFinite(n) || n <= 0) {
      throw new RangeError(`nextInt expects a positive finite number, got ${n}`);
    }
    return Math.floor(this.rand() * n);
  }

  /** In-place Fisher-Yates shuffle driven entirely by the PRNG. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}
