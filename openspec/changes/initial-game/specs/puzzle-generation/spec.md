## Purpose

Produces Fishdoku puzzles from a seed so that the same seed always gives the same puzzle on every device, and every puzzle can be solved by logic alone.

## ADDED Requirements

### Requirement: Valid output
The generator SHALL take a seed and a size N (7 to 11) and return a puzzle that satisfies the puzzle structure requirements of `puzzle-rules`.

#### Scenario: Generated puzzle is well-formed
- **WHEN** a puzzle is generated for any seed and any N from 7 to 11
- **THEN** the puzzle is N x N with N contiguous ponds covering every cell

### Requirement: Unique solution
Every generated puzzle SHALL have exactly one solution under the placement rules.

#### Scenario: Exactly one solution
- **WHEN** an exhaustive solver is run on any generated puzzle
- **THEN** it finds exactly one solution

### Requirement: Deterministic generation
For a given generator version, seed and size, the generator SHALL always produce an identical puzzle, regardless of browser, device, operating system or time of generation.

#### Scenario: Same seed, same puzzle
- **WHEN** the same seed and size are passed to the generator twice
- **THEN** both results have identical pond layouts

#### Scenario: Stable across environments
- **WHEN** a fixed set of reference seeds is generated in different supported browsers
- **THEN** every browser produces the same puzzles, and they match recorded reference outputs

### Requirement: Versioned generator
Each generator implementation SHALL have a version identifier. Generator output SHALL be selected by version, so that introducing a new generator version does not change puzzles produced by earlier versions.

#### Scenario: Version recorded
- **WHEN** a puzzle is generated
- **THEN** the generator version used is known and associated with that puzzle

### Requirement: Generation performance
Generating a single puzzle of any supported size SHALL complete on a typical mid-range phone quickly enough that the player does not notice a delay (target: under 500 ms).

#### Scenario: Largest size within budget
- **WHEN** an 11 x 11 puzzle is generated on a mid-range phone
- **THEN** generation completes within the target time
