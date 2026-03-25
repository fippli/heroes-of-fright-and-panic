# Heroes of Fright and Panic

Asynchronous turn-based strategy game for two players on a hexagonal grid.

## Documentation

- [Game Specification](game-specification.md) — Complete game rules: pieces, buildings, equipment, steeds, research, combat, resources, and win conditions
- [Map Engine](map-engine.md) — Procedural map generation: noise-based terrain, hex island mask, configurable density, and connectivity validation
- [Architecture](architecture.md) — System architecture: modules, data flow, Supabase integration, and deployment
- [CLI Reference](cli.md) — Command-line interface: create games, play interactively or with AI, spectate, and connect to Supabase
- [API Reference](api.md) — Supabase edge functions: game-create, game-action, game-state, game-join
- [Development Guide](development.md) — Setup, tooling, code conventions, and testing

## Quick Links

- `/map` — Visual map generator with terrain controls
- `/sandbox` — Free-form sandbox for testing graphics and placement
- `/games/new` — Create a new game (with map preview and AI opponent option)
