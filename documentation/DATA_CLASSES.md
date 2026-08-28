# Game Data Classes

This document describes the core data classes and their relationships in Dusk and Dawn.

## Class Diagram

```mermaid
classDiagram
    class Game {
        +String id
        +Canvas canvas
        +Tile[] tiles
        +Clock clock
        +Player player
        +Player dayPlayer
        +Player nightPlayer
        +Tile selectedTile
        +render()
        +generateMap(size)
        +click(position)
        +build(type, position)
        +upgrade(position)
        +attack(position)
    }

    class Player {
        +String type: "day" | "night"
        +String[] inventory
        +ResourceMap resources
        +collect(loot)
        +canAfford(cost)
        +pay(cost)
        +produce(tiles)
    }

    class Tile {
        +Number x
        +Number y
        +Number row
        +Number column
        +Boolean explored
        +Landscape landscape
        +Building building
        +Piece piece
        +render(ctx)
        +isNeighborTo(position)
        +getNeighbors(tiles)
        +getTilesInRange(tiles, range)
        +canWalkOn(tile)
        +canLoot(tile)
        +loot()
    }

    class Landscape {
        +LandscapeType type
        +ResourceMap lootDrop
        +render(ctx, position)
        +loot()
        +transform()
        +generate(neighbors)$
    }

    class Building {
        +BuildingType type
        +ResourceMap cost
        +ResourceMap production
        +Player owner
        +Boolean populated
        +Boolean walkable
        +Number viewRange
        +render(ctx, position)
        +spawn(owner)
        +isOwnedBy(player)
        +build(type, owner)$
    }

    class Piece {
        +PieceType type
        +Player owner
        +Boolean boat
        +Number viewRange
        +ResourceMap upgradeCost
        +LandscapeType[] walkableLandscape
        +LandscapeType[] lootableLandscape
        +render(ctx, position)
        +upgrade()
        +upgradeToArcher()
        +isOwnedBy(player)
    }

    class ResourceMap {
        +Number wood
        +Number gold
        +Number stone
        +Number food
        +add(resourceMap)
        +subtract(resourceMap)
        +render()
    }

    class Clock {
        +Number time
        +Boolean hasDawned
        +Boolean hasDusked
        +tick()
        +dusk(callback)
        +dawn(callback)
        +isNight()
        +isDay()
        +render()
    }

    class Hexagon {
        +Number radius$
        +Number width$
        +Number height$
        +render(ctx, x, y, color)$
        +x(row, column)$
        +y(row)$
        +path(cx, cy)$
        +collidesWithCoordinates(mx, my, cx, cy)$
    }

    Game "1" --> "*" Tile
    Game "1" --> "1" Clock
    Game "1" --> "2" Player
    Tile "1" --> "0..1" Landscape
    Tile "1" --> "0..1" Building
    Tile "1" --> "0..1" Piece
    Player "1" --> "1" ResourceMap
    Building "1" --> "1" Player : owner
    Building "1" --> "1" ResourceMap : cost
    Building "1" --> "1" ResourceMap : production
    Piece "1" --> "1" Player : owner
    Piece "1" --> "1" ResourceMap : upgradeCost
    Landscape "1" --> "0..1" ResourceMap : lootDrop
```

## Enumerations

### LandscapeType

```mermaid
graph LR
    subgraph LandscapeType
        A[grass]
        B[tree]
        C[sand]
        D[water]
        E[unexplored]
        F[mountain]
    end
```

| Type         | Walkable          | Lootable | Loot Drop |
| ------------ | ----------------- | -------- | --------- |
| `grass`      | ✅                | ❌       | -         |
| `tree`       | ❌ (Archers only) | ✅       | 1 Wood    |
| `sand`       | ✅                | ❌       | -         |
| `water`      | ❌                | ❌       | -         |
| `mountain`   | ❌                | ✅       | 1 Stone   |
| `unexplored` | -                 | -        | -         |

### PieceType

```mermaid
graph LR
    subgraph PieceType
        A[peasant]
        B[soldier]
        C[knight]
        D[archer]
        E[boat]
    end
```

| Type      | View Range | Walkable Terrain  | Can Loot       | Upgrade Cost |
| --------- | ---------- | ----------------- | -------------- | ------------ |
| `peasant` | 1          | grass, sand       | tree, mountain | 1 Wood       |
| `soldier` | 1          | grass, sand       | ❌             | 2 Wood       |
| `knight`  | 2          | grass, sand       | ❌             | 3 Wood       |
| `archer`  | 2          | grass, tree, sand | ❌             | 3 Wood       |
| `boat`    | -          | -                 | -              | -            |

### BuildingType

```mermaid
graph LR
    subgraph BuildingType
        A[house]
        B[castle]
        C[tower]
        D[farm]
        E[boat]
    end
```

| Type     | Cost              | Production | View Range | Can Spawn |
| -------- | ----------------- | ---------- | ---------- | --------- |
| `house`  | 2 Wood            | 1 Food     | 1          | Peasant   |
| `castle` | 10 Wood, 10 Stone | -          | 3          | ❌        |
| `tower`  | 1 Wood, 3 Stone   | -          | 4          | ❌        |
| `farm`   | 1 Wood            | 1 Food     | 1          | ❌        |
| `boat`   | Free              | 1 Food     | 1          | ❌        |

## Unit Upgrade Path

```mermaid
flowchart LR
    A[Peasant] -->|2 Wood| B[Soldier]
    B -->|3 Wood| C[Knight]
    A -->|3 Wood| D[Archer]
    B -->|3 Wood| D
```

## Tile Coordinate System

The game uses a hexagonal offset coordinate system where:

- Tiles are identified by `(row, column)`
- Even rows are aligned to the left
- Odd rows are offset by half a hexagon width

```mermaid
graph TD
    subgraph "Row 0 (Even)"
        A0["(0,0)"]
        A1["(0,1)"]
        A2["(0,2)"]
    end

    subgraph "Row 1 (Odd - Offset)"
        B0["(1,0)"]
        B1["(1,1)"]
        B2["(1,2)"]
    end

    subgraph "Row 2 (Even)"
        C0["(2,0)"]
        C1["(2,1)"]
        C2["(2,2)"]
    end
```

### Neighbor Directions

Each hexagon has 6 neighbors:

- **East** / **West** (same row)
- **North-East** / **North-West** (row - 1)
- **South-East** / **South-West** (row + 1)

The column offset depends on whether the row is even or odd.

## Client vs Server Classes

The codebase has parallel implementations for client and server:

```mermaid
flowchart TB
    subgraph "Shared Types"
        S1[Tile]
        S2[Landscape]
        S3[Building]
        S4[Piece]
        S5[Player]
        S6[ResourceMap]
        S7[GameMap]
    end

    subgraph "Client (with rendering)"
        C1[Tile + render]
        C2[Landscape + render]
        C3[Building + render]
        C4[Piece + render]
        C5[Player]
        C6[ResourceMap + render]
        C7[Game/Board]
        C8[Canvas]
        C9[Hexagon]
    end

    subgraph "Server"
        SE1[Database]
        SE2[Game Repository]
        SE3[Express Routes]
    end

    S1 -.-> C1
    S2 -.-> C2
    S3 -.-> C3
    S4 -.-> C4
    S5 -.-> C5
    S6 -.-> C6
    S7 -.-> C7

    SE1 --> SE2
    SE2 --> SE3
    SE3 <--> C7
```
