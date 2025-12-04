# System Architecture

This document provides an overview of the Heroes of Fright and Panic system architecture.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[HTML5 Canvas UI]
        CL[Client TypeScript]
        IMG[Image Assets]
    end
    
    subgraph "Server (Node.js)"
        EXP[Express.js]
        API[REST API Routes]
        STATIC[Static File Server]
    end
    
    subgraph "Database"
        MONGO[(MongoDB)]
    end
    
    UI <--> CL
    IMG --> UI
    CL <-->|HTTP/JSON| API
    EXP --> API
    EXP --> STATIC
    API <--> MONGO
    STATIC -->|Assets| CL
```

## Project Structure

```
heroes-of-fright-and-panic/
├── src/
│   ├── client/                 # Frontend application
│   │   ├── assets/             # Game images (sprites)
│   │   ├── core/               # Core game classes
│   │   │   ├── Board.ts        # Main game controller
│   │   │   ├── Building.ts     # Building class + rendering
│   │   │   ├── Clock.ts        # Day/night cycle
│   │   │   ├── Dialog.ts       # UI dialogs
│   │   │   ├── GameImage.ts    # Image loader helper
│   │   │   ├── Hexagon.ts      # Hexagon math & rendering
│   │   │   ├── Landscape.ts    # Terrain class + rendering
│   │   │   ├── Piece.ts        # Unit class + rendering
│   │   │   ├── Player.ts       # Player class
│   │   │   ├── ResourceMap.ts  # Resource handling + UI
│   │   │   └── Tile.ts         # Tile class + rendering
│   │   ├── images/             # Image asset exports
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Utility functions
│   │   ├── canvas.ts           # Canvas wrapper class
│   │   ├── main.ts             # Entry point
│   │   └── style.css           # Styles
│   │
│   ├── server/                 # Backend application
│   │   ├── api/                # API routes
│   │   │   ├── game/           # Game-specific routes
│   │   │   └── router.ts       # Main API router
│   │   ├── client/             # HTML templates
│   │   │   ├── create.html     # Game creation page
│   │   │   ├── index.html      # Landing page
│   │   │   └── router.ts       # Client routes
│   │   ├── database/           # Database layer
│   │   │   └── index.ts        # MongoDB connection & models
│   │   └── index.ts            # Server entry point
│   │
│   └── shared/                 # Shared between client/server
│       ├── building/           # Building type definitions
│       ├── map/                # Map & tile logic
│       │   ├── landscape.ts    # Landscape generation
│       │   ├── map.ts          # Map utilities
│       │   └── tile.ts         # Tile type definition
│       ├── piece/              # Piece type definitions
│       ├── player/             # Player & resource types
│       └── utils/              # Shared utilities
│
├── static/                     # Server static assets
│   └── img/                    # Game images (served)
│
├── documentation/              # Project documentation
│
└── [config files]              # TypeScript, Docker, etc.
```

## Request Flow

### Page Load

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    participant V as Vite (Dev)
    participant DB as MongoDB
    
    B->>S: GET /game/:id
    S->>S: Serve index.html (SPA)
    S-->>B: HTML page
    
    B->>V: Request JS/CSS bundles
    V-->>B: Compiled assets
    
    B->>S: GET /api/game/:id
    S->>DB: Find game by ID
    DB-->>S: Game document
    S-->>B: JSON game state
    
    B->>B: Parse game data
    B->>B: Initialize Canvas
    B->>B: Start render loop
```

### Game Action

```mermaid
sequenceDiagram
    participant U as User
    participant C as Canvas
    participant G as Game (Client)
    participant S as Server
    
    U->>C: Click on tile
    C->>G: click({ x, y })
    G->>G: Find clicked tile
    
    alt Selecting a piece
        G->>G: Set selectedTile
    else Moving a piece
        G->>G: Validate move
        G->>G: Update tile states
        G->>G: Tick clock
    else Looting a tile
        G->>G: Collect resources
        G->>G: Transform landscape
        G->>G: Tick clock
    end
    
    G->>S: POST /api/game/:id/click
    Note right of S: Future: persist state
    S-->>G: Acknowledgment
```

## Rendering Pipeline

```mermaid
flowchart TD
    A[requestAnimationFrame] --> B[calculateNextState]
    B --> C[Update exploration]
    C --> D{Time transition?}
    
    D -->|Dawn| E[Switch to Day Player]
    D -->|Dusk| F[Switch to Night Player]
    D -->|No| G[Continue]
    
    E --> H[Produce Resources]
    F --> H
    H --> G
    
    G --> I[Clear Canvas]
    I --> J[Apply Translation]
    J --> K[Render All Tiles]
    K --> L[Render Selected Tile Highlight]
    L --> M[Render Hovered Tile]
    M --> N[Render UI: Resources & Clock]
    N --> O[Reset Transform]
    O --> A
```

## Module Dependencies

```mermaid
graph TD
    subgraph Client
        main --> Canvas
        main --> Game
        Game --> Tile
        Game --> Player
        Game --> Clock
        Game --> Dialog
        Game --> Building
        Tile --> Hexagon
        Tile --> Landscape
        Tile --> Piece
        Landscape --> ImageAssets
        Building --> ImageAssets
        Piece --> ImageAssets
    end
    
    subgraph Server
        index --> apiRouter
        index --> clientRouter
        apiRouter --> gameRouter
        gameRouter --> Database
        gameRouter --> GameMap
    end
    
    subgraph Shared
        GameMap --> Landscape_S[Landscape]
        GameMap --> Tile_S[Tile]
        Player_S[Player] --> ResourceMap
        Piece_S[Piece] --> ResourceMap
        Building_S[Building] --> ResourceMap
    end
```

## Development vs Production

### Development Mode

```mermaid
graph LR
    subgraph "Development"
        V[Vite Dev Server :5173] -->|HMR| B[Browser]
        N[Node Server :3000] -->|API| B
        M[(MongoDB)] <--> N
    end
```

**Commands:**
- `pnpm dev` - Run both client (Vite watch) and server (tsx watch)
- `pnpm dev:container` - Run in Docker with hot reload

### Production Mode

```mermaid
graph LR
    subgraph "Production"
        N[Node Server :3000] -->|Static + API| B[Browser]
        M[(MongoDB)] <--> N
    end
```

**Commands:**
- `pnpm build` - Build client and server
- `pnpm start` - Run production server

## Docker Configuration

```mermaid
graph TB
    subgraph "Docker Compose"
        APP[App Container]
        MONGO[MongoDB Container]
    end
    
    APP -->|mongodb://mongo:27017| MONGO
    APP -->|:3000| EXT[External Network]
```

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `app` | Custom (Dockerfile) | 3000 | Game server |
| `mongo` | mongo:7 | 27017 | Database |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | Required |
