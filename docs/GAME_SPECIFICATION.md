# Heroes of Fright and Panic - Game Specification

This document provides a complete specification for recreating the game "Heroes of Fright and Panic", a turn-based multiplayer strategy game with hexagonal grid mechanics.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Game Architecture](#game-architecture)
4. [Data Structures](#data-structures)
5. [Game Mechanics](#game-mechanics)
6. [Actions](#actions)
7. [Map Generation](#map-generation)
8. [Fog of War](#fog-of-war)
9. [API Endpoints](#api-endpoints)
10. [Client Rendering](#client-rendering)

---

## Overview

**Heroes of Fright and Panic** is an asynchronous turn-based strategy game for two players. Players alternate control based on an in-game day/night cycle:

- **Day Player**: Active from 06:00 to 17:59 (game time)
- **Night Player**: Active from 18:00 to 05:59 (game time)

The game features:
- Hexagonal grid-based map
- Resource gathering and management
- Unit recruitment and upgrades
- Building construction
- Fog of war (per-player visibility)
- Combat between units

---

## Core Concepts

### Players

There are exactly two players in each game:

| Player | Active Hours | Resource Production Time |
|--------|--------------|--------------------------|
| Day    | 06:00-17:59  | Dawn (when clock hits 06:00) |
| Night  | 18:00-05:59  | Dusk (when clock hits 18:00) |

Each player has:
- A `type`: `"day"` or `"night"`
- A `resources` object containing: `wood`, `stone`, `gold`, `food`

### Resources

```typescript
ResourceMap {
  wood: number;   // Gathered from trees, used for buildings and upgrades
  stone: number;  // Gathered from mountains, used for towers and castles
  gold: number;   // Currently unused (reserved for future features)
  food: number;   // Produced by farms, used for unit maintenance (future)
}
```

### Game Clock

The game uses a 24-hour clock that advances by 1 hour after each action:

```typescript
GameClock {
  time: number;      // 0-23, represents the hour
  hasDawned: boolean; // Tracks if dawn production has occurred this cycle
  hasDusked: boolean; // Tracks if dusk production has occurred this cycle
}
```

**Time transitions:**
- When `time` transitions from 5 → 6 (dawn): Day player receives resource production, `currentPlayer` becomes `"day"`
- When `time` transitions from 17 → 18 (dusk): Night player receives resource production, `currentPlayer` becomes `"night"`

---

## Game Architecture

### Server-Authoritative Design

All game logic runs on the server. The client is a render-only view.

```
┌─────────────┐     Action Request      ┌─────────────┐
│   Client    │ ───────────────────────→│   Server    │
│  (Renderer) │                         │ (GameEngine)│
│             │←─────────────────────── │             │
└─────────────┘   Updated Game State    └─────────────┘
```

**Flow:**
1. Client captures user input (click, build, attack)
2. Client sends action to server via HTTP POST
3. Server validates action and player turn
4. Server executes action and advances clock
5. Server returns updated game state
6. Client re-renders with new state

### Polling for Opponent Moves

The client polls the server every 2 seconds to check for opponent moves when it's not their turn.

---

## Data Structures

### Tile

The basic unit of the game map.

```typescript
Tile {
  column: number;           // X coordinate (0-indexed)
  row: number;              // Y coordinate (0-indexed)
  landscape: Landscape | null;
  piece: Piece | null;      // Unit on this tile
  building: Building | null; // Structure on this tile
}
```

### Landscape Types

```typescript
enum LandscapeType {
  grass = "grass";       // Walkable, buildable
  tree = "tree";         // Lootable (yields 1 wood), blocks movement
  sand = "sand";         // Walkable (beaches near water)
  water = "water";       // Impassable (except boats)
  mountain = "mountain"; // Lootable (yields 1 stone), blocks movement
  unexplored = "unexplored"; // Hidden by fog of war
}
```

**Landscape Properties:**
```typescript
Landscape {
  type: LandscapeType;
  lootDrop?: ResourceMap;  // Resources gained when looted
}
```

| Type | Walkable | Lootable | Loot Drop | Buildable |
|------|----------|----------|-----------|-----------|
| grass | ✓ | ✗ | - | ✓ |
| tree | ✗ | ✓ | 1 wood | ✗ |
| sand | ✓ | ✗ | - | ✗ |
| water | ✗ | ✗ | - | ✗ |
| mountain | ✗ | ✓ | 1 stone | ✗ |
| unexplored | - | - | - | - |

### Piece (Unit) Types

```typescript
enum PieceType {
  peasant = "peasant";
  soldier = "soldier";
  knight = "knight";
  archer = "archer";
  boat = "boat";
}
```

**Piece Properties:**

| Type | View Range | Walkable Terrain | Lootable Terrain | Creation Cost | Upgrade Cost |
|------|------------|------------------|------------------|---------------|--------------|
| peasant | 1 | grass, sand | tree, mountain | 1 wood | - |
| soldier | 1 | grass, sand | - | - | 2 wood (from peasant) |
| knight | 2 | grass, sand | - | - | 3 wood (from soldier) |
| archer | 2 | grass, tree, sand | - | - | 3 wood (from any) |
| boat | 1 | water | - | - | - |

**Upgrade Paths:**
```
peasant → soldier → knight
    ↘
      archer (direct upgrade, any unit type)
```

### Building Types

```typescript
enum BuildingType {
  house = "house";
  castle = "castle";
  tower = "tower";
  farm = "farm";
  boat = "boat";
}
```

**Building Properties:**

| Type | Cost | View Range | Production | Special Rules |
|------|------|------------|------------|---------------|
| house | 2 wood | 1 | 1 food (when connected to farm) | Can spawn peasants |
| castle | 10 wood, 10 stone | 3 | - | Defensive structure |
| tower | 1 wood, 3 stone | 4 | - | Extended vision |
| farm | 1 wood | 1 | 1 food | Must be adjacent to house |
| boat | 0 | 1 | 1 food | Water transport (incomplete) |

**Farm Production Rules:**
A farm produces food only when:
1. The farm is adjacent to a house
2. The house has a peasant inside it
3. Both the farm and house are owned by the same player

---

## Game Mechanics

### Hexagonal Grid System

The game uses an **odd-r offset coordinate system** for hexagons.

**Neighbor Calculation:**

For a tile at position `(row, column)`:

**Even rows (row % 2 === 0):**
```
Neighbors:
- East:      (row, column + 1)
- West:      (row, column - 1)
- NorthEast: (row - 1, column)
- NorthWest: (row - 1, column - 1)
- SouthEast: (row + 1, column)
- SouthWest: (row + 1, column - 1)
```

**Odd rows (row % 2 === 1):**
```
Neighbors:
- East:      (row, column + 1)
- West:      (row, column - 1)
- NorthEast: (row - 1, column + 1)
- NorthWest: (row - 1, column)
- SouthEast: (row + 1, column + 1)
- SouthWest: (row + 1, column)
```

### Movement

A unit can move to an adjacent tile if:
1. The target tile's landscape is in the unit's `walkableLandscape` array
2. The target tile has no other unit
3. It is the unit owner's turn

### Looting

A unit can loot an adjacent tile if:
1. The target tile's landscape is in the unit's `lootableLandscape` array
2. The landscape has a `lootDrop` defined

**After looting:**
- The player receives the `lootDrop` resources
- The landscape transforms to `grass`

### Combat

Units can attack enemy units within their view range:
1. Attacker must be owned by the current player
2. Target must be within attacker's `viewRange`
3. Target cannot be owned by the same player

**Combat resolution:** Target unit is destroyed (removed from tile).

### Building Construction

To build a structure:
1. Must be the player's turn
2. Target tile must be `grass` landscape
3. Target tile must have no existing building
4. An adjacent tile must have a unit owned by the player
5. Player must be able to afford the cost

**Farm special rule:** Must be adjacent to a house owned by the same player.

### Unit Creation

Peasants are spawned from houses:
1. Must be the player's turn
2. The house must be owned by the player
3. The house tile must be empty (no unit)
4. Player must afford 1 wood

### Turn Advancement

After each action that modifies game state:
1. Clock advances by 1 hour: `time = (time + 1) % 24`
2. Check for dawn transition (time reaches 6)
3. Check for dusk transition (time reaches 18)
4. Update `currentPlayer` based on new time

---

## Actions

All actions follow this pattern:

```typescript
interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}
```

### Click Action

Used for selecting tiles, moving units, and looting.

```typescript
interface ClickAction {
  type: "click";
  player: "day" | "night";
  position: { row: number; column: number };
  selectedPosition?: { row: number; column: number };
}
```

**Behavior:**
- If clicking own unit: Select it
- If unit selected and clicking adjacent walkable tile: Move
- If unit selected and clicking adjacent lootable tile: Loot

### Build Action

Construct a building.

```typescript
interface BuildAction {
  type: "build";
  player: "day" | "night";
  buildingType: BuildingType;
  position: { row: number; column: number };
  selectedPosition?: { row: number; column: number };
}
```

### Create Peasant Action

Spawn a peasant in a house.

```typescript
interface CreatePeasantAction {
  type: "createPeasant";
  player: "day" | "night";
  position: { row: number; column: number };
}
```

### Upgrade Action

Upgrade a unit.

```typescript
interface UpgradeAction {
  type: "upgrade";
  player: "day" | "night";
  position: { row: number; column: number };
  targetType?: PieceType; // Optional: for archer upgrade
}
```

### Attack Action

Attack an enemy unit.

```typescript
interface AttackAction {
  type: "attack";
  player: "day" | "night";
  position: { row: number; column: number };      // Target
  selectedPosition: { row: number; column: number }; // Attacker
}
```

---

## Map Generation

Maps are procedurally generated using the following algorithm:

### Step 1: Initialize Grid

Create a grid of `size × size` tiles with `null` landscape.

### Step 2: Generate Base Terrain

For each tile (processed in order), generate landscape based on neighbors:
- If all neighbors are grass: 95% grass, 5% water
- If any neighbor is water: 80% water, 20% grass (creates water bodies)
- Otherwise: 20% water, 80% grass

### Step 3: Cleanup Singles

Remove isolated tiles:
- Single grass tiles surrounded by water → become water
- Single water tiles surrounded by grass → become grass

### Step 4: Create Beaches

Convert water tiles adjacent to grass into sand (creates shorelines).

### Step 5: Cleanup Sand

Remove sand tiles that aren't adjacent to water (convert back to grass).

### Step 6: Place Trees

For each grass tile: 70% chance to become tree.

### Step 7: Place Mountains

For each remaining grass tile: 20% chance to become mountain.

### Map Sizes

Supported sizes: 25×25 to 70×70 tiles.

---

## Fog of War

Each player can only see tiles within range of their units and buildings.

### Visibility Calculation

A tile is visible to a player if ANY of the following are true:
1. The player has a unit on the tile
2. The player has a building on the tile
3. The tile is within `viewRange` of a player's unit
4. The tile is within `viewRange` of a player's building

### View Ranges

| Entity | View Range |
|--------|------------|
| Peasant | 1 |
| Soldier | 1 |
| Knight | 2 |
| Archer | 2 |
| House | 1 |
| Farm | 1 |
| Tower | 4 |
| Castle | 3 |

### Range Calculation (BFS)

```typescript
function getTilesInRange(center: Position, range: number): Position[] {
  const result = [center];
  let currentLayer = [center];

  for (let i = 0; i < range; i++) {
    const nextLayer = [];
    for (const pos of currentLayer) {
      for (const neighbor of getNeighbors(pos)) {
        if (!result.includes(neighbor)) {
          result.push(neighbor);
          nextLayer.push(neighbor);
        }
      }
    }
    currentLayer = nextLayer;
  }

  return result;
}
```

### Hidden Information

For non-visible tiles, the client receives:
```typescript
{
  row: number,
  column: number,
  landscape: { type: "unexplored" },
  piece: null,
  building: null
}
```

---

## API Endpoints

### Authentication

**POST /api/auth/signin**
- Body: `{ email: string }`
- Sends magic link to email

**GET /api/auth/verify?token=xxx**
- Verifies magic link token
- Sets session cookie

**GET /api/auth/me**
- Returns current user info

**POST /api/auth/signout**
- Clears session

### Games

**GET /api/game**
- Returns list of games for current user

**POST /api/game**
- Creates new game
- Body: `{ name?: string, size?: number }`

**GET /api/game/:id**
- Returns game state (filtered by fog of war)
- Query: `?player=day|night`

**POST /api/game/:id/action**
- Executes an action
- Body: `GameAction` (see Actions section)
- Returns: `ActionResult` + updated game state

**POST /api/game/:id/invite**
- Invites another player
- Body: `{ email: string }`

---

## Client Rendering

### Canvas Setup

The game renders on an HTML5 Canvas with:
- Hexagonal tiles
- Camera panning via mouse drag
- Click detection using hexagon geometry

### Hexagon Geometry

```typescript
const HEX_SIZE = 30; // Radius from center to vertex

// Hexagon dimensions
const width = HEX_SIZE * 2;
const height = Math.sqrt(3) * HEX_SIZE;

// Pixel position for tile at (row, column)
function tileToPixel(row: number, column: number): { x: number, y: number } {
  const x = column * width * 0.75;
  const y = row * height + (column % 2 === 1 ? height / 2 : 0);
  return { x, y };
}
```

### Collision Detection

To determine which hex was clicked:
1. Calculate approximate tile from click position
2. Check if click is within hexagon boundary using circle collision (inscribed circle)
3. If not, check neighboring hexagons

### Render Order

1. Draw all landscapes (base terrain)
2. Draw all buildings
3. Draw all pieces (units)
4. Draw selection highlight (if any)
5. Draw UI overlays (resources, clock, action buttons)

---

## Database Schema

### Game Document (MongoDB)

```typescript
{
  _id: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  name?: string,
  size: number,
  tiles: Tile[],
  dayPlayer: Player,
  nightPlayer: Player,
  currentPlayer: "day" | "night",
  clock: GameClock,
  creatorEmail?: string,
  dayPlayerEmail?: string | null,
  nightPlayerEmail?: string | null,
  dayPlayerLastMove?: Date | null,
  nightPlayerLastMove?: Date | null,
  invitedEmail?: string | null
}
```

### User Document

```typescript
{
  _id: ObjectId,
  email: string,
  createdAt: Date,
  lastLoginAt?: Date
}
```

### Session Document

```typescript
{
  _id: ObjectId,
  sessionId: string,
  userId: ObjectId,
  email: string,
  createdAt: Date,
  expiresAt: Date
}
```

---

## Initial Game Setup

When a new game is created:

1. Generate map tiles using map generation algorithm
2. Clear a starting area for each player (convert to grass)
3. Place initial house for each player
4. Place initial peasant in each house
5. Set initial resources: `{ wood: 5, stone: 0, gold: 0, food: 0 }`
6. Set clock to `{ time: 6, hasDawned: true, hasDusked: false }`
7. Set `currentPlayer` to `"day"`

**Starting positions:**
- Day player: Top-left area of map
- Night player: Bottom-right area of map

---

## Tech Stack Reference

- **Frontend**: React 19, Vite, TypeScript, HTML5 Canvas, Chakra UI
- **Backend**: Express.js 5, TypeScript, MongoDB
- **Authentication**: Magic link (passwordless) via email
- **Deployment**: Docker, Docker Compose

---

## Future Considerations

Features mentioned but not fully implemented:
- Gold resource usage
- Food consumption by units
- Boat/naval gameplay
- Win conditions
- Spectator mode
- Game replays
