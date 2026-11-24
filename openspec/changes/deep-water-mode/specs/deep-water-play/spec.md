## Purpose

Covers how players reach and play the daily Deep Water puzzle: switching modes, dates and URLs, the layered board on desktop and phone, input, feedback, winning, saving, timing, sharing and help.

## ADDED Requirements

### Requirement: Mode switch
The site SHALL offer two modes, Classic and Deep, through a control in the header. Classic SHALL be the default when no mode is given. Switching modes SHALL keep the currently viewed date when that date is playable in the target mode, and otherwise SHALL go to today's puzzle in the target mode.

#### Scenario: Opening the site
- **WHEN** a player opens the site with no hash
- **THEN** today's Classic puzzle is shown

#### Scenario: Switching to Deep on the same day
- **WHEN** a player viewing the Classic puzzle for a date on or after the Deep Water launch date switches to Deep
- **THEN** the Deep Water puzzle for that same date is shown

#### Scenario: Switching to Deep before its launch
- **WHEN** a player viewing a Classic puzzle dated before the Deep Water launch date switches to Deep
- **THEN** today's Deep Water puzzle is shown

### Requirement: Daily Deep Water puzzle
Each calendar date on or after the Deep Water launch date SHALL have one Deep Water puzzle, the same for every player, derived from that date. Deep Water SHALL have its own launch date, which is the date the mode is released. The puzzle label SHALL read "Deep #K", where K is 1 on the Deep Water launch date and increases by one per day.

#### Scenario: Same date, same tank for everyone
- **WHEN** two players open the Deep Water puzzle for the same date
- **THEN** they see the same tank

#### Scenario: Numbering
- **WHEN** the Deep Water puzzle for the day after the Deep Water launch date is opened
- **THEN** it is labeled "Deep #2"

### Requirement: Layer size
Every Deep Water puzzle SHALL have two 8 x 8 layers, whatever the day of the week. (With the no-touching-between-layers rule, 7 x 7 tanks allow only a handful of fish layouts, so 8 x 8 is the smallest size that gives varied puzzles.)

#### Scenario: Weekday tank
- **WHEN** the Deep Water puzzle for a Wednesday is opened
- **THEN** it has two 8 x 8 layers

#### Scenario: Weekend tank
- **WHEN** the Deep Water puzzle for a Saturday is opened
- **THEN** it has two 8 x 8 layers

### Requirement: Deep Water URLs and browsing
A Deep Water puzzle SHALL be addressable as `#/deep/<YYYY-MM-DD>`. Classic URLs of the form `#/<YYYY-MM-DD>` SHALL keep showing Classic puzzles. In Deep mode, the previous/next controls SHALL move between Deep Water dates and SHALL NOT go before the Deep Water launch date or after today. A Deep Water URL with an invalid, future or pre-launch date SHALL be redirected to today's Deep Water puzzle.

#### Scenario: Shared Deep link
- **WHEN** a player opens `#/deep/2026-12-04` and that date is playable
- **THEN** the Deep Water puzzle for 2026-12-04 is shown

#### Scenario: Existing classic link
- **WHEN** a player opens `#/2026-11-20`
- **THEN** the Classic puzzle for 2026-11-20 is shown

#### Scenario: Cannot go before Deep launch
- **WHEN** a player is viewing the Deep Water puzzle on the Deep Water launch date
- **THEN** the previous control is disabled

### Requirement: Layered board view
The board SHALL show both layers, labeled surface and deep, each drawn in the same ASCII style as Classic, with the layers visually distinguishable from each other (the deep layer drawn darker). Ponds in different layers SHALL be distinguishable as separate ponds. On wide screens both layers SHALL be visible side by side. On narrow screens one layer SHALL be shown at full size at a time, with a control to switch layers and a small read-only map of the other layer that shows its fish and ruled-out marks.

#### Scenario: Desktop
- **WHEN** a Deep Water puzzle is shown on a desktop-width screen
- **THEN** both layers are visible at once, side by side

#### Scenario: Phone
- **WHEN** an 8 x 8 Deep Water puzzle is shown on a 360 px wide phone screen
- **THEN** one layer is shown with cells large enough to tap, and the other layer is shown as a small map

#### Scenario: Switching layer on a phone
- **WHEN** a player on a narrow screen selects the deep layer
- **THEN** the deep layer is shown at full size and the surface layer becomes a small map

### Requirement: Pillar highlight
When a player hovers over or focuses a cell, the cell at the same (row, column) position in the other layer SHALL be highlighted, including on the small layer map.

#### Scenario: Hovering a cell
- **WHEN** a player hovers over (row 2, col 5) of the surface layer
- **THEN** (row 2, col 5) of the deep layer is highlighted

### Requirement: Deep Water input and clearing
Cells of every layer SHALL use the same tap cycle as Classic: empty, then ruled out, then fish, then empty. The clear control SHALL reset both layers, using the same confirmation and timer behavior as Classic.

#### Scenario: Tap cycle on a deep cell
- **WHEN** a player taps an empty cell of the deep layer three times
- **THEN** it becomes ruled out, then a fish, then empty again

#### Scenario: Clear resets every layer
- **WHEN** a player confirms clear on a Deep Water puzzle
- **THEN** every cell of both layers becomes empty

### Requirement: Deep Water conflict feedback
Every fish in conflict, as defined by `deep-water-rules`, SHALL be shown with the same conflict style as Classic. Conflicts that involve fish in different layers SHALL be shown on both fish, including on the small layer maps.

#### Scenario: Cross-layer conflict shown
- **WHEN** a player places fish at (row 4, col 4) on the surface layer and (row 4, col 4) on the deep layer
- **THEN** both fish are shown in the conflict style

### Requirement: Deep Water win
When the tank becomes solved, the timer SHALL stop, the board SHALL lock, and a win screen SHALL be shown that names the Deep Water puzzle and its solve time. Reopening a solved Deep Water puzzle SHALL show the solved tank and the solved indicator without replaying the win screen.

#### Scenario: Solving the tank
- **WHEN** a player places the last fish so the tank is solved
- **THEN** the win screen is shown with the Deep puzzle number and solve time

### Requirement: Separate progress and timing
Deep Water progress, solved state and timer SHALL be saved per date in the browser, separately from Classic. Saving or clearing one mode SHALL NOT change the other mode's board for the same date. The timer SHALL follow the same rules as Classic (it runs only while the puzzle is on screen, unsolved and the tab is visible, and the first solve time is kept after replays).

#### Scenario: Reload keeps Deep progress
- **WHEN** a player marks cells on a Deep Water puzzle and reloads the page
- **THEN** the same marks are shown on both layers and the timer resumes from its saved value

#### Scenario: Modes do not overwrite each other
- **WHEN** a player solves the Classic puzzle for a date and then opens the Deep Water puzzle for the same date
- **THEN** the Deep Water puzzle is unsolved and empty unless it was played before

### Requirement: Deep Water share text
The share text for a solved Deep Water puzzle SHALL name the mode, puzzle number and tank size, include the first solve time, and link to that Deep Water puzzle. It SHALL NOT reveal any fish positions.

#### Scenario: Sharing a Deep result
- **WHEN** a player shares Deep #3, a 2 x 8 x 8 tank solved in 12:04
- **THEN** the copied text contains "Fishdoku Deep #3", "2×8×8", "12:04" and a link ending in `#/deep/<date>`

### Requirement: Deep Water help
The "How to play" screen SHALL explain the Deep Water rules: two layers, the classic rules in each layer, one fish per pillar, and no edge-to-edge touching between the layers (the "+" shadow).

#### Scenario: Reading the rules
- **WHEN** a player opens "How to play"
- **THEN** it includes a Deep Water section describing the layer, pillar and between-layer touching rules
