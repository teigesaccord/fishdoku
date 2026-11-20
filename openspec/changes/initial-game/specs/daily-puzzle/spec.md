## Purpose

Gives every player the same puzzle on a given calendar date and lets them go back and play puzzles from earlier dates.

## ADDED Requirements

### Requirement: Date determines the puzzle
The puzzle for a calendar date SHALL be derived only from that date, using the generator version assigned to that date. All players who open the same date SHALL get the same puzzle.

#### Scenario: Same date, same puzzle for everyone
- **WHEN** two players on different devices open the puzzle for 2026-11-16
- **THEN** they see identical puzzles

### Requirement: Size by day of week
The puzzle size SHALL be determined by the day of the week of its date:

| Day       | Size    |
|-----------|---------|
| Monday    | 7 x 7   |
| Tuesday   | 8 x 8   |
| Wednesday | 9 x 9   |
| Thursday  | 10 x 10 |
| Friday    | 11 x 11 |
| Saturday  | 9 x 9   |
| Sunday    | 8 x 8   |

#### Scenario: Monday puzzle
- **WHEN** the puzzle for Monday 2026-11-16 is opened
- **THEN** it is a 7 x 7 puzzle

#### Scenario: Friday puzzle
- **WHEN** the puzzle for Friday 2026-11-20 is opened
- **THEN** it is an 11 x 11 puzzle

### Requirement: Today's puzzle by default
When the player opens the site without specifying a date, the system SHALL show the puzzle for the current date in the player's local time zone.

#### Scenario: Opening the site
- **WHEN** a player opens the site with no date in the URL
- **THEN** the puzzle for their current local date is shown

### Requirement: Browsing past puzzles
The player SHALL be able to move to the previous and next date's puzzle. Navigation SHALL NOT go later than the current local date, or earlier than the launch date (the first puzzle).

#### Scenario: Go to previous day
- **WHEN** the player is viewing 2026-11-16 and chooses previous
- **THEN** the puzzle for 2026-11-15 is shown

#### Scenario: Cannot go into the future
- **WHEN** the player is viewing today's puzzle
- **THEN** the next-day control is disabled

#### Scenario: Cannot go before launch
- **WHEN** the player is viewing the launch date's puzzle
- **THEN** the previous-day control is disabled

### Requirement: Date in the URL
The URL SHALL identify the date being viewed, so that a link opens that date's puzzle. A URL with a future, pre-launch or malformed date SHALL show today's puzzle instead.

#### Scenario: Shared link
- **WHEN** a player opens a link for 2026-11-10
- **THEN** the puzzle for 2026-11-10 is shown

#### Scenario: Future date in link
- **WHEN** a player opens a link for a date after their current local date
- **THEN** today's puzzle is shown

### Requirement: Puzzle label
The system SHALL display the date being viewed and its puzzle number, where the launch date is puzzle #1 and each later day adds one.

#### Scenario: Puzzle numbering
- **WHEN** the player views the date three days after launch
- **THEN** the label shows puzzle #4 along with the date
