## Why

Meowdoku is a fun logic puzzle, but the mobile app is full of ads. Fishdoku is an ad-free, fish-themed version of it that runs as a website, so it can be played on phones and desktops. This first change builds a minimal version you can play: a daily puzzle with access to past days.

## What Changes

- Add the core puzzle: an N x N grid (N from 7 to 11) split into N irregular "ponds". Each row, each column and each pond must hold exactly one fish, and no two fish may touch, including diagonally.
- Add a deterministic, seeded puzzle generator that only produces puzzles with exactly one solution, so every puzzle can be solved by logic alone.
- Add a daily puzzle that is the same for every player. It is derived from the calendar date, its size depends on the day of the week, and the player can browse back to puzzles from earlier dates.
- Add board interaction: tapping a cell cycles it through empty -> ruled out (`x`) -> fish (`><>`), plus win detection and an ASCII win screen.
- Save each day's in-progress board in the browser so it survives a reload.
- Add an ASCII art visual style (no AI-generated art). Each pond gets its own fill texture and color, and the layout is responsive for phones and desktops.
- Ship as a static site with no backend.

Out of scope, planned as later changes: hints, timer, undo, stats/streaks, auto-marking, drag-to-mark, difficulty tiers.

## Capabilities

### New Capabilities
- `puzzle-rules`: The puzzle model (grid, ponds, fish) and the placement constraints. Also covers checking a board for rule violations and for a completed solution.
- `puzzle-generation`: A seeded, deterministic generator that produces valid pond layouts with a unique solution for sizes 7 to 11.
- `daily-puzzle`: Mapping a calendar date to a puzzle (seed and size), and navigating to past dates without going past today.
- `board-interaction`: Cell marking via the tap cycle, conflict feedback, win detection and the win screen, and saving progress per date.
- `visual-style`: The ASCII art presentation: fish and mark glyphs, pond textures and colors, and a responsive layout for screens from phone to desktop.

### Modified Capabilities
<!-- None: this is the first change in the project. -->

## Impact

- New project: TypeScript + Vite static web app using plain DOM code (no UI framework).
- No backend, accounts or network calls. All state lives in the browser's `localStorage`.
- Deployed to Railway as a static build. The first puzzle is dated 2026-11-16.
- Puzzle determinism becomes a compatibility contract: changing the generator would change past daily puzzles, so the generator is versioned from the start.
