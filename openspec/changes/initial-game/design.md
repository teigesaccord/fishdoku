## Context

This is a greenfield project; nothing exists yet besides the OpenSpec scaffolding. See `proposal.md` for motivation and scope, and the specs under `specs/` for required behavior. The key constraints that shape this design are:

- There is no backend. Everything runs in the browser and is served as static files.
- Daily puzzles must be identical for every player. This determinism is a long-lived contract, because old dates must keep producing the same puzzle.
- The game must play well on phones (touch, narrow screens) as well as desktops.
- All art is ASCII. There is no image pipeline.

## Goals / Non-Goals

**Goals:**
- A small, dependency-light codebase where the game logic (rules, solver, generator, daily mapping) is pure TypeScript with no DOM access, so it can be unit-tested headlessly.
- A generator that is fast and deterministic, and only ever returns puzzles with a unique solution.
- An architecture that later changes (hints, timer, undo, stats) can extend without restructuring.

**Non-Goals:**
- Difficulty grading. The generator only guarantees uniqueness, not a particular solving technique depth.
- Offline/PWA install support. It should be easy to add later but is not part of this change.
- Server-side rendering, accounts, analytics, or any network calls.

## Decisions

### Stack: TypeScript + Vite, plain DOM, Vitest
The UI is essentially one grid and a header, which doesn't justify a framework. Plain DOM keeps the bundle tiny and avoids framework churn. Vite provides the dev server and static build, and Vitest shares Vite's config for tests.
*Alternatives:* Svelte or Preact were reasonable, but they add a dependency and learning surface for little gain at this size. React is too heavy for this size.

### Module layout
```
src/
  core/            pure logic, no DOM
    rng.ts         seeded PRNG + string hash
    puzzle.ts      types: Puzzle, Board, CellState
    rules.ts       conflicts(), isSolved()
    solver.ts      countSolutions(puzzle, limit)
    generator/
      index.ts     generate(version, seed, size) -> dispatch by version
      v1.ts        the v1 algorithm
    daily.ts       date <-> seed/size/number, launch date, bounds
  ui/              DOM rendering and input
    board.ts       grid rendering, cell input
    header.ts      date nav, puzzle label, solved indicator
    win.ts         win screen overlay
    theme.css      tokens, light/dark, pond palette
  storage.ts       localStorage wrapper (try/catch, no-op fallback)
  router.ts        hash-based date routing
  main.ts          wires it together
```
The `core/` folder is the testable heart of the project. `ui/` depends on `core/`, but `core/` never depends on `ui/`.

### Determinism: integer-only seeded PRNG
- **Seed derivation:** the seed string is `fishdoku:<version>:<YYYY-MM-DD>`, hashed to 128 bits with `cyrb128`. That hash seeds `sfc32`. Both use only 32-bit integer operations (`Math.imul`, `>>> 0`, bit shifts), which are exactly specified in JavaScript, so results don't vary across engines.
- **Rules inside the generator:**
  - never call `Math.random`
  - never use `Array.prototype.sort` with a comparator that can return ties (or not at all), because sort stability and algorithm are engine details; shuffle with Fisher-Yates driven by the PRNG instead
  - never iterate over objects or sets whose order isn't guaranteed
  - floating point only where the result is immediately floored from an integer-derived value
- **Regression guard:** a snapshot test pins the pond layouts for a fixed list of dates. If the test fails, the change silently altered past puzzles.

*Alternatives:* `mulberry32` is simpler but has only a 32-bit state, while `sfc32` is still tiny and has better statistical quality. Pre-generating puzzles into a JSON file would sidestep cross-engine determinism, but it needs a build or cron step and caps how far ahead the archive goes, and the determinism rules above are easy enough to follow.

### Generator versioning
`generate(version, seed, size)` dispatches to a version module. `daily.ts` has a small ordered table:
```
[{ from: LAUNCH_DATE, version: "v1" }]
```
Each date uses the latest entry whose `from` date is on or before it. A future v2 is added with a later `from` date, and v1 stays in the code forever.

### Generator v1 algorithm
```
 1. place fish     random permutation p[row] = col with |p[r]-p[r+1]| > 1
                   (backtracking over shuffled columns per row)
 2. grow ponds     each fish cell seeds one pond; repeatedly pick a
                   random frontier cell (unassigned, orthogonally next to
                   a pond) and attach it to a random adjacent pond, until
                   every cell is assigned
 3. check          countSolutions(puzzle, limit=2)
                      == 1  -> done
                      >= 2  -> repair
 4. repair         take the second solution found; pick a fish cell in it
                   that differs from the intended solution; move that cell
                   into a neighboring pond if doing so keeps both ponds
                   contiguous and doesn't move an intended fish cell;
                   go to 3. After K failed repairs, restart from step 1
                   with the RNG's current state.
```
The intended fish placement is a valid solution by construction, so step 3 only has to rule out other solutions. Repair tends to converge quickly because it directly removes the alternative solution that was found. Because every random choice comes from the seeded PRNG, the restarts are deterministic too.

*Alternative:* generating random pond layouts first and then checking for uniqueness has a far lower hit rate, because most random layouts have zero or many solutions.

### Solver
The solver is a row-by-row backtracking search. It keeps bitmasks for used columns and used ponds, and checks adjacency only against the previous row's fish column, which is enough because each row holds exactly one fish. It visits candidate columns in a fixed order, and stops as soon as it reaches `limit` solutions. N is at most 11 and pruning is strong, so it runs in microseconds to milliseconds. The rules and solver live in `core/` so future hints can reuse them.

### Board state and persistence
- **Cell state encoding:** `0` = empty, `1` = ruled out, `2` = fish, stored as a string of digits of length N*N.
- **Storage key:** `fishdoku:v1:board:<YYYY-MM-DD>`, holding `{ cells, solved }`.
- **Storage wrapper:** every `localStorage` access is wrapped in try/catch. If storage fails, the wrapper falls back to an in-memory map, so the game still works in private windows or with storage blocked.
- **Saving:** the board is saved on every change.

### Routing
The current date lives in the URL hash, e.g. `/#/2026-11-16`. Hash routing needs no server rewrite rules, so any static host works. An invalid, future or pre-launch date redirects to today, using `replaceState` so it doesn't add a history entry.

### Launch date
`LAUNCH_DATE = 2026-11-16`, a Monday. Puzzle #1 is therefore a 7 x 7. Earlier dates are out of range.

### Hosting: Railway
The site deploys to Railway as a static Vite build. The first approach is to let Railway's builder (Railpack) detect the Vite app, run `npm run build`, and serve `dist/` statically. If that needs too much configuration, the fallback is a tiny static server as the start command (for example `serve dist`, listening on Railway's `$PORT`). Hash routing means neither option needs SPA rewrite rules. A Railway-generated public domain is enough for this change.
*Alternatives:* GitHub Pages or Netlify are purely static and slightly simpler, but the user already uses Railway.

### Dates
All date math uses the player's local calendar date, built from `getFullYear/getMonth/getDate` and formatted as `YYYY-MM-DD`. Day differences are computed through `Date.UTC(y, m, d)` so daylight-saving shifts can't produce off-by-one errors. The day of the week comes from the same UTC date.

### Rendering: CSS grid with ASCII content
- **Cells:** the board is a CSS grid of `<button>` cells, so touch, mouse and keyboard activation behave alike (as the spec requires). It also gives accessibility for free, with `aria-label`s such as "row 3, column 5, fish".
- **Pond boundaries:** each cell gets a heavier border on each side where the neighboring cell belongs to a different pond, computed once per puzzle.
- **Texture:** an empty cell shows its pond's texture character, dimmed. The 11 textures, in order, are `~ . : ' " * - + = ^ ,`.
- **Colors:** each pond also gets a background tint from an 11-color palette with light and dark variants. Textures and colors are assigned by greedy graph coloring over pond adjacency, so neighboring ponds always differ.
- **Fish:** `><>` or `<><`. The direction is derived from a hash of (date, row, col), so it stays stable across re-renders.
- **Conflicting fish:** shown as `>x>` with the conflict color, which works without color.
- **Cell size:** `--cell = min((100vw - 32px) / N, 56px)`. The font size scales with `--cell`, so `><>` fits. At 360px wide and N=11, this gives about 29px per cell (spec minimum: 28px).

### Win screen and clear confirmation
- **Win screen:** an in-page overlay showing an ASCII fish and the date or puzzle number. It doesn't use browser `alert`.
- **Clear confirmation:** also in-page. The first tap changes the button to "really clear?", and a second tap within a few seconds clears the board.

### Testing
- **Unit tests (Vitest):** rules and conflict detection, solver correctness on hand-made puzzles, and generator properties across many seeds and all sizes (contiguity, N ponds, exactly one solution).
- **Date math:** daily mapping tests covering weekday sizes, bounds, numbering and DST dates.
- **Determinism:** the snapshot test for determinism.
- **Performance:** a perf test that generates 365 days of puzzles and reports the worst case.

## Risks / Trade-offs

- **[Accidentally changing v1 output]** → The determinism snapshot test fails on any change to pond layouts. Treat `generator/v1.ts` and `rng.ts` as frozen once launched, and put improvements in a new version.
- **[Repair loop slow or non-terminating for some seeds]** → Cap repairs per attempt and restart. The 365-day perf test catches outliers, and a hard attempt cap gives a final safety net (a deterministic fallback to the next attempt).
- **[Uniqueness doesn't guarantee fun]** → Some puzzles may be very easy or need deep lookahead. This is acceptable for the first version, and difficulty tiers are an explicitly deferred change.
- **[11 x 11 on 320px screens]** → Cells shrink to about 26px, below the 28px target, which applies at 360px. The board is still playable. Reducing the gutter on very narrow screens can recover a little space.
- **[Changing the launch date after release]** → It would renumber puzzles and change bounds. `LAUNCH_DATE` is fixed at 2026-11-16 and must not change after the first public deploy.
- **[Players in different time zones see "today" at different moments]** → This is intentional and matches the Wordle model. Puzzles are keyed by date, not by instant, so everyone still gets the same puzzle for a given date.

## Migration Plan

This is the first release, so there is nothing to migrate. To deploy, create a Railway project and service from the repo, let Railway build and serve the Vite output (or use the `serve dist` fallback), and generate a public domain. To roll back, redeploy the previous successful deployment from Railway's deployment history. Saved boards are keyed by date and storage version, so older builds ignore anything they don't understand.

## Open Questions

- **Color palette values:** pick these during implementation. They don't affect behavior beyond the `visual-style` spec.
