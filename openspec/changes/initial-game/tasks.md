## 1. Project setup

- [x] 1.1 Scaffold a Vite + TypeScript (vanilla) project with strict TS and the `src/core`, `src/ui` layout from design.md; verify `npm run dev` serves a page and `npm run build` produces `dist/`
- [x] 1.2 Add Vitest with an `npm test` script; verify a placeholder test passes

## 2. Core: RNG and puzzle model

- [x] 2.1 Implement `core/rng.ts` (`cyrb128` string hash, `sfc32` PRNG, `nextInt(n)`, Fisher-Yates `shuffle`) using integer ops only; verify unit tests pin the first outputs for a fixed seed
- [x] 2.2 Define `core/puzzle.ts` types (`Puzzle` with size and pond grid, `CellState`, `Board`) plus a pond contiguity helper (`isPondConnected`/`allPondsContiguous`); verify unit tests detect contiguous and non-contiguous ponds

## 3. Core: rules and solver

- [x] 3.1 Implement `core/rules.ts` `conflicts(puzzle, board)` covering row, column, pond and 8-neighbor touching; verify a test for each scenario in `puzzle-rules`
- [x] 3.2 Implement `isSolved(puzzle, board)` that ignores ruled-out marks; verify tests for the complete, incomplete and ruled-out scenarios
- [x] 3.3 Implement `core/solver.ts` `countSolutions(puzzle, limit)` (row-by-row backtracking, column/pond bitmasks, previous-row adjacency); verify against hand-made puzzles with 0, 1 and 2+ solutions

## 4. Core: generator v1

- [x] 4.1 Implement fish placement (permutation with no diagonal touching between rows) driven by the PRNG; verify that across 1000 seeds every placement is valid
- [x] 4.2 Implement pond growth from fish seeds via frontier attachment to the lowest-id adjacent pond; verify N contiguous ponds covering every cell across many seeds and all sizes
- [x] 4.3 Implement the uniqueness check, repair loop and restart cap; verify that across 200 seeds per size (7 to 11) `countSolutions(puzzle, 2) === 1`
- [x] 4.4 Implement `generator/index.ts` version dispatch (`generate(version, seed, size)`); verify an unknown version throws and `"v1"` dispatches correctly
- [x] 4.5 Add the determinism snapshot test (pond layouts for a fixed list of about 15 dates covering all sizes); verify it passes twice in a row and fails if the generator is tweaked
- [x] 4.6 Add a perf test that generates 365 consecutive days and reports the worst-case time; verify the worst 11x11 case is well under 500 ms on a desktop (headroom for phones)

## 5. Core: daily mapping

- [x] 5.1 Implement `core/daily.ts`: `LAUNCH_DATE`, local `today()`, `YYYY-MM-DD` parse/format, weekday->size table, puzzle number, version table lookup and seed string; verify tests for weekday sizes, numbering and DST-boundary dates
- [x] 5.2 Implement date bounds (`clampDate`, `prev`/`next` availability, invalid/future/pre-launch handling); verify tests for each `daily-puzzle` navigation scenario

## 6. Storage and routing

- [x] 6.1 Implement `storage.ts` (per-date `{cells, solved}` under `fishdoku:v1:board:<date>`, try/catch, in-memory fallback); verify tests with a working mock and a throwing mock of `localStorage`
- [x] 6.2 Implement `router.ts` hash routing (`#/YYYY-MM-DD`, redirect invalid dates to today with `replaceState`); verify by manually opening valid, future and malformed hashes in the browser

## 7. UI: theme and board

- [x] 7.1 Create `ui/theme.css`: color tokens, light/dark via `prefers-color-scheme`, 11-color pond palette, monospace font, `--cell` sizing formula; verify both themes by toggling the OS or devtools color scheme
- [x] 7.2 Implement pond texture/color assignment via greedy coloring over pond adjacency; verify a unit test that adjacent ponds never share a texture or color
- [x] 7.3 Implement `ui/board.ts`: a CSS grid of `<button>` cells, heavy borders on pond boundaries, textures, `x`, `><>`/`<><` with a stable hashed direction, and `aria-label`s; verify visually at sizes 7 and 11
- [x] 7.4 Wire the tap cycle (empty -> x -> fish -> empty) with live conflict rendering (`>x>` plus the conflict color); verify manually that conflicts appear and clear as fish are added and removed

## 8. UI: header, win, clear

- [x] 8.1 Implement `ui/header.ts`: ASCII title, date and puzzle #, prev/next buttons disabled at bounds, solved indicator; verify by navigating to today, the launch date and a solved date
- [x] 8.2 Implement the two-tap "clear" with a timed revert (no browser dialogs); verify that a single tap does not clear and a double tap does
- [x] 8.3 Implement `ui/win.ts`: ASCII fish win overlay, dismissible, board locked after the win, no replay when revisiting a solved date; verify by solving a puzzle (use solver output in devtools)
- [x] 8.4 Wire `main.ts`: route -> daily -> generate -> restore from storage -> render; save on every change; verify that progress survives a reload and stays separate per date

## 9. Verification and release prep

- [x] 9.1 Responsive check: verify an 11x11 puzzle fits without horizontal scroll at 320px and 360px widths, cells are at least 28px at 360px, and a 7x7 board is capped and centered at 1920px (devtools device mode)
- [ ] 9.2 Cross-browser determinism check: open the same 3 dates in Chrome and Firefox (plus mobile Safari if available) and confirm the pond layouts match each other and the snapshot test data
- [x] 9.3 Confirm there are no raster or illustration assets in `dist/` and no `Math.random` in `src/core/generator` or `src/core/rng.ts` (grep)
- [x] 9.4 Confirm `LAUNCH_DATE` is `2026-11-16`, run `npm test` and `npm run build`; verify all tests pass and `dist/` serves correctly via `npx vite preview`
- [ ] 9.5 Deploy to Railway (Railpack static build of `dist/`, or a `serve dist` start command on `$PORT` as fallback) and generate a public domain; verify on a phone that today's puzzle loads, and that a `#/2026-11-16` link opens puzzle #1
