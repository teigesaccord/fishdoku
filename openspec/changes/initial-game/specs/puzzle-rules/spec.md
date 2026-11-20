## Purpose

Defines the Fishdoku puzzle: an N x N grid split into N ponds, the rules for placing fish, and how a board is judged as violating the rules or solved.

## ADDED Requirements

### Requirement: Puzzle structure
A puzzle SHALL consist of a square grid of size N x N, where N is an integer from 7 to 11. Every cell SHALL belong to exactly one pond. There SHALL be exactly N ponds, and the cells of each pond SHALL be orthogonally connected.

#### Scenario: Every cell has a pond
- **WHEN** a puzzle of size N is created
- **THEN** each of its N x N cells belongs to exactly one of N ponds

#### Scenario: Ponds are contiguous
- **WHEN** any pond in a puzzle is inspected
- **THEN** every cell in that pond can be reached from every other cell in that pond by moving up, down, left or right without leaving the pond

### Requirement: Placement rules
A solved board SHALL contain exactly N fish, satisfying all of the following:
- exactly one fish in each row
- exactly one fish in each column
- exactly one fish in each pond
- no two fish in adjacent cells, where adjacency includes the four orthogonal and four diagonal neighbors

#### Scenario: Two fish in a row
- **WHEN** a board has two fish in the same row
- **THEN** the board violates the row rule

#### Scenario: Two fish in a column
- **WHEN** a board has two fish in the same column
- **THEN** the board violates the column rule

#### Scenario: Two fish in a pond
- **WHEN** a board has two fish in the same pond
- **THEN** the board violates the pond rule

#### Scenario: Diagonally touching fish
- **WHEN** a board has fish at (row 2, col 3) and (row 3, col 4)
- **THEN** the board violates the no-touching rule

### Requirement: Conflict detection
The system SHALL identify every fish that participates in a rule violation. A fish is in conflict when another fish shares its row, column or pond, or occupies an adjacent cell.

#### Scenario: Conflicting fish identified
- **WHEN** a board has fish at (0,0) and (0,5) and no other fish
- **THEN** both fish are reported as in conflict

#### Scenario: Non-conflicting fish not flagged
- **WHEN** a fish shares no row, column or pond with any other fish and has no adjacent fish
- **THEN** that fish is not reported as in conflict

### Requirement: Solved detection
The system SHALL consider a board solved exactly when it contains N fish and none of them is in conflict. Cells marked as ruled out SHALL NOT affect whether the board is solved.

#### Scenario: Complete valid board
- **WHEN** a board has N fish with no conflicts
- **THEN** the board is solved

#### Scenario: Incomplete board
- **WHEN** a board has fewer than N fish
- **THEN** the board is not solved

#### Scenario: Ruled-out marks are ignored
- **WHEN** a board has N non-conflicting fish and some other cells marked as ruled out
- **THEN** the board is solved
