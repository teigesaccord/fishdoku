## 1. Guard classic determinism

- [x] 1.1 Add a pinned snapshot test in `src/core/generator/generator.test.ts` with literal expected `v1` pond arrays for a fixed list of dates covering sizes 7–11; verify it passes on the current code with `npx vitest run src/core/generator`

## 2. Tank model and rules (pure core)

- [x] 2.1 Add `src/core/deep/puzzle.ts` with `DeepPuzzle`, `DeepBoard`, `LAYERS`, index helpers and `layerPuzzle(deep, L)`; verify unit tests cover index round-trips and pond id remapping
- [x] 2.2 Add `src/core/deep/rules.ts` with `deepConflicts` and `isDeepSolved`; verify unit tests cover every scenario in `specs/deep-water-rules/spec.md` (same row across layers allowed, pillar, side-by-side and above/below touch between neighboring layers, diagonal offset allowed, ruled-out ignored, one complete layer not solved)

## 3. Solver and generator prototype (de-risk before UI)

- [x] 3.1 Add `src/core/deep/solver.ts` with `countDeepSolutions` and `findDeepSolutions` (row-major, every layer per row); verify against a brute-force reference solver on small hand-made tanks in unit tests
- [x] 3.2 Export `growPonds` and the repair move search from `v1.ts` with no logic changes; verify the pinned v1 snapshot test from 1.1 still passes
- [x] 3.3 Implement `deep-v1` in `src/core/deep/generator.ts` (place fish, grow ponds per layer, layer-ambiguity check, tank uniqueness check, repair keeping the intended solution); verify unit tests assert valid structure, exactly one tank solution and ≥2 solutions per layer alone for a sample of seeds at N = 8
- [x] 3.4 Add a benchmark script (e.g. `scripts/bench-deep.ts`, run with `npx vite-node`) over ~200 consecutive dates reporting success rate, restarts and p50/p95/max time; verify p95 is comfortably under the 1000 ms phone budget on desktop (aim for ≤ 250 ms on desktop to leave room for slower phones), and record results in this change's design.md Risks section
- [x] 3.5 Decision checkpoint: if 8 x 8 misses the budget after tuning, apply the localStorage caching mitigation from design.md (or pause and raise it with the user if that is not enough); verify `openspec validate deep-water-mode` passes
- [x] 3.6 Add a determinism test for `deep-v1`: same seed run twice gives identical tanks, plus a pinned literal snapshot for a few dates once the algorithm is final; verify with `npx vitest run src/core/deep`

## 4. Daily mapping, routing and storage

- [x] 4.1 Add Deep constants and mode-aware helpers to `src/core/daily.ts` (`DEEP_LAUNCH_DATE`, `DEEP_SIZE`, `DEEP_VERSION_TABLE`, seed, number, clamp, prev/next); verify `daily.test.ts` covers the 8 x 8 size on every weekday, "Deep #1" on launch, pre-launch clamping, and that existing classic tests are unchanged and green
- [x] 4.2 Extend `src/router.ts` to parse and write `#/deep/<date>` and `#/deep`, keeping `#/<date>` as Classic; verify `router.test.ts` covers Deep links, classic links unchanged, and out-of-range Deep dates redirecting to `#/deep/<today>`
- [x] 4.3 Extend `src/storage.ts` with the `fishdoku:v1:deep:<date>` namespace using the same payload and length check; verify `storage.test.ts` shows Classic and Deep boards for the same date don't overwrite each other
- [x] 4.4 Extend `src/share.ts` with Deep share text ("Fishdoku Deep #K", "2×N×N", time, `#/deep/<date>` link, no fish positions); verify `share.test.ts` matches the share scenario in the play spec

## 5. App flow

- [x] 5.1 Introduce a `ModeAdapter` in `src/app.ts` and route Classic through it with no behavior change; verify `app.test.ts` passes unchanged
- [x] 5.2 Add the Deep adapter (generate, `isDeepSolved`, storage key, label, share) and `load(mode, date)`; verify new app tests cover loading a Deep date, saving and reloading progress, solving (timer stops, board locks, win shown), revisiting a solved tank without the win screen, and clear resetting every layer
- [x] 5.3 Add the header mode switch (Classic / Deep) and wire it to routing, keeping the date when it is playable in the target mode; verify app tests cover the three mode-switch scenarios in the play spec

## 6. Layered board UI

- [x] 6.1 Add optional `conflictSet` to `BoardController` render options and a hover/focus callback plus pillar-highlight method; verify `board.test.ts` shows classic rendering is unchanged when they are omitted
- [x] 6.2 Add `src/ui/deep-board.ts` (`DeepBoardView`) with one controller per layer, layer labels, layer tints, cross-layer conflicts passed per layer, and pillar highlighting; verify unit tests cover a cross-layer conflict shown on both layers and hover highlighting the same pillar
- [x] 6.3 Add responsive layout in `theme.css`: the layers side by side on wide screens; on narrow screens a layer tab strip, one full-size layer and read-only mini-maps of the others; verify by running the app (`npm run dev`) at 360 px and 1280 px widths with an 8 x 8 tank: cells are tappable on phone and all layers fit on desktop, in both light and dark themes
- [x] 6.4 Add the Deep Water section to `src/ui/help.ts` (the layers, classic rules per layer, one fish per pillar, the "+" shadow between neighboring layers, with a small ASCII example); verify `help.test.ts` checks the section is present

## 7. Release

- [x] 7.1 Measure generation time for an 8 x 8 tank on a real mid-range phone (or Chrome DevTools 4x CPU throttling) and verify it is under 1000 ms; if not, apply the caching or Web Worker mitigation from design.md and measure again
- [ ] 7.2 Set `DEEP_LAUNCH_DATE` to the release date, run the full test suite (`npx vitest run`) and a production build (`npm run build`), and verify both succeed and `openspec validate deep-water-mode --strict` passes

## 8. Revision: scale back to two layers (after playtesting)

- [x] 8.1 Change `LAYERS` to 2 (`surface`, `deep`) and update the rules, solver and generator tests for two layers, including surface and deep now being neighbors for the "+" rule; verify `npx vitest run src/core/deep` passes, the brute-force solver comparison still runs on tanks that have solutions, and the generator still gives exactly one tank solution with every layer ambiguous alone
- [x] 8.2 Re-run `npx vite-node scripts/bench-deep.ts` for two layers, re-pin the `deep-v1` literal snapshots, and record the new numbers (including per-layer ambiguity) in design.md; verify the pinned test passes and p95 stays far under the 1000 ms budget
- [x] 8.3 Update the board view (labels, two-layer wide layout and breakpoint, one mini-map), CSS tints, share text ("2×8×8"), storage/app/help tests and help text for two layers; verify the full suite passes and screenshots at 360 px and 1280 px in light and dark themes show both layers correctly

