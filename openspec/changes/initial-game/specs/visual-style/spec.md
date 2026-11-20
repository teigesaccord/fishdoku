## Purpose

The ASCII art look of Fishdoku and its responsive layout, so the game is readable and easy to tap on phones and comfortable on desktops, with no AI-generated art.

## ADDED Requirements

### Requirement: ASCII-only artwork
All game artwork (fish, marks, title, win screen) SHALL be made of ASCII characters. The site SHALL NOT include raster images, illustrations or AI-generated art.

#### Scenario: No image assets
- **WHEN** the site's shipped assets are inspected
- **THEN** none of them is a raster image or illustration used as game art

### Requirement: Cell glyphs
A fish SHALL be displayed as `><>` or `<><`. A ruled-out cell SHALL be displayed as `x`. An empty cell SHALL show only its pond's texture.

#### Scenario: Fish glyph
- **WHEN** a cell holds a fish
- **THEN** the cell displays `><>` or `<><`

#### Scenario: Ruled-out glyph
- **WHEN** a cell is ruled out
- **THEN** the cell displays `x`

#### Scenario: Fish direction is stable
- **WHEN** the same puzzle is re-rendered or reloaded
- **THEN** each fish faces the same direction as before

### Requirement: Distinguishable ponds
Each pond SHALL have both its own ASCII fill texture character and its own color, so ponds can be told apart without relying on color alone. Boundaries between different ponds SHALL be visibly heavier than lines between cells of the same pond.

#### Scenario: Neighboring ponds differ
- **WHEN** two ponds share an edge
- **THEN** they have different textures and different colors, and the edge between them is drawn heavier than the grid lines inside either pond

#### Scenario: Readable without color
- **WHEN** the board is viewed in grayscale
- **THEN** every pond can still be identified by its texture and boundaries

### Requirement: Conflict style
Fish in conflict SHALL be shown in a style that differs in more than color alone (for example, a changed glyph or added marker as well as a color change).

#### Scenario: Conflict visible in grayscale
- **WHEN** a conflicting fish is viewed in grayscale
- **THEN** it is still distinguishable from non-conflicting fish

### Requirement: Responsive layout
The board SHALL fit within the viewport width, without horizontal scrolling, on screens from 320 px wide upward, for every size from 7 to 11. Each cell SHALL be at least 28 px across on a 360 px wide screen. The board SHALL have a maximum size on large screens so cells do not become oversized.

#### Scenario: 11 x 11 on a small phone
- **WHEN** an 11 x 11 puzzle is shown on a 360 px wide screen
- **THEN** the whole board is visible without horizontal scrolling and each cell is at least 28 px across

#### Scenario: Desktop
- **WHEN** a 7 x 7 puzzle is shown on a 1920 px wide screen
- **THEN** the board is centered and capped at its maximum size

### Requirement: Light and dark themes
The site SHALL follow the device's light or dark color scheme preference, and pond textures, colors and glyphs SHALL remain legible in both.

#### Scenario: Dark mode device
- **WHEN** the site is opened on a device set to dark mode
- **THEN** the site uses its dark theme
