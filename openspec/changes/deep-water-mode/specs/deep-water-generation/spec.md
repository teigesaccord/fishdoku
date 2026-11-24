## Purpose

Produces Deep Water tanks from a seed: deterministic, versioned, with exactly one solution, and built so that no layer can be solved without the others.

## ADDED Requirements

### Requirement: Valid output
For a given seed and a layer size N of 8, the generator SHALL produce a tank that meets the tank structure requirement of `deep-water-rules`.

#### Scenario: Generated tank is well-formed
- **WHEN** a tank is generated for any seed with N = 8
- **THEN** it has 2 layers of N x N cells, N contiguous ponds per layer, and every cell belongs to exactly one pond of its own layer

### Requirement: Unique solution
Every generated tank SHALL have exactly one placement of fish that satisfies all Deep Water rules.

#### Scenario: Exactly one solution
- **WHEN** an exhaustive solver applies all Deep Water rules to a generated tank
- **THEN** it finds exactly one solution

### Requirement: No layer solvable on its own
For every generated tank, each layer taken alone SHALL have at least two placements that satisfy the classic rules for that layer (one fish per row, column and pond, no touching), ignoring the other layers. This guarantees that the player must use the cross-layer rules to finish.

#### Scenario: Each layer is ambiguous alone
- **WHEN** any single layer of a generated tank is solved as a classic puzzle using only its own ponds
- **THEN** that layer has two or more solutions

#### Scenario: Tank is unique together
- **WHEN** the same tank is solved with all Deep Water rules
- **THEN** it has exactly one solution

### Requirement: Deterministic generation
The generator SHALL produce the same tank for the same seed, layer size and generator version, on every browser and device.

#### Scenario: Same seed, same tank
- **WHEN** the tank for seed `fishdoku:deep-v1:2026-12-04` with N = 8 is generated twice, on two different devices
- **THEN** both tanks have identical pond layouts in both layers

### Requirement: Versioned generator
Deep Water generation SHALL be versioned separately from classic generation, starting at `deep-v1`. Adding or changing a Deep Water generator version SHALL NOT change any classic puzzle, and adding a classic version SHALL NOT change any Deep Water tank.

#### Scenario: Classic puzzles unchanged
- **WHEN** Deep Water mode is added
- **THEN** every classic puzzle for every date is identical to what it was before

### Requirement: Generation performance
Generating a single 8 x 8 tank SHALL complete on a typical mid-range phone quickly enough that the player does not notice a long delay (target: under 1000 ms).

#### Scenario: Largest size within budget
- **WHEN** an 8 x 8 tank is generated on a mid-range phone
- **THEN** generation completes within the target time
