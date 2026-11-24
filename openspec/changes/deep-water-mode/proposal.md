## Why

Today the only lever on difficulty is grid size, and a bigger grid mostly makes a puzzle longer, not harder. Fishdoku needs a hard mode that asks for a genuinely new kind of reasoning while still feeling like the same game. "Deep Water" stacks two layers of the familiar grid into a fish tank, so each layer looks like a normal puzzle, but the layers can only be solved together.

## What Changes

> Revised after playtesting: the first build used 3 layers (surface, middle, deep), which proved too difficult. The tank is now 2 layers.


- Add a **Deep Water** puzzle: a tank of 2 stacked N x N layers (surface and deep). Each layer has its own N ponds and keeps the classic rules (one fish per row, column and pond in that layer; no touching within the layer).
- Add two rules that tie the layers together:
  - **One fish per pillar**: no two fish may sit on the same (row, column) position in different layers.
  - **No touching through the water**: a fish may not touch a fish in the other layer edge to edge. Seen from above, a fish casts a "+" shaped shadow (its pillar plus the four cells beside it) on the other layer. A full 3 x 3 shadow was considered first, but a brute-force check showed no valid tank exists under it at 7 x 7 or 8 x 8.
- Add a seeded, versioned Deep Water generator. Every tank has exactly one solution, and **no single layer can be solved on its own** (each layer, taken alone, has at least two solutions), so solving it means moving between layers.
- Add a daily Deep Water puzzle next to the classic one, with its own puzzle numbers, launch date, URL (`#/deep/<date>`), saved progress, timer and share text. Layers are 8 x 8 every day (under the "+" rule a two-layer 7 x 7 tank has only 108 possible fish layouts, too few for varied puzzles).
- Add a mode switch (Classic / Deep) in the header. Classic stays the default and its behavior and URLs do not change.
- Add a layered board view. On desktop the two layers sit side by side. On phones one layer is shown at a time, with layer tabs and a small map of the other layer. Selecting a cell highlights the same pillar in the other layer.
- Extend "How to play" with the Deep Water rules.

Out of scope: ponds that span layers, more than 2 layers, deep-mode stats/streaks, difficulty grading by deduction technique.

## Capabilities

### New Capabilities
- `deep-water-rules`: The tank model (2 layers, per-layer ponds, fish) and its placement rules, conflict detection across layers, and solved detection.
- `deep-water-generation`: A seeded, deterministic, versioned generator that produces tanks with exactly one solution where no layer is solvable on its own, within a performance budget.
- `deep-water-play`: The daily Deep Water puzzle and how it is played: mode switching, dates and URLs, the layered board on desktop and phone, tap cycle, conflict feedback, win, saving, timer, sharing and help text.

### Modified Capabilities
<!-- None. The classic capabilities from `initial-game` are not archived into openspec/specs yet, and classic behavior does not change. Deep Water reuses classic behavior (tap cycle, clear, timer rules) by reference in its own spec. -->

## Impact

- `src/core/`: new pure modules for the tank model, rules, solver and a `deep-v1` generator. Classic `v1` generator output must stay byte-for-byte identical (existing snapshot tests guard this).
- `src/core/daily.ts`: a Deep Water launch date, size table and seed format (`fishdoku:deep-v1:<date>`).
- `src/router.ts`: a `#/deep/<date>` route. Existing `#/<date>` links keep meaning Classic.
- `src/storage.ts`: a separate key namespace (`fishdoku:v1:deep:<date>`) storing 2 x N x N cells.
- `src/app.ts`, `src/ui/`: a mode switch, a layered board view, help text and share text.
- No new dependencies, no backend. Still ASCII-only.
