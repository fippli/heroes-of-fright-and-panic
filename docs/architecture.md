# Architecture

## System Overview

```mermaid
graph TB
    subgraph Client
        WebUI[React Web UI]
        CLI[CLI Terminal]
    end

    subgraph Supabase
        Auth[Supabase Auth]
        DB[(PostgreSQL)]
        Edge[Edge Functions]
        Storage[File Storage]
    end

    subgraph Shared
        Engine[Game Engine]
        Movement[Movement Engine]
        Resource[Resource Engine]
        AI[AI Module]
        MapGen[Map Generator]
        Tile[Tile Operations]
    end

    WebUI -->|HTTP| Edge
    CLI -->|HTTP| Edge
    CLI -->|Local files| Engine
    Edge --> Engine
    Engine --> Movement
    Engine --> Resource
    Engine --> Tile
    AI --> Engine
    MapGen --> Tile
    Edge --> DB
    Edge --> Auth
    WebUI --> Auth
    WebUI --> Storage
```

## Module Architecture

The shared game logic is organized into focused modules with clear responsibilities:

```mermaid
graph LR
    subgraph Core Engines
        GE[Game Engine<br/>Action dispatcher<br/>Clock, win conditions]
        ME[Movement Engine<br/>Pathfinding, walkability<br/>Move validation]
        RE[Resource Engine<br/>Costs, payments<br/>Production triggers]
    end

    subgraph Data Modules
        T[Tile<br/>Find, replace<br/>Neighbors, range]
        S[State<br/>getPlayer<br/>withPlayer, withTiles]
    end

    subgraph Domain
        P[Piece<br/>Types, stats<br/>Equipment, steeds]
        B[Building<br/>Types, costs<br/>Walkability]
        C[Combat<br/>Damage resolution]
        R[Research<br/>Speed, mining<br/>Prerequisites]
    end

    GE --> ME
    GE --> RE
    GE --> C
    GE --> T
    GE --> S
    ME --> T
    RE --> T
    RE --> S
```

## Data Flow

### Game Action Flow

```mermaid
sequenceDiagram
    participant Player
    participant Client
    participant Edge as Edge Function
    participant Engine as Game Engine
    participant DB as PostgreSQL

    Player->>Client: Click / command
    Client->>Edge: POST game-action
    Edge->>DB: Fetch game state
    DB-->>Edge: Game row (JSONB)
    Edge->>Engine: handleAction(game, action)
    Engine-->>Edge: { game, result }

    alt AI Opponent
        Edge->>Engine: generateAllActions + pickAction
        Engine-->>Edge: AI turns applied
    end

    Edge->>DB: UPDATE game state
    Edge-->>Client: Filtered game state
    Client-->>Player: Render updated board
```

### Map Generation Flow

```mermaid
graph TB
    Seed[Seed + Config] --> Noise[Noise Generator]
    Noise --> ElevNoise[Elevation Noise<br/>4 octaves]
    Noise --> ForestNoise[Forest Noise<br/>3 octaves]
    Noise --> MountainNoise[Mountain Noise<br/>2 octaves]

    ElevNoise --> IslandMask[Hex Island Mask]
    IslandMask --> WaterLand{Water vs Land}
    WaterLand -->|Below threshold| Water[Water]
    WaterLand -->|Shoreline| Sand[Sand]
    WaterLand -->|Land| TerrainCheck{Feature Check}

    ForestNoise --> TerrainCheck
    MountainNoise --> TerrainCheck
    TerrainCheck -->|Mountain noise high| Mountain[Mountain]
    TerrainCheck -->|Forest noise high| Tree[Tree]
    TerrainCheck -->|Neither| Grass[Grass]

    Water --> PostProcess[Beach + Sand Cleanup]
    Sand --> PostProcess
    Mountain --> PostProcess
    Tree --> PostProcess
    Grass --> PostProcess
    PostProcess --> ConnCheck[Connectivity Check]
    ConnCheck -->|No path| Retry[Retry with new seed]
    ConnCheck -->|Path exists| ClearStart[Clear Starting Areas]
    ClearStart --> PlacePieces[Place Kings + Peasants]
```

## Database Schema

```mermaid
erDiagram
    games {
        uuid id PK
        timestamptz created_at
        timestamptz updated_at
        text name
        integer size
        jsonb tiles
        jsonb day_player
        jsonb night_player
        text current_player
        jsonb clock
        text creator_email
        text day_player_email
        text night_player_email
        boolean game_over
        text winner
        uuid theme_id FK
    }

    themes {
        uuid id PK
        text name UK
        text description
        text created_by
    }

    theme_assets {
        uuid id PK
        uuid theme_id FK
        text category
        text asset_key
        text storage_path
    }

    admin_users {
        text email PK
    }

    games ||--o| themes : "uses"
    themes ||--o{ theme_assets : "has"
```

## Client Architecture

```mermaid
graph TB
    subgraph React Pages
        Landing[Landing Page]
        Games[Games List]
        NewGame[New Game<br/>Map preview + config]
        GamePage[Game Page<br/>Canvas rendering]
        MapPage[Map Preview<br/>Terrain controls]
        Sandbox[Sandbox<br/>Free placement]
        Docs[Documentation<br/>Markdown viewer]
    end

    subgraph Core Rendering
        Canvas[Canvas Manager<br/>Mouse, keyboard, camera]
        Hexagon[Hexagon<br/>Geometry + rendering]
        TileR[Tile Renderer<br/>Landscape + pieces]
        ImageAssets[Image Assets<br/>Sprites or simple theme]
    end

    GamePage --> Canvas
    Sandbox --> Canvas
    Canvas --> Hexagon
    TileR --> Hexagon
    TileR --> ImageAssets
```

## Deployment

```mermaid
graph LR
    Source[src/shared/] -->|pnpm copy:shared| EdgeShared[supabase/functions/shared/]
    EdgeShared --> Deploy[supabase functions deploy]
    Source --> Build[pnpm build]
    Build --> Dist[dist/]
    Dist --> Host[Static hosting]
```
