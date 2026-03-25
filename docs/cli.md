# CLI Reference

The game includes a terminal-based interface for creating, playing, and testing games without the web UI.

## Running

```
pnpm cli <command> [options]
```

## Commands

### create

Create a new game file.

```
pnpm cli create --size <n> --seed <s> --out <path>
```

| Flag | Default | Description |
|------|---------|-------------|
| `--size` | 15 | Board size (NxN) |
| `--seed` | random | Deterministic seed for map generation |
| `--out` | `games/game.json` | Output file path |

### play

Play a game interactively or with AI.

```
pnpm cli play <file> [--player <day|night>] [--auto] [--online] [--json]
```

| Flag | Description |
|------|-------------|
| `--player` | Play as day or night. Omit for hot-seat mode (both players share terminal) |
| `--auto` | AI plays automatically for the specified player |
| `--online` | Connect to Supabase instead of reading a local file. `<file>` becomes the game ID |
| `--json` | JSON batch mode — read commands from stdin, output JSON responses |

**Modes:**

- **Interactive** (`--player day`): single player with command prompt
- **Hot-seat** (no `--player`): both players share one terminal, turns alternate
- **AI opponent** (`--player night --auto`): AI plays the specified side
- **Online** (`--online --player day`): play a Supabase game via the API
- **Online AI** (`--online --player night --auto`): AI plays online against a human

### auto-play

Run both players as AI in one process. Use `spectate` in another terminal to watch.

```
pnpm cli auto-play <file> [--delay <ms>]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--delay` | 300 | Milliseconds between AI actions |

### spectate

Watch a game file for changes and render updates live.

```
pnpm cli spectate <file>
```

### login

Authenticate with Supabase for online play.

```
pnpm cli login --email <email> --password <password>
pnpm cli login --status
pnpm cli login --logout
```

Session is stored in `~/.config/hofap/session.json`.

## Interactive Commands

When playing interactively, these commands are available at the prompt:

| Command | Alias | Description |
|---------|-------|-------------|
| `select <row>,<col>` | `sel` | Select a tile |
| `move <from> <to>` | `m` | Move piece between positions |
| `move <row>,<col>` | `m` | Move selected piece to position |
| `attack <from> <to>` | `a` | Attack from position to target |
| `attack <row>,<col>` | `a` | Attack with selected piece |
| `build <type> <row>,<col>` | `b` | Build: house, tower, wall, church |
| `spawn <row>,<col>` | | Spawn peasant on your house |
| `craft <type> <row>,<col>` | | Craft: sword, shield, bow |
| `steed <type> <house> <target>` | | Buy: horse, boat |
| `train <row>,<col>` | | Train priest at church |
| `heal <priest> <target>` | | Priest heals adjacent piece |
| `research <type> <row>,<col>` | | Research: speed, mining2, mining3, queen |
| `enter <king> <tower>` | | King enters tower (creates castle) |
| `summon <row>,<col>` | | Summon arch angel at church |
| `inspect <row>,<col>` | `i` | Show tile details |
| `status` | `st` | Show resources and clock |
| `board` | `show` | Redraw the board |
| `help` | `h` | Show help |
| `quit` | `q` | Exit |

## Testing

### Self-play test harness

Runs randomized games with weighted AI and checks invariants after every action.

```
pnpm dlx tsx --tsconfig tsconfig.base.json scripts/test-play.ts [--games N] [--seed S] [--verbose]
```

### Screenshots

Capture screenshots of the web UI using Playwright.

```
pnpm dlx tsx scripts/screenshot.ts --url <url> --out <path> --wait <ms>
```
