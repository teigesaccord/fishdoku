## Purpose

Defines the Deep Water puzzle: a tank of two stacked N x N layers with their own ponds, the rules for placing fish within and across layers, and how a tank is judged as violating the rules or solved.

## ADDED Requirements

### Requirement: Tank structure
A Deep Water puzzle SHALL consist of exactly 2 layers, ordered surface (layer 0) and deep (layer 1). Each layer SHALL be an N x N grid, with the same N for both layers. Each layer SHALL be divided into exactly N ponds of its own, every cell of a layer SHALL belong to exactly one of that layer's ponds, and the cells of each pond SHALL be orthogonally connected within that layer. A pond SHALL NOT span more than one layer.

#### Scenario: Every cell has a pond in its own layer
- **WHEN** a tank with layer size N is created
- **THEN** each of its 2 x N x N cells belongs to exactly one pond, and that pond lies entirely in the cell's layer

#### Scenario: Pond count
- **WHEN** a tank with layer size N is inspected
- **THEN** it has exactly 2N ponds, N in each layer

#### Scenario: Ponds are contiguous
- **WHEN** any pond in a tank is inspected
- **THEN** every cell of that pond can be reached from every other cell of that pond by moving up, down, left or right within its layer without leaving the pond

### Requirement: Layer rules
Within each layer, a solved tank SHALL satisfy the classic placement rules: exactly one fish in each row of the layer, exactly one fish in each column of the layer, exactly one fish in each pond of the layer, and no two fish of the layer in orthogonally or diagonally adjacent cells. A solved tank therefore contains exactly 2N fish, N per layer.

#### Scenario: Two fish in a row of one layer
- **WHEN** the deep layer has two fish in row 4
- **THEN** the tank violates the row rule

#### Scenario: Same row in different layers is allowed
- **WHEN** the surface layer has a fish at (row 4, col 1) and the deep layer has a fish at (row 4, col 5), and no other fish
- **THEN** neither fish violates the row rule

#### Scenario: Diagonal touch within a layer
- **WHEN** the surface layer has fish at (row 2, col 3) and (row 3, col 4)
- **THEN** the tank violates the no-touching rule

### Requirement: Pillar rule
No two fish SHALL occupy the same (row, column) position in different layers.

#### Scenario: Fish stacked in the surface and deep layers
- **WHEN** the surface and deep layers both have a fish at (row 3, col 3)
- **THEN** the tank violates the pillar rule

### Requirement: No touching between layers
A fish in the surface layer SHALL NOT touch a fish in the deep layer edge to edge. The two fish touch when they are in the same row and their columns differ by exactly 1, or in the same column and their rows differ by exactly 1. Seen from above, each fish casts a "+" shaped shadow on the other layer. Fish in different layers that are only diagonally offset do not touch.

#### Scenario: Side by side across layers
- **WHEN** the surface layer has a fish at (row 2, col 2) and the deep layer has a fish at (row 2, col 3)
- **THEN** the tank violates the no-touching rule

#### Scenario: Above and below across layers
- **WHEN** the surface layer has a fish at (row 4, col 5) and the deep layer has a fish at (row 5, col 5)
- **THEN** the tank violates the no-touching rule

#### Scenario: Diagonal offset across layers is allowed
- **WHEN** the surface layer has a fish at (row 2, col 2) and the deep layer has a fish at (row 3, col 3), and no other fish
- **THEN** neither fish is in conflict

### Requirement: Conflict detection
The system SHALL identify every fish that takes part in a rule violation. A fish is in conflict when another fish in its layer shares its row, column or pond, or is adjacent to it; when a fish in the other layer shares its (row, column) position; or when a fish in the other layer touches it edge to edge.

#### Scenario: Cross-layer conflict flags both fish
- **WHEN** the surface layer has a fish at (row 0, col 0) and the deep layer has a fish at (row 1, col 0), and no other fish
- **THEN** both fish are reported as in conflict

#### Scenario: Non-conflicting fish not flagged
- **WHEN** a fish breaks none of the layer rules, the pillar rule or the no-touching-between-layers rule
- **THEN** that fish is not reported as in conflict

### Requirement: Solved detection
The system SHALL consider a tank solved exactly when it contains 2N fish and none of them is in conflict. Cells marked as ruled out SHALL NOT affect whether the tank is solved.

#### Scenario: Complete valid tank
- **WHEN** a tank has 2N fish with no conflicts
- **THEN** the tank is solved

#### Scenario: One layer complete is not enough
- **WHEN** the surface layer holds N non-conflicting fish and the deep layer holds fewer than N fish
- **THEN** the tank is not solved

#### Scenario: Ruled-out marks are ignored
- **WHEN** a tank has 2N non-conflicting fish and some other cells marked as ruled out
- **THEN** the tank is solved
