## Context

See `proposal.md` for motivation and the specs under `specs/` for required behavior. The current code shapes the approach in these ways:

- `core/` is pure and DOM-free: `puzzle.ts` (types, cell encoding), `rules.ts` (`conflicts`, `isSolved`), `solver.ts` (`countSolutions`, `twoSolutions`, a row-by-row bitmask backtracker), `generator/` (`generate(version, seed, size)` dispatching to `v1.ts`), and `daily.ts` (launch date, weekday size table, version table, seed strings).
- `app.ts` is one flow built around a single date: `loadDate` generates the puzzle, reads `storage.ts`, drives one `BoardController`, and owns the timer, clear and win logic.
- `ui/board.ts`'s `BoardController` draws one N x N grid and calls `rules.conflicts` itself inside `render()`.
- `router.ts` only understands `#/<date>`.
- Daily determinism is a long-lived contract. The existing "determinism snapshot" test in `generator.test.ts` only checks that two runs in the same process agree. It does **not** pin past layouts, so it would not catch an accidental change to `v1`.

## Goals / Non-Goals

**Goals:**
- Add Deep Water as a second mode that reuses as much of the classic engine and UI as possible, without changing any classic output or URL.
- Keep the tank logic pure and unit-testable in `core/`, like the classic logic.
- De-risk generation (uniqueness + "no layer solvable alone" + speed) before building any UI.

**Non-Goals:**
- A general K-layer engine. The code uses a `LAYERS = 2` constant and most loops are written against it, but only 2 layers is supported or tested.
- A general "mode plugin" framework. A small adapter shared by two modes is enough.
- Moving generation to a Web Worker, unless the prototype shows it is needed (see Risks).

## Decisions

### Tank data model: flat arrays, layer-major, global pond ids
`DeepPuzzle { size, ponds: number[] }` with `ponds.length === 2 * N * N`, indexed `layer * N*N + row * N + col`. Pond ids are global: layer L uses ids `L*N .. L*N + N-1`. A `DeepBoard` uses the same layout for `cells: CellState[]`, so `encodeCells`/`decodeCells` work unchanged and saved data is one digit string of length 2N².

A helper `layerPuzzle(deep, L): Puzzle` returns a classic `Puzzle` for one layer (pond ids remapped to `0..N-1`). This lets the classic solver, pond-color assignment and `BoardController` work on a single layer without changes.

*Alternatives:* an array of `Puzzle` objects (one per layer) is more readable, but needs a second encoding for storage and makes the solver juggle several structures. Flat arrays match the existing style.

### Rules: one new module, classic rules reused per layer
`core/deep/rules.ts` exposes `deepConflicts(puzzle, board): Set<number>` (flat tank indices) and `isDeepSolved`. It runs the classic `conflicts` on each layer slice, then adds the cross-layer checks: the pillar rule (same row/col in any two layers) and edge-to-edge touching between layers L and L±1 (same row and |dc| = 1, or same column and |dr| = 1: the "+" shadow). (Implementation note: `deepConflicts` checks every fish pair directly rather than calling the classic `conflicts` per layer; the result is the same.)

### Solver: rows outermost, every layer per row
`core/deep/solver.ts` exposes `countDeepSolutions(puzzle, limit)` and `findDeepSolutions(puzzle, limit)` (returns placements as `cols[layer][row]`). It extends the classic idea: since every layer has exactly one fish per row, every rule only links a row to itself and to the row above:

- **Same row:** the columns must be different (pillar rule) and differ by more than 1 (side-by-side touching between the layers).
- **Previous row:** within a layer, the column must differ by more than 1 from that layer's previous-row column. Between the layers, it must not equal the other layer's previous-row column (above/below touching). A diagonal offset between layers is allowed.
- **Bitmasks:** each layer keeps a used-column mask and a used-pond mask, like the classic solver.

So the search goes row by row, and at each row picks a column for layer 0, then layer 1. Each branch is pruned by the constraints above, which keeps it fast.

*Alternatives:* solving layer by layer (list all solutions of layer 0, then layer 1 that fit them, and so on) is simple, but layers are deliberately ambiguous, so the per-layer lists can be large. Row-major search prunes across layers immediately.

### Generator `deep-v1`
`core/deep/generator.ts`, registered under its own version table (`DEEP_VERSIONS`), never in the classic `VERSIONS` map. All randomness uses the existing `Rng` and follows the determinism rules from `initial-game/design.md` (no `Math.random`, no comparator sorts with ties, no unordered iteration).

```
 1. place fish      choose cols[L][r] row by row, layers 0..2, over
                    PRNG-shuffled column orders, backtracking on the
                    same-row and previous-row constraints above
                    -> the intended solution
 2. grow ponds      per layer, reuse the classic pond-growing step
                    seeded from that layer's fish
 3. layer check     each layer alone: countSolutions(layerPuzzle, 2) must
                    be 2. A layer that is already unique alone gets
                    re-grown (same RNG stream) up to R times, else restart
 4. tank check      findDeepSolutions(tank, 2):
                      only the intended solution -> done
                      another one exists         -> repair
 5. repair          pick a layer where the other solution differs from
                    the intended one; try classic-style collision moves
                    in that layer (move one of the other solution's fish
                    cells into a neighboring pond that already holds
                    another of its fish), keep = intended, kill = other.
                    Accept the first move that keeps both ponds
                    contiguous AND leaves that layer still ambiguous
                    alone (step 3). Repeat up to K times, else restart
```

Repair always keeps the **intended** placement, not whichever solution the search happened to find first. That way the intended solution stays valid through every repair, and step 4 only ever has to rule out others.

To reuse the classic helpers, `growPonds` and the repair move search are exported from `v1.ts` (or moved into a shared module) **with no logic change**. The pinned-snapshot test below proves classic output did not move.

*Alternatives:* (a) build independent unique classic layers and add cross-layer rules on top. This breaks the "no layer solvable alone" requirement by construction. (b) Generate many random tanks and keep the first that passes, with no repair. This is simple but likely too slow for the time budget.

### Pin classic layouts before touching shared code
Before any refactor, add a test that pins the actual `v1` pond arrays for a fixed list of dates (all sizes 7–11) as literal expected values. Deep Water gets the same kind of pinned test for `deep-v1` once its algorithm is final.

### Why a "+" shadow, and why 8 x 8
The first draft blocked the whole 3 x 3 block above and below a fish. A brute-force count over all valid single-layer placements found **zero** valid neighboring-layer pairs at sizes 5–7 and zero full tanks at 8: every fish blocks columns in three rows of the next layer, which leaves no room. The "+" shadow keeps the 3D feel and is feasible:

| Cross-layer rule      | 7 x 7 tanks | 8 x 8 tanks |
|-----------------------|-------------|-------------|
| 3 x 3 shadow          | 0           | 0           |
| "+" shadow (chosen)   | 80 (3 layers), 108 (2 layers) | plenty (21,596 two-layer layouts) |
| pillar only           | plenty      | plenty      |

80 base layouts at 7 x 7 would make puzzles repetitive, so Deep Water is 8 x 8 every day.

### Revision after playtesting: two layers, not three
The first build shipped to playtesters with three layers (surface, middle, deep). Playtesting found it too difficult, so the tank is now two layers (surface, deep) at the same 8 x 8 size:

- With two layers, surface and deep **are** neighbors, so the "+" rule now applies between them. (With three layers, surface and deep could touch.)
- 8 x 8 stays: under the "+" rule a two-layer 7 x 7 tank has only 108 valid fish layouts, still too few for varied puzzles. At 8 x 8 there are 21,596.
- `deep-v1` is redefined in place rather than bumped to `deep-v2`, because Deep Water has not been released yet, so no player has a dated tank to protect. Saved three-layer boards from playtesting are 192 cells long, not 128, so the existing length check loads those dates fresh.
- Everything else (the "no layer solvable alone" guarantee, uniqueness, routing, storage, timer) is unchanged.

### Daily mapping: parallel constants, not a generalized table
In `daily.ts`, add `DEEP_LAUNCH_DATE` (set to the release date when shipping), `DEEP_SIZE = 8`, `DEEP_VERSION_TABLE = [{ from: DEEP_LAUNCH_DATE, version: "deep-v1" }]`, and mode-aware variants of `seedForDate`, `puzzleNumber`, `clampDate`, `canPrev` and `canNext` that take a `mode: "classic" | "deep"`. The classic functions keep their signatures and outputs. Deep seeds are `fishdoku:deep-v1:<date>`.

### Routing: `#/deep/<date>`
`parseHash` returns `{ mode, date }`. `#/deep/<date>` and `#/deep` mean Deep; anything else is parsed as today (Classic). `redirectToAvailable` and `navigateTo` take the mode and keep its prefix. Out-of-range Deep dates redirect to `#/deep/<today>`.

### Storage: separate namespace, same payload
Deep boards go under `fishdoku:v1:deep:<date>` with the same `{ cells, solved, elapsedMs, solvedMs }` payload, and the same length check on load (a wrong length means start fresh). Classic keys are untouched.

### App: a small mode adapter around the existing flow
Instead of forking `app.ts`, add a `ModeAdapter` that holds what differs between modes: the cell count, how to generate, `isSolved`, the storage key, the header label, share text fields and which board view to use. `loadDate(date)` becomes `load(mode, date)` and goes through the adapter. Timer, clear confirmation, win-lock and visibility handling stay shared, so Deep gets Classic's timer and clear behavior for free (as the spec requires).

### Board UI: one `BoardController` per layer in a `DeepBoardView`
`ui/deep-board.ts` creates one `BoardController` instance per layer, one per layer, each set up with `layerPuzzle(deep, L)`. Two small changes to `BoardController`:

- `RenderOptions` gains an optional `conflictSet` (indices local to that grid). When given, it replaces the internal `rules.conflicts` call, so cross-layer conflicts show correctly. Classic rendering passes nothing and is unchanged.
- An optional hover/focus callback with `(row, col)`, plus a method to set a "pillar highlight" class on one cell.

Layout is CSS-driven: a `.deep-tank` container with a wide-screen breakpoint (720 px) that puts the two layers in a row. Below it, a tab strip (`surface | deep`) picks the full-size layer, and the other renders as a small read-only map (the same DOM at a small cell size, with input disabled). The deep layer gets a darker tint (`data-layer="1"`). Pond colors are assigned per layer with the existing `assignPondStyles`.

## Risks / Trade-offs

- **[Layer ambiguity fights joint uniqueness]** Loose layers make it hard to get a unique tank, and repairs may make layers unique alone. → Phase 1 of the tasks is a headless generator prototype with a benchmark over ~200 dates at N = 8. It measures success rate, restarts and time. 7 x 7 is not a fallback (only 80 base layouts), so if the budget is missed the mitigations in the next item apply.
  - *Benchmark result (task 3.4, desktop, `npx vite-node scripts/bench-deep.ts`):* 200 days from 2026-12-01: 200/200 succeeded, p50 1.1 ms, p95 3.7 ms, max 10.5 ms, 1.12 attempts and 0.84 repairs per tank on average. 365 days from 2027-06-01: 365/365, p95 3.1 ms, max 6.7 ms. Each layer alone has 2–384 classic solutions (median 36), so the layers really do need each other. The "+" rule constrains the tank so strongly that uniqueness rarely needs repairs. No mitigation needed.
  - *Implementation note (task 3.2):* only `growPonds` and `pondsHasEmptyOrDisconnected` are exported from `v1.ts`. Deep Water uses its own repair move search (`repairLayer`), because each move must also keep the layer ambiguous on its own.
  - *Two-layer re-run (task 8.2, desktop):* 200 days from 2026-12-01: 200/200, p50 0.6 ms, p95 2.5 ms, max 21.7 ms, 1.34 attempts and 7.16 repairs per tank on average (one outlier day hit the repair limit and restarted). 365 days from 2027-06-01: 365/365, p95 1.9 ms, max 3.7 ms. Each layer alone now has 2–241 classic solutions (median 25, down from 36), so a layer needs fewer cross-layer deductions to pin down.
  - *Throttled measurement (task 7.1, Chrome with DevTools CPU throttling, 120 daily seeds):* 1×: p95 3.6 ms, max 4.3 ms; 4×: p50 4.6 ms, p95 14.6 ms, max 17.1 ms; 6×: p95 21.7 ms, max 28.0 ms. That is more than 30× under the 1000 ms phone budget, so the caching and Web Worker mitigations below were not needed.
- **[Generation over 1000 ms on phones]** → Options in order of preference: tune R/K and restart limits; cache generated tanks in `localStorage` keyed by seed, so the cost is only paid once per date; move generation to a Web Worker with a "filling the tank..." placeholder.
- **[Three 8 x 8 layers are dense on desktop and cramped on phones]** → One layer at a time on phones, with mini-maps; cell size computed from the available width per layer. Check on a 360 px viewport and a 1280 px desktop as part of the tasks.
- **[Accidentally changing classic puzzles while extracting helpers]** → The pinned v1 snapshot test lands first and must stay green through every task.
- **[Cross-layer reasoning is hard to learn]** → Pillar highlighting plus a short help section with a small ASCII example of the "+" shadow a fish casts on the layers next to it.

## Migration Plan

Purely additive: no stored data or URL changes for Classic. Deploy as usual through the GitHub Pages workflow. Set `DEEP_LAUNCH_DATE` to the actual release date in the release commit. After release, the `deep-v1` output is frozen like `v1`. Rollback means hiding the mode switch. Deep boards already saved in `localStorage` are harmless if left behind.

## Open Questions

- Should ruled-out marks appear on the phone mini-maps, or only fish? The spec says both; this can change after testing it on a device without affecting the rest.
- Exact tint colors per layer for the light and dark themes. This is a styling choice made during implementation.
