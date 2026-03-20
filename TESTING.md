# Game Testing Procedure

A structured testing plan for Heroes of Fright and Panic. Designed to be executed by Claude via the CLI (`pnpm cli`) or programmatically through the engine API.

## Current CLI Capabilities

The game has a working interactive CLI (`src/cli/main.ts`) launched with `pnpm cli [size]`.

**Available commands:**

| Command | Alias | Description |
|---------|-------|-------------|
| `select <row>,<col>` | `sel` | Select a tile/unit |
| `move <row>,<col>` | `m` | Move selected unit to target |
| `attack <row>,<col>` | `a` | Attack target with selected unit |
| `build <type> <row>,<col>` | `b` | Build house/tower/wall/church |
| `spawn <row>,<col>` | | Spawn peasant on your house |
| `inspect <row>,<col>` | `i` | Show tile details |
| `status` | `st` | Show resources and clock |
| `help` | `h` | Show help |
| `quit` | `q` | Exit |

**Missing CLI commands** (engine supports these but CLI has no command for them yet):

- `craftEquipment` (sword/shield/bow)
- `buySteed` (horse/boat)
- `trainPriest`
- `heal`
- `research`
- `enterTower`
- `summonArchAngel`

### CLI gaps for automated testing

The current CLI is interactive (readline-based) and missing several action commands. To enable Claude-driven automated testing, the following are needed:

1. **Non-interactive mode** — accept a sequence of commands from stdin or a script file, outputting board state as JSON or structured text after each action.
2. **Full action coverage** — add CLI commands for all engine actions (craft, steed, priest, heal, research, enterTower, summon).
3. **JSON output mode** — machine-readable output for Claude to parse game state, available positions, and action results.
4. **Seed-based map generation** — reproducible maps for deterministic test scenarios.

## Engine API (Programmatic Testing)

The engine is pure and immutable. Every action goes through:

```typescript
handleAction(game: Game, action: GameAction): { game: Game; result: ActionResult }
```

All action types are defined in `src/shared/actions/index.ts`. The engine can be used directly in test files without any CLI.

---

## Test Procedures

### Phase 1: Movement

Test that all piece types can move correctly across all terrain types.

#### 1.1 Basic peasant movement
1. Create a game.
2. Find the day player's peasant position.
3. Find an adjacent grass tile.
4. Dispatch `MoveAction` from peasant to adjacent grass.
5. **Assert**: peasant is now on the target tile, source tile is empty.
6. **Assert**: clock advanced by speed-appropriate amount.

#### 1.2 Movement range limits
1. Move a peasant with move range 1.
2. Attempt to move 2 tiles away.
3. **Assert**: action fails with error.

#### 1.3 Mounted movement (move range 2)
1. Equip a peasant, buy a horse, mount it (move range becomes 2).
2. Move 2 tiles in one action along a clear path.
3. **Assert**: success, piece is at destination.

#### 1.4 Path obstruction
1. Place an enemy piece or building between source and destination.
2. Attempt to move through the occupied tile.
3. **Assert**: action fails (no clear path).

#### 1.5 Terrain restrictions
1. Attempt to move a peasant (no bow) onto a tree tile.
2. **Assert**: fails.
3. Equip the peasant with a bow, retry.
4. **Assert**: succeeds.

#### 1.6 Water movement
1. Attempt to move a land piece onto water.
2. **Assert**: fails.
3. Mount a boat, move onto water.
4. **Assert**: succeeds.

#### 1.7 Wall blocking
1. Build a wall as day player.
2. Move a day piece through the wall tile.
3. **Assert**: succeeds (owner can walk through).
4. Switch to night player. Attempt to move through the wall.
5. **Assert**: fails (enemy blocked).

---

### Phase 2: Building Construction

#### 2.1 Build house
1. Find a grass tile adjacent to the day peasant.
2. Dispatch `BuildAction` with type `house` at that position.
3. **Assert**: house exists on tile, owned by day. Adjacent grass tiles converted to farm.
4. **Assert**: 1 wood deducted from day player.

#### 2.2 Build tower
1. Give day player 10 stone.
2. Build tower on adjacent grass tile.
3. **Assert**: tower placed, 10 stone deducted.

#### 2.3 Build wall
1. Build wall on adjacent grass.
2. **Assert**: wall placed, 1 stone deducted.

#### 2.4 Build church
1. Give day player 3 wood + 3 stone.
2. Build church on adjacent grass.
3. **Assert**: church placed, resources deducted.

#### 2.5 Build on invalid terrain
1. Attempt to build on tree, water, mountain, sand, farm.
2. **Assert**: all fail (must be grass).

#### 2.6 Build not adjacent to own unit
1. Attempt to build on a grass tile with no adjacent friendly unit.
2. **Assert**: fails.

#### 2.7 Build on occupied tile
1. Attempt to build on a tile that already has a building.
2. **Assert**: fails.

---

### Phase 3: Unit Creation

#### 3.1 Spawn peasant
1. Build a house. Ensure it has no piece on it.
2. Dispatch `SpawnPeasantAction` at the house position.
3. **Assert**: peasant appears on the house tile, 1 food deducted.

#### 3.2 Spawn on occupied house
1. Spawn a peasant on a house. Attempt to spawn another.
2. **Assert**: fails (house occupied).

#### 3.3 Spawn without food
1. Set player food to 0. Attempt to spawn.
2. **Assert**: fails (cannot afford).

#### 3.4 Train priest
1. Build a church. Give player 1 gold.
2. Dispatch `TrainPriestAction` at church.
3. **Assert**: priest appears, 1 gold deducted.

---

### Phase 4: Equipment

#### 4.1 Craft sword
1. Give player 1 iron. Have a peasant on a tile.
2. Dispatch `CraftEquipmentAction` (sword) at peasant position.
3. **Assert**: peasant now has sword, attack increased by 1, 1 iron deducted.

#### 4.2 Craft shield
1. Give player 1 wood.
2. Craft shield on peasant.
3. **Assert**: defense increased by 1, 1 wood deducted.

#### 4.3 Craft bow
1. Give player 1 wood + 1 iron.
2. Craft bow on peasant.
3. **Assert**: attack range increased, can now walk on trees, resources deducted.

#### 4.4 Duplicate equipment
1. Equip a peasant with a sword.
2. Attempt to equip another sword.
3. **Assert**: fails (already has sword).

#### 4.5 Equip special units
1. Attempt to equip king/priest/arch angel with equipment.
2. **Assert**: fails (special units cannot equip).

---

### Phase 5: Steeds

#### 5.1 Buy horse
1. Build a house. Give player 10 food.
2. Dispatch `BuySteedAction` (horse) from house to adjacent land tile.
3. **Assert**: horse placed on target tile, 10 food deducted.

#### 5.2 Buy boat
1. Build a house adjacent to water. Give player 10 wood.
2. Buy boat, targeting adjacent water tile.
3. **Assert**: boat placed on water, 10 wood deducted.

#### 5.3 Mount steed
1. Place a horse on a tile. Move a peasant onto that tile.
2. **Assert**: peasant is now mounted. View +1, move +1.

#### 5.4 Arch angel cannot mount
1. Summon an arch angel. Place a horse adjacent.
2. Move arch angel onto horse tile.
3. **Assert**: arch angel does NOT mount (verify steed is null).

---

### Phase 6: Combat

#### 6.1 Peasant vs peasant
1. Place two opposing peasants adjacent to each other.
2. Day peasant attacks night peasant.
3. **Assert**: night peasant destroyed (1 attack vs 0 defense + 1 heart).

#### 6.2 Peasant vs defender (shield)
1. Give night peasant a shield (1 defense).
2. Day peasant attacks.
3. **Assert**: night peasant survives (defense absorbs 1 damage, hearts still 1).

#### 6.3 Swordsman vs defender
1. Equip day peasant with sword (2 attack).
2. Attack night defender (1 defense + 1 heart).
3. **Assert**: night piece destroyed.

#### 6.4 Attack range (melee)
1. Place attacker 2 tiles away from target (no bow).
2. Attempt attack.
3. **Assert**: fails (out of range).

#### 6.5 Attack range (bow)
1. Equip day peasant with bow (range 2).
2. Attack target 2 tiles away.
3. **Assert**: succeeds.

#### 6.6 Attack range (mounted bow)
1. Bow + horse = range 3. Attack from 3 tiles.
2. **Assert**: succeeds.

#### 6.7 Destroy building
1. Peasant (attack 1) attacks enemy house (defense 1).
2. **Assert**: house survives (attack not > defense).
3. Swordsman (attack 2) attacks house.
4. **Assert**: house destroyed.

#### 6.8 Kill king = game over
1. Reduce enemy king to 1 heart. Attack with sufficient force.
2. **Assert**: king destroyed, `gameOver === true`, attacker's faction is `winner`.

#### 6.9 Destroy castle = king dies
1. Create enemy castle (king inside tower).
2. Attack castle with arch angel (attack 3 > defense 1).
3. **Assert**: castle destroyed, king dies, game over.

---

### Phase 7: Research

#### 7.1 Create castle
1. Build tower. Move king adjacent to tower.
2. Dispatch `EnterTowerAction`.
3. **Assert**: tower becomes castle, king is inside.

#### 7.2 Research speed
1. Give player 1 wood. Dispatch `ResearchAction` (speed) at castle.
2. **Assert**: speed level increases, action duration decreases.

#### 7.3 Research mining chain
1. Research Mining II (1 stone) at castle.
2. **Assert**: mountains now produce iron.
3. Research Mining III (1 iron).
4. **Assert**: mountains now produce gold.

#### 7.4 Research queen
1. Give player 25 gold. Research Queen.
2. **Assert**: all tiles adjacent to buildings become visible.

#### 7.5 Research prerequisites
1. Attempt Mining III without Mining II.
2. **Assert**: fails.

---

### Phase 8: Healing and Faith

#### 8.1 Church produces faith
1. Build church. Train priest. Place priest inside.
2. Trigger production cycle (phase transition).
3. **Assert**: player gains +1 faith.

#### 8.2 Priest heals
1. Damage a friendly piece (reduce hearts).
2. Place priest adjacent. Give player 1 faith.
3. Dispatch `HealAction`.
4. **Assert**: target gains 1 heart, 1 faith consumed.

#### 8.3 Heal cannot restore defense
1. Damage a piece's defense (e.g., shielded piece hit once).
2. Attempt heal.
3. **Assert**: hearts can increase but defense stays reduced.

---

### Phase 9: Arch Angel Summoning

#### 9.1 Summon requirements
1. Build 10 churches. Train 10 priests, each inside a church.
2. Accumulate 100 faith.
3. Dispatch `SummonArchAngelAction` at a church.
4. **Assert**: arch angel appears at chosen church, 100 faith consumed.

#### 9.2 Insufficient priests
1. Have 9 praying priests and 100 faith. Attempt summon.
2. **Assert**: fails.

#### 9.3 Insufficient faith
1. Have 10 praying priests and 99 faith. Attempt summon.
2. **Assert**: fails.

#### 9.4 Arch angel stats
1. After summoning, inspect arch angel.
2. **Assert**: 3 hearts, 3 attack, 3 defense, 3 view, 3 move.

---

### Phase 10: Production and Resource Economy

#### 10.1 House farm production
1. Build house (adjacent grass becomes farm). Place peasant inside.
2. Trigger dawn/dusk production.
3. **Assert**: +1 food per adjacent farm tile.

#### 10.2 House tree production
1. House adjacent to tree. Peasant inside.
2. Trigger production.
3. **Assert**: +1 wood.

#### 10.3 House mountain production
1. House adjacent to mountain. Peasant inside.
2. Base: +1 stone. With Mining II: +1 stone + 1 iron. With Mining III: +1 stone + 1 iron + 1 gold.

#### 10.4 Fishing
1. Place boat with peasant completely surrounded by water.
2. Trigger production.
3. **Assert**: +1 food.

#### 10.5 Tile produces once per cycle
1. Build two houses adjacent to the same tree tile. Place peasants in both.
2. Trigger production.
3. **Assert**: +1 wood total (not +2).

---

### Phase 11: Turn and Clock System

#### 11.1 Phase transitions
1. Day player acts until clock crosses 18:00.
2. **Assert**: control switches to night player. Night production triggers.

#### 11.2 Speed affects action count
1. Speed 0: 60 min/action, 12 actions per phase.
2. Speed 5: 1 min/action, 720 actions per phase.
3. Count actions before phase switch at each speed level.

---

### Phase 12: Vision and Fog of War

#### 12.1 Piece vision
1. Get visible tiles for a player.
2. **Assert**: only tiles within view range of own pieces/buildings are visible.

#### 12.2 Building vision ranges
1. House = 1, tower = 4, castle = 3, wall = 0, church = 1.
2. Place each building and verify visible tile count.

#### 12.3 Queen research vision
1. Research Queen. Build buildings with gaps between them.
2. **Assert**: all tiles adjacent to buildings are now visible.

---

### Phase 13: Win Conditions

#### 13.1 King death
1. Kill enemy king directly.
2. **Assert**: game over, attacker wins.

#### 13.2 No pieces and no houses
1. Destroy all enemy pieces and houses (king already dead from previous).
2. **Assert**: game over, attacker wins.

#### 13.3 Player with house but no units
1. Player has only a house remaining (king dead scenario triggers first).
2. Verify the king-death condition takes priority.

---

## Automated Testing Architecture

### Approach 1: Unit tests via engine API (current)

Existing test files in `src/shared/*/` test individual modules. Expand these to cover the procedures above by calling `handleAction` directly.

### Approach 2: CLI scripting mode (needed)

Add a `--script` flag to the CLI that:
- Reads commands from stdin (one per line)
- Outputs JSON after each command: `{ board, status, result, error }`
- Exits when stdin closes

This enables piping a command sequence:
```bash
echo "build house 5,5\nspawn 5,5\nstatus" | pnpm cli --script 15
```

### Approach 3: Claude-vs-Claude (goal)

Two Claude instances play against each other through the engine:

```
                +-----------+
                |  Game     |
                |  Engine   |
                +-----+-----+
                      |
         handleAction(game, action)
                      |
           +----------+----------+
           |                     |
   +-------+-------+    +-------+-------+
   | Claude (Day)  |    | Claude (Night)|
   | - sees board  |    | - sees board  |
   | - picks action|    | - picks action|
   +---------------+    +---------------+
```

**Implementation plan:**

1. **Game harness** — a Node.js script that:
   - Creates a game with a seeded map.
   - On each turn, serializes the filtered game state (fog of war applied) to JSON.
   - Sends the state + available actions to the active player's Claude instance.
   - Receives a chosen action as structured JSON.
   - Validates and dispatches the action via `handleAction`.
   - Loops until game over.

2. **Claude player prompt** — each Claude instance receives:
   - The game rules (GAME.md).
   - Current visible board state as JSON.
   - Player's resources and research.
   - List of valid actions (positions, types).
   - Instruction to respond with a single action in JSON format.

3. **Action validation layer** — the harness validates Claude's response matches a `GameAction` type before dispatching. Invalid responses get re-prompted.

4. **Game log** — every action and resulting state is logged for replay and analysis.

### Key engine features that enable this

- **Pure engine**: `handleAction` takes state in, returns state out. No side effects.
- **Fog of war**: `getFilteredGameState()` already exists to hide information per player.
- **Typed actions**: all actions are well-typed TypeScript discriminated unions.
- **Immutable state**: safe to serialize/deserialize between turns.

---

## Implementation Priority

1. **Add missing CLI commands** — craft, steed, priest, heal, research, enterTower, summon.
2. **Add JSON output mode** — `--json` flag for machine-readable output.
3. **Add seeded map generation** — deterministic maps for reproducible tests.
4. **Expand engine test coverage** — implement Phase 1-13 as vitest tests.
5. **Build Claude player harness** — Node.js script that drives Claude-vs-Claude games.
6. **Add valid-actions helper** — function that returns all legal actions for current player/state (essential for Claude to know what it can do).
