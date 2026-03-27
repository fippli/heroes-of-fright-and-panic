# Development Guide

## Setup

### Prerequisites

- Node.js 24.x (use [nvm](https://github.com/nvm-sh/nvm))
- pnpm 10+

### Install

```
nvm use
pnpm install
```

### Run

```
pnpm dev          # Start Vite dev server (http://localhost:5173)
pnpm cli          # Run CLI (see cli.md)
```

### Lint and format

```
pnpm lint         # oxlint
pnpm format       # prettier
pnpm typecheck    # tsc --noEmit
```

### Test

```
pnpm test                    # vitest
pnpm dlx tsx --tsconfig tsconfig.base.json scripts/test-play.ts --games 100
```

## Code Conventions

### No mutation

- Always use `const`, never `let` or `var`
- Class attributes should be `readonly`
- Never use `this` in function scope

### No loops

- Never use `while` or `for`
- Use `.map`, `.reduce`, `.filter`, `.forEach`
- Exception: BFS pathfinding in the movement engine uses `while` per the accumulating-spread oxlint exception

### Pure functions

- Game engine functions take state in, return new state out
- No side effects in shared modules
- CLI and edge functions handle I/O at the boundary

### Arrow functions only

```typescript
// Good
const add = (a: number, b: number): number => a + b;

// Bad
function add(a: number, b: number): number { return a + b; }
```

### Explicit null checks

```typescript
// Good
if (value !== undefined) { ... }
if (value !== null) { ... }

// Bad
if (value) { ... }
if (!value) { ... }
```

### No abbreviations

```typescript
// Good
const calculateDistance = (position: TilePosition) => ...

// Bad
const calcDist = (pos: TilePosition) => ...
```

### Type keyword over interface

```typescript
// Good
type Player = { readonly name: string };

// Bad
interface Player { name: string }
```

## Project Structure

```
src/
  shared/           Shared game logic (used by CLI, web, and edge functions)
    actions/        Action type definitions
    ai/             AI opponent (action generation + weighted selection)
    building/       Building types, costs, factories
    combat/         Combat resolution
    equipment/      Equipment types, costs, bonuses
    game/           Game engine, state accessors, types, converters
    map/            Map generation, hex grid, landscape
    movement/       Movement engine: pathfinding, walkability, validation
    piece/          Piece types, stats, factories
    player/         Player state, resources
    production/     Resource production calculation
    research/       Research types, costs, prerequisites
    resource/       Resource engine: costs, payments, production triggers
    steed/          Steed types, costs, bonuses
    tile/           Tile operations: find, replace, neighbors, range
    utils/          Noise generator, random, seeding
  cli/              Terminal interface
    commands/       Subcommands: create, play, auto-play, spectate, login
  core/             Client-side rendering classes (canvas, hex, tiles)
  images/           Image assets and simple color theme
  lib/              API clients (Supabase, games, themes)
  pages/            React pages
    docs/           Documentation viewer
    game/           Game board
    games/          Game list, new game
    map/            Map preview tool
    sandbox/        Free-form sandbox
  styles/           CSS
supabase/
  functions/        Edge functions (game-create, game-action, etc.)
  migrations/       Database schema
docs/               Documentation (markdown, served at /docs)
scripts/            Test harness, screenshots, utilities
```

## Deployment

```
pnpm copy:shared                    # Sync shared code to edge functions
pnpm dlx supabase functions deploy  # Deploy edge functions
pnpm build                          # Build frontend
```

The `copy:shared` step copies `src/shared/` to `supabase/functions/shared/` so edge functions have access to the game engine. This directory is gitignored and generated on deploy.
