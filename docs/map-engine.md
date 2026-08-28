# Map Engine

Design document for the procedural map generation system in Dusk and Dawn.

## Hex grid

The game uses an **odd-r offset** hex coordinate system where each tile is addressed by `(row, column)`.

- **Even rows** (0, 2, 4, ...) are flush left.
- **Odd rows** (1, 3, 5, ...) are shifted right by half a hex width.

### Neighbor offsets

| Direction   | Even row          | Odd row             |
|-------------|-------------------|---------------------|
| East        | (row, col + 1)    | (row, col + 1)      |
| West        | (row, col - 1)    | (row, col - 1)      |
| North-East  | (row - 1, col)    | (row - 1, col + 1)  |
| North-West  | (row - 1, col - 1)| (row - 1, col)      |
| South-East  | (row + 1, col)    | (row + 1, col + 1)  |
| South-West  | (row + 1, col - 1)| (row + 1, col)      |

Every tile has up to six neighbors. Edge and corner tiles have fewer.

```
      Even row (row 0):
        ___     ___     ___
       / 0 \___/ 1 \___/ 2 \
       \___/ 0 \___/ 1 \___/
       / 0 \___/ 1 \___/ 2 \
       \___/   \___/   \___/

      Odd row (row 1) shifted right:
            ___     ___     ___
        ___/ 0 \___/ 1 \___/ 2 \
       / 0 \___/ 1 \___/ 2 \___/
       \___/   \___/   \___/
```

## Landscape types

| Type         | Walkable | Buildable | Resource yield  | Notes                                |
|--------------|----------|-----------|-----------------|--------------------------------------|
| `grass`      | yes      | yes       | -               | Base terrain. Converts to `farm` adjacent to houses. |
| `farm`       | yes      | no        | food (production)| Created when a house is built adjacent to grass. |
| `tree`       | no*      | no        | wood (loot)     | Requires bow equipment to walk on.   |
| `sand`       | yes      | no        | -               | Transition zone between grass and water. |
| `water`      | no*      | no        | -               | Requires boat steed to traverse.     |
| `mountain`   | no       | no        | stone (loot)    | Blocks movement entirely.            |
| `unexplored` | -        | -         | -               | Fog of war placeholder on the client. |

\* Movement is blocked by default but can be unlocked through equipment or steeds.

## Generation pipeline

Map generation uses **noise-based terrain** — two layers of multi-octave value noise determine elevation and vegetation independently. Every tile's terrain is computed from its noise values, eliminating the directional bias of sequential generation.

```
Generate elevation noise (4 octaves)
Generate vegetation noise (2 octaves)
  -> For each tile: combine elevation + island mask -> terrain type
  -> Post-process: create beaches (water adjacent to land -> sand)
  -> Post-process: cleanup sand (sand not adjacent to water -> grass)
  -> Clear starting areas
  -> Place starting pieces
```

### Step 1: Noise generation

Two independent noise fields are created from the game seed:

- **Elevation noise** — 4 octaves, lacunarity 2.0, persistence 0.5, scale 0.12. Controls the large-scale terrain shape (water, land, mountains).
- **Vegetation noise** — 2 octaves, same lacunarity/persistence, scale 0.25. Controls forest density within the grass band.

Both use the same Mulberry32 PRNG seeded from the game seed, but produce different fields because each octave is offset by a unique constant.

### Step 2: Elevation to terrain

Each tile's raw elevation noise is multiplied by a **hexagonal island mask** to produce the final elevation:

```
elevation = rawNoise * islandMask
```

The island mask uses **cube-coordinate hex distance** from the map center. It converts each tile's offset coordinates to cube coordinates `(q, r, s)`, computes hex distance as `max(|Δq|, |Δr|, |Δs|)`, then applies a quadratic falloff. This produces a **hexagon-shaped island** surrounded by water — the mask is 1.0 at the center and 0.0 beyond the hex boundary.

The hex boundary radius is controlled by the `waterLevel` config parameter:
- `waterLevel = 0`: radius = 75% of grid size (large island, minimal water)
- `waterLevel = 0.5`: radius = 52% (default)
- `waterLevel = 1`: radius = 30% (tiny island, mostly water)

Because the blend is multiplicative, any tile where the mask is 0 is guaranteed to be deep water regardless of noise value.

Terrain is assigned by configurable elevation thresholds:

| Elevation range       | Terrain    | Notes                                     |
|-----------------------|------------|-------------------------------------------|
| < 0.30                | water      | Deep water, large bodies                  |
| 0.30 – 0.38          | sand       | Shorelines                                |
| 0.38 – grassEnd      | grass      | Open meadows, buildable land              |
| grassEnd – treeEnd    | grass/tree | Mixed zone — vegetation noise determines tree placement |
| treeEnd – mountainStart | tree     | Dense forest                              |
| > mountainStart       | mountain   | Mountain ranges along ridgelines          |

The `grassEnd`, `treeEnd`, and `mountainStart` thresholds are derived from the `forestDensity` and `mountainDensity` config parameters (see Configuration section below). At default settings (0.5/0.5), the thresholds are approximately 0.65/0.85/0.79.

In the mixed zone, the vegetation noise creates natural clearings within forests rather than uniform coverage.

### Step 3: Create beaches

Water tiles adjacent to any land tile (grass, tree, mountain) become sand. This creates shoreline rings around water bodies.

### Step 4: Cleanup sand

Sand tiles with no water neighbor are converted back to grass. This removes orphaned sand left after the beach pass.

### Step 5: Clear starting areas

Each player's king is placed on the grass tile nearest to their starting corner:
- **Day player:** bottom-left corner
- **Night player:** top-right corner

All tree and mountain tiles adjacent to each king position are converted to grass, creating a small clearing so the player can move and build.

### Step 6: Place starting pieces

Each player receives:
- A **king** on the chosen grass tile
- A **peasant** on an adjacent grass tile

## Noise algorithm

The noise system (`src/shared/utils/noise.ts`) implements **multi-octave value noise**:

1. A **permutation table** (256 entries) is shuffled using the seeded PRNG. This table is the deterministic hash function that maps grid coordinates to pseudo-random values.

2. **Single-octave value noise** assigns a random value to each integer grid point, then interpolates between them using Hermite smoothing (`3t² - 2t³`) for smooth transitions.

3. **Multi-octave layering** sums several noise passes at increasing frequency and decreasing amplitude:
   - Octave 0: frequency 1×, amplitude 1.0 (large continent shapes)
   - Octave 1: frequency 2×, amplitude 0.5 (medium features)
   - Octave 2: frequency 4×, amplitude 0.25 (small variation)
   - Octave 3: frequency 8×, amplitude 0.125 (fine detail)

The result is normalized to [0, 1].

## Seeding

The random number generator uses a **Mulberry32 PRNG** seeded by either:
- A numeric seed directly, or
- A string seed hashed to a number via DJB2

`createRandom(seed)` returns a `() => number` function producing deterministic values in `[0, 1)`. The same seed always produces the same map.

## Terrain distribution

Approximate distribution on a typical 15x15 map (225 tiles):

| Terrain  | Typical % | Character                              |
|----------|-----------|----------------------------------------|
| Grass    | 40–60%    | Dominant land type, open and buildable  |
| Tree     | 15–30%    | Clustered forests at mid-high elevation |
| Water    | 10–25%    | Bodies near edges due to island mask    |
| Sand     | 5–15%     | Thin shorelines around water            |
| Mountain | 2–8%      | Ridgelines at highest elevations        |

The noise-based approach produces much more open grass than the previous system (which converted 70% of grass to trees). Games finish more frequently because players can reach each other through connected walkable terrain.

## Configuration

Map generation accepts a `MapConfig` object with three parameters:

| Parameter        | Range | Default | Effect                                           |
|------------------|-------|---------|--------------------------------------------------|
| `waterLevel`     | 0–1   | 0.5     | Controls island size. 0 = large island, 1 = tiny island |
| `forestDensity`  | 0–1   | 0.5     | Controls tree coverage. 0 = no trees, 1 = maximum forest |
| `mountainDensity`| 0–1   | 0.5     | Controls mountain coverage. 0 = no mountains, 1 = maximum |

`waterLevel` adjusts the hexagonal island mask radius. `forestDensity` and `mountainDensity` shift the elevation thresholds that determine where grass ends and trees/mountains begin.

The config is stored in the game state (`Game.mapConfig`) so the map parameters are preserved alongside the seed.

## Visual preview

The `/map` route in the web UI provides a visual map generator for tuning and inspection:

- Renders terrain as colored hexagons on an HTML5 canvas (no game assets needed)
- Controls: seed text input, random seed button, size slider (5–40)
- Sliders for water level, forest density, and mountain density
- Theme selector with 6 color palettes (Classic, Parchment, Satellite, Winter, Desert, Night)
- Displays terrain counts with percentages
- Scales to `devicePixelRatio` for sharp rendering on high-DPI displays

## Design properties

### Hexagonal island shape

The island mask uses cube-coordinate hex distance rather than Euclidean distance, producing a hexagon-shaped landmass that matches the hex grid geometry. The hex boundary is cleanly defined — tiles outside it are guaranteed water.

### No directional bias

Every tile's terrain is computed independently from its noise coordinates, not from previously-generated neighbors. The hexagonal island mask is symmetric around the center, so neither player's corner is inherently advantaged.

### Natural feature clustering

Noise-based elevation creates terrain that clusters naturally:
- **Mountain ranges** form along ridgelines rather than appearing as random isolated tiles
- **Forests** band in elevation zones and vary with the vegetation noise layer
- **Water bodies** form coherent shapes at low elevations, with smooth coastlines

### Connectivity

The elevation threshold layout (water at edges, land in center) combined with a large grass band means most maps have connected walkable terrain between the two starting corners. Self-play testing shows 96% of games reach a decisive outcome (vs 14% with the previous generator).
