## Purpose

How the player marks cells, sees rule conflicts, wins a puzzle, and keeps their progress on each day's puzzle.

## ADDED Requirements

### Requirement: Tap cycle
Each cell SHALL be in one of three states: empty, ruled out or fish. Tapping or clicking a cell SHALL advance its state in the order empty -> ruled out -> fish -> empty. Touch, mouse and keyboard activation SHALL all behave the same way.

#### Scenario: Mark a cell ruled out
- **WHEN** the player taps an empty cell
- **THEN** the cell becomes ruled out

#### Scenario: Place a fish
- **WHEN** the player taps a ruled-out cell
- **THEN** the cell holds a fish

#### Scenario: Clear a cell
- **WHEN** the player taps a cell holding a fish
- **THEN** the cell becomes empty

### Requirement: Conflict feedback
Any fish that is in conflict under `puzzle-rules` SHALL be visibly distinguished from non-conflicting fish. The feedback SHALL update immediately after each change.

#### Scenario: Conflict appears
- **WHEN** the player places a fish in the same row as an existing fish
- **THEN** both fish are shown in the conflict style

#### Scenario: Conflict clears
- **WHEN** the player removes one of two conflicting fish
- **THEN** the remaining fish is no longer shown in the conflict style

### Requirement: Win
When the board becomes solved, the system SHALL show an ASCII art win screen and stop accepting changes to that puzzle's cells. The player SHALL be able to dismiss the win screen and view the solved board.

#### Scenario: Placing the final fish
- **WHEN** the player places the last fish so that the board is solved
- **THEN** the win screen is shown

#### Scenario: Solved board is locked
- **WHEN** the player taps a cell on a solved puzzle
- **THEN** the cell does not change

### Requirement: Clear board
The player SHALL be able to reset an unsolved puzzle's board to all-empty. The reset SHALL require confirmation so that a single accidental tap cannot wipe progress.

#### Scenario: Reset with confirmation
- **WHEN** the player chooses clear and confirms
- **THEN** every cell on the board becomes empty

#### Scenario: Reset cancelled
- **WHEN** the player chooses clear and then cancels
- **THEN** the board is unchanged

### Requirement: Progress persistence
Board state and solved status SHALL be saved per date in the player's browser after every change, and restored when that date's puzzle is opened again. If browser storage is unavailable, the game SHALL remain fully playable without saving.

#### Scenario: Resume after reload
- **WHEN** the player marks some cells, reloads the page and opens the same date
- **THEN** the same cells are marked

#### Scenario: Progress kept per date
- **WHEN** the player makes progress on two different dates and switches between them
- **THEN** each date shows its own progress

#### Scenario: Storage blocked
- **WHEN** browser storage is unavailable
- **THEN** the puzzle still loads and can be played and solved

### Requirement: Solved indicator
The date navigation SHALL indicate whether the puzzle currently being viewed has been solved.

#### Scenario: Revisiting a solved puzzle
- **WHEN** the player opens a date they previously solved
- **THEN** the solved board is shown with a solved indicator, without replaying the win screen
