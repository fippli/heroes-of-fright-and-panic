# Heroes of Fright and Panic - Game Documentation

## Overview

**Heroes of Fright and Panic** (also referred to as "Tower Game" or "Forest Game") is a turn-based strategy game featuring two opposing players who take turns based on a day/night cycle. The game is played on a procedurally generated hexagonal tile map where players gather resources, build structures, train units, and compete for territory control.

## Core Concept

> "Defend your house in the woods"

The game pits a **Day Player** against a **Night Player**. Each player controls their units during their respective time periods:

- **Day (06:00 - 18:00)**: Day player is active
- **Night (18:00 - 06:00)**: Night player is active

## Technology Stack

```mermaid
graph TB
    subgraph Frontend
        A[Vite] --> B[TypeScript Client]
        B --> C[HTML5 Canvas]
        C --> D[Hexagonal Tile Rendering]
    end

    subgraph Backend
        E[Express.js] --> F[REST API]
        F --> G[MongoDB]
    end

    subgraph Shared
        H[TypeScript Shared Types]
    end

    B <--> F
    B --> H
    E --> H
```

## Game Flow

```mermaid
flowchart TD
    A[Game Start] --> B[Generate Map]
    B --> C[Place Initial Peasants]
    C --> D{Day/Night Check}

    D -->|Day 06:00-18:00| E[Day Player Turn]
    D -->|Night 18:00-06:00| F[Night Player Turn]

    E --> G[Player Actions]
    F --> G

    G --> H[Move Units]
    G --> I[Gather Resources]
    G --> J[Build Structures]
    G --> K[Train/Upgrade Units]
    G --> L[Attack Enemies]

    H --> M[Tick Clock]
    I --> M
    J --> M
    K --> M
    L --> M

    M --> N{Time Transition?}
    N -->|Dawn| O[Trigger Dawn Event]
    N -->|Dusk| P[Trigger Dusk Event]
    N -->|No| D

    O --> Q[Produce Resources for Day Player]
    P --> R[Produce Resources for Night Player]

    Q --> D
    R --> D
```

## Game Map

The map consists of hexagonal tiles arranged in a grid. Each tile can contain:

- A **Landscape** (terrain type)
- A **Building** (optional)
- A **Piece/Unit** (optional)

### Map Generation Pipeline

```mermaid
flowchart LR
    A[Create Empty Grid] --> B[Generate Base Terrain]
    B --> C[Cleanup Single Tiles]
    C --> D[Create Beaches]
    D --> E[Cleanup Sand]
    E --> F[Place Trees]
    F --> G[Place Mountains]
    G --> H[Final Map]
```

## Resources

Players manage four types of resources:

| Resource     | Source                      | Usage                                   |
| ------------ | --------------------------- | --------------------------------------- |
| 🪵 **Wood**  | Trees (looting)             | Building construction, unit upgrades    |
| 🪨 **Stone** | Mountains (looting)         | Building construction (castles, towers) |
| 🪙 **Gold**  | Houses (taxes from kingdom) | Future mechanics                        |
| 🍖 **Food**  | Farms (production)          | Future mechanics                        |

### Resource Production

```mermaid
flowchart TD
    A[House with Peasant] --> B{Adjacent Farm?}
    B -->|Yes| C[Farm Produces Food]
    B -->|No| D[No Production]

    E[Castle] --> F[Activates Towers in Range]
    F --> G[Towers Provide Vision]

    H[Houses in Kingdom] --> I[Produce Taxes/Gold]
```

## Keyboard Controls

| Key          | Action            |
| ------------ | ----------------- |
| `Arrow Keys` | Pan the camera    |
| `H`          | Build House       |
| `T`          | Build Tower       |
| `C`          | Build Castle      |
| `B`          | Build Boat        |
| `F`          | Build Farm        |
| `P`          | Create Peasant    |
| `U`          | Upgrade Unit      |
| `A`          | Upgrade to Archer |
| `X`          | Attack            |

## Future Ideas (from ideas.md)

- All towers within range of castle get activated
- All houses within kingdom activation area produce taxes (gold)
- Unit upgrade path: Peasant → Knight → Paladin
  - One hit reduces Knight to Peasant
- Soldiers can also upgrade to Archer
