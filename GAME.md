# Heroes of Fright and Panic

A turn-based two-player strategy game played on a procedurally generated hexagonal grid. Players compete as opposing Day and Night factions, gathering resources, building infrastructure, equipping units, and fighting to eliminate the enemy.

## Factions

The game is themed around **living vs dead**, **day vs night**. The Day faction represents the living — order, faith, light. The Night faction represents the dead — fear, darkness, undeath. **Faith** is intended to be a central resource that connects to this thematic divide, though the full mechanics are still being designed.

Two players take alternating turns based on a 24-hour clock cycle:

- **Day player** (living) acts during hours 06:00-17:59
- **Night player** (dead) acts during hours 18:00-05:59

Every action advances the clock by a duration determined by the player's **speed level**. When the clock crosses dawn (06:00) or dusk (18:00), control switches to the other player and resource production triggers.

| Speed level | Time per action | Max actions per phase (12 hrs) |
|-------------|-----------------|-------------------------------|
| 0 (default) | 60 min          | 12                            |
| 1           | 30 min          | 24                            |
| 2           | 15 min          | 48                            |
| 3           | 10 min          | 72                            |
| 4           | 5 min           | 144                           |
| 5           | 1 min           | 720                           |

Speed is researched at the castle (see Castle — Research hub).

## Setup

1. A hexagonal grid map is procedurally generated (configurable board size, e.g. 10x10 or 25x25).
2. Each player starts with **one king** and **one peasant** on adjacent grass tiles:
   - Day player starts near the **bottom-left** corner.
   - Night player starts near the **top-right** corner.
3. Each player starts with **5 wood** and **2 stone**.
4. The clock starts at 06:00 (dawn). Day player goes first.

Early game priority: build a **tower** (10 stone) and move the king inside to create a **castle** (research hub).

## Resources

Six resource types:

| Resource | Source                                    | Primary use                       |
|----------|-------------------------------------------|-----------------------------------|
| Wood     | House adjacent to tree                    | Buildings, shields, bows, boats   |
| Stone    | House adjacent to mountain                | Towers, walls, church             |
| Iron     | House adj. mountain (Mining II)           | Swords, bows                      |
| Gold     | House adj. mountain (Mining III)          | Priests, queen research           |
| Food     | House adjacent to farm, fishing           | Spawning peasants, horses         |
| Faith    | Church (requires praying priest)          | Healing, arch angel summoning     |

### House production

When a house is built, all adjacent **grass tiles convert to farm tiles**. A house populated by a peasant activates production from its adjacent tiles each cycle. Each tile contributes exactly **+1** of its resource (1:1 relationship).

| Adjacent terrain | Base production | With Mining II     | With Mining III              |
|------------------|-----------------|--------------------|------------------------------|
| Farm             | +1 food         | +1 food            | +1 food                      |
| Tree             | +1 wood         | +1 wood            | +1 wood                      |
| Mountain         | +1 stone        | +1 stone, +1 iron  | +1 stone, +1 iron, +1 gold  |
| Water            | —               | —                  | —                            |
| Sand             | —               | —                  | —                            |

Each tile produces its resource **once per cycle**, even if adjacent to multiple houses.

Example — a house with a peasant and 4 of its 6 hex neighbors shown (grass has converted to farm):

```
      [Mountain]
 [Tree] [House] [Farm]
      [Farm]
```

Base production per cycle: **+1 wood, +1 stone, +2 food**.
With Mining III researched: **+1 wood, +1 stone, +1 iron, +1 gold, +2 food**.

### Fishing

A boat with a peasant produces **+1 food** per cycle if the boat is **completely surrounded by water** tiles.

### Other production

| Source                      | Produces per cycle |
|-----------------------------|--------------------|
| Church (with priest inside) | +1 faith           |

### Production cycle

Resource production triggers at phase transitions:

- **Dawn** (06:00): Day player collects from all active production.
- **Dusk** (18:00): Night player collects from all active production.

### Resource flow

```
House + Peasant ──> Wood (adj. tree), Stone (adj. mountain), Food (adj. farm)
                         │
                         v
              Wood ──> Buildings (house, church, tower)
              Iron ──> Equipment (sword, bow)

Castle ──> Research Mining II ──> mountains also produce iron
                │
                └──> Research Mining III ──> mountains also produce gold

Church + Priest ──> Faith ──> Healing (1 faith = 1 heart)
                          ──> Arch angel (100 faith + 10 praying priests)

Boat + Peasant (surrounded by water) ──> Food (fish)
```

## Landscape

The map consists of hexagonal tiles with the following terrain types. Terrain is **permanent** — except grass tiles adjacent to a newly built house, which convert to **farm** tiles.

| Terrain    | Walkable by              | Buildable | Production                      |
|------------|--------------------------|-----------|----------------------------------|
| Grass      | All land units           | Yes       | Converts to farm when house is built adjacent |
| Farm       | All land units           | No        | +1 food (when adjacent house has peasant) |
| Tree       | Bow-equipped pieces only | No        | +1 wood (when adjacent house has peasant) |
| Mountain   | —                        | No        | +1 stone/iron/gold (when adjacent house has peasant, depends on mining research) |
| Sand       | All land units           | No        | —                                |
| Water      | Boat only                | No        | —                                |
| Unexplored | Hidden (fog of war)      | —         | —                                |

Each production tile produces its resource **once per cycle**, regardless of how many houses are adjacent to it.

### Map generation

1. Base terrain is generated using weighted random selection influenced by neighboring tiles (grass clusters, water bodies).
2. Sand beaches form between water and grass.
3. Isolated single tiles are cleaned up to match their surroundings.
4. Trees are placed on 70% of remaining grass tiles.
5. Mountains are placed on 20% of remaining grass tiles.

## Pieces

### Health

Every peasant starts with **1 heart**. When a piece reaches 0 hearts, it is **destroyed**. Equipment on a destroyed piece is **lost**.

### Base stats

Every piece starts as a **peasant** with base stats. Equipment and mounts modify these stats.

| Stat    | Base (peasant) | Description                                       |
|---------|----------------|---------------------------------------------------|
| Hearts  | 1              | Hit points. At 0, the piece is destroyed          |
| Attack  | 1              | Damage dealt per hit (reduces target's hearts)    |
| Defense | 0              | Permanently absorbs damage (acts as extra hearts that can't be healed) |
| View    | 1              | Number of adjacent tile rings visible             |
| Move    | 1              | Tiles moved per action (must have clear walkable path) |

### Equipment

Equipment is crafted and given to a peasant to build up the character. Each piece of equipment modifies stats. A character can carry **at most one of each equipment type**. Equipment is **permanent** once equipped — it cannot be removed or transferred.

| Equipment | Cost           | Effect          | Notes                              |
|-----------|----------------|-----------------|------------------------------------|
| Sword     | 1 iron         | +1 attack       | Melee weapon                       |
| Shield    | 1 wood         | +1 defense      | Permanent damage absorption        |
| Bow       | 1 wood, 1 iron | +1 attack range | Ranged weapon. Enables walking on trees. Range extends to tower range when in tower |

A peasant's equipment defines what kind of unit it becomes. There are no fixed "classes" — the character is the sum of its equipment. Common configurations:

| Configuration            | Equipment              | Hearts | Attack | Defense | View | Move | Attack range |
|--------------------------|------------------------|--------|--------|---------|------|------|--------------|
| Peasant (base)           | —                      | 1      | 1      | 0       | 1    | 1    | 1            |
| Swordsman                | Sword                  | 1      | 2      | 0       | 1    | 1    | 1            |
| Defender                 | Shield                 | 1      | 1      | 1       | 1    | 1    | 1            |
| Soldier                  | Sword + Shield         | 1      | 2      | 1       | 1    | 1    | 1            |
| Archer                   | Bow                    | 1      | 1      | 0       | 1    | 1    | 2            |
| Armed archer             | Bow + Sword            | 1      | 2      | 0       | 1    | 1    | 2            |
| Knight (soldier + horse) | Sword + Shield + Horse | 1      | 2      | 1       | 2    | 2    | 1            |
| Mounted archer           | Bow + Horse            | 1      | 1      | 0       | 2    | 2    | 3            |

A bow-equipped piece in a **tower** gets attack range equal to the tower's view range (**4**).

The **character editor interface** opens when selecting a piece, allowing the player to equip items.

### Steeds

Steeds are mounts that combine with a piece. Mounting grants **+1 view range** and **+1 move range**. For bow-equipped pieces, mounting also grants **+1 attack range**. Steeds are produced **on demand** and placed on a tile. A piece **walks onto the steed's tile** to mount it.

| Steed | Source | Cost    | Effect                                                    |
|-------|--------|---------|-----------------------------------------------------------|
| Horse | House  | 10 food | Land mount. +1 view, +1 move (+1 bow range). Placed on adjacent tile |
| Boat  | House (adjacent to water) | 10 wood | Water mount. +1 view, +1 move (+1 bow range). Placed on adjacent water tile. Enables water travel |

A piece on a boat can move across water tiles. When the piece disembarks onto land, the boat remains on the water tile.

A boat with a peasant that is **completely surrounded by water** produces +1 food per cycle (fishing).

Any piece can mount a steed **except the arch angel**. Steed bonuses stack with equipment.

### Movement

Pieces move up to their **move range** tiles per action. A mounted piece (move range 2) can move up to 2 tiles but must have a **clear walkable path** — it cannot pass through occupied tiles.

### Special units

These units are not built through equipment. They are produced from specific buildings. Special units have their own stats independent of peasant base stats.

| Piece      | How to obtain                                | Hearts | View | Move | Attack | Defense | Special                                  |
|------------|----------------------------------------------|--------|------|------|--------|---------|------------------------------------------|
| Priest     | Produced from church. Costs 1 gold           | 3      | 1    | 1    | 0      | 0       | Heals 1 heart for 1 faith. Prays in church |
| King       | Starting piece (one per player)              | 3      | 2    | 1    | 1      | 1       | Enters tower to create castle. Death = defeat |
| Arch angel | Summoned (100 faith + 10 praying priests)    | 3      | 3    | 3    | 3      | 3       | Most powerful piece in the game. Cannot mount steeds |

### Priest

A priest can:
- **Move** around the map like any unit.
- **Heal** an adjacent friendly piece: costs **1 faith**, restores **1 heart**. This slows arch angel progress since faith is consumed.
- **Pray** in a church: a priest stationed inside a church generates +1 faith per cycle. Only praying priests count toward the arch angel summon requirement.
- **Mount** a horse or boat (steed bonuses apply).

A priest cannot carry equipment.

### Arch angel

When a player has **10 priests praying in churches** and **100 faith**, the player can **summon an arch angel**. The summoning costs **100 faith**. The arch angel appears at a **church of the player's choice**. The 10 priests **remain** after summoning — they can summon additional arch angels as long as 10 priests remain praying and 100 faith is available.

### Unit creation

- **Peasant**: Spawned on a house tile you own (house must not already contain a piece). Costs **1 food**.
- **Priest**: Produced from a church you own. Costs **1 gold**.
- **King**: Starting piece. One per player. Cannot be trained or replaced — if the king dies, the player loses.
- **Arch angel**: Requires 10 priests praying in 10 churches + 100 faith. Summoned at a church of your choice.

### Upgrade tree

```
House ──(1 food)──> Peasant (1 heart, 1 attack) ──> equip with sword, shield, bow
                                  │                   mount horse or boat
                                  │
                                  ├──(+ sword [1 iron])──────────────> +1 attack
                                  ├──(+ shield [1 wood])─────────────> +1 defense
                                  ├──(+ bow [1 wood + 1 iron])──────> +1 attack range
                                  ├──(+ horse [10 food])────────────> +1 view, +1 move
                                  └──(+ boat [10 wood])─────────────> +1 view, +1 move, water travel

Church ──(1 gold)──> Priest ──pray──> Faith ──> Heal (1 faith = 1 heart)
                                            ──> 10 praying priests + 100 faith = Arch angel

King (starting piece) ──enters tower──> Castle (king locked inside)
Castle ──> Research tree (speed, mining, queen)
```

## Buildings

| Building | Cost       | View range | Defense | Walkable   | Purpose                                                                  |
|----------|------------|------------|---------|------------|--------------------------------------------------------------------------|
| House    | 1 wood     | 1          | 1       | Yes        | Spawns peasants. Produces resources from adjacent terrain. Buy horses and boats |
| Tower    | 10 stone   | 4          | 1       | Yes        | Extended vision. Bow-equipped pieces get tower range (4)                 |
| Castle   | King enters tower | 3   | 1       | Yes        | Created when king enters a tower. King stays inside. Research hub        |
| Wall     | 1 stone    | 0          | 1       | Owner only | Blocks enemy movement                                                    |
| Church   | 3 wood, 3 stone | 1    | 1       | Yes        | Priests pray here for +1 faith per cycle. Produces priests (1 gold each) |

Buildings have **1 defense** and **no hearts**. An attacker needs **attack > 1** to destroy a building.

### Building rules

- Buildings can only be placed on **grass** tiles.
- The target tile must be **adjacent to one of your units**.
- A tile can hold at most one building.
- All buildings except walls are walkable (units can stand on the tile).
- Walls block movement for the opponent but the building player can move through them.
- Buildings can be **attacked and destroyed** by enemy units. Requires attack > 1 (building defense).
- A **castle** is created when a king enters a tower. The king is locked inside and cannot leave. If the castle is destroyed, the king inside dies (game over).
- Since the king is a starting piece that cannot be replaced, there is at most **one castle per player**.

### Castle — Research hub

A castle is created when a **king enters a tower** — the tower transforms into a castle with the king locked inside. Clicking the castle opens the **research panel**. Research upgrades are global and **permanent** — they persist even if the castle is destroyed. Each research costs resources and takes one action.

| Research       | Cost             | Levels | Effect                                                        |
|----------------|------------------|--------|---------------------------------------------------------------|
| Speed          | 1 wood per level | 5      | Reduces time per action (60 → 30 → 15 → 10 → 5 → 1 min)    |
| Mining II      | 1 stone          | 1      | Houses adjacent to mountains also produce **+1 iron** per cycle |
| Mining III     | 1 iron           | 1      | Houses adjacent to mountains also produce **+1 gold** per cycle |
| Queen          | 25 gold          | 1      | Unlocks kingdom vision buff (all tiles adjacent to your buildings become visible) |

Research order requirements:
- Mining: Mining II before Mining III.
- Speed: each level can be researched sequentially (1 → 2 → 3 → 4 → 5).

### Building flow

```
Food (from house adj. farm, fishing)
 ├──> Peasant (1 food)
 └──> Horse (10 food)

Wood (from house adj. tree)
 ├──> House (1 wood)
 ├──> Church (3 wood + 3 stone)
 ├──> Shield (1 wood)
 ├──> Bow (1 wood + 1 iron)
 └──> Boat (10 wood)

Stone (from house adj. mountain)
 ├──> Tower (10 stone) ──> king enters to form castle
 ├──> Wall (1 stone)
 ├──> Church (3 wood + 3 stone)
 └──> Castle research: Mining II (1 stone) ──> unlocks iron

Iron (from house adj. mountain, after Mining II)
 ├──> Sword (1 iron)
 ├──> Bow (1 wood + 1 iron)
 └──> Castle research: Mining III (1 iron) ──> unlocks gold

Gold (from house adj. mountain, after Mining III)
 ├──> Priest (1 gold)
 └──> Castle research: Queen (25 gold) ──> kingdom vision buff

Faith (from church with praying priest)
 ├──> Heal (1 faith = 1 heart)
 └──> Arch angel (100 faith + 10 praying priests)
```

## Actions

Each action advances the clock based on the player's speed level. A player can only act during their phase.

| Action            | Costs action | Description                                              |
|-------------------|--------------|----------------------------------------------------------|
| Move              | Yes          | Move a unit up to its move range along a clear path      |
| Build             | Yes          | Place a building on an adjacent grass tile               |
| Spawn peasant     | Yes          | Spawn a peasant on your house tile, if unoccupied (costs 1 food) |
| Craft equipment   | Yes          | Craft and immediately equip a sword, shield, or bow onto a specific piece |
| Buy horse         | Yes          | Purchase a horse from house, placed on adjacent tile (costs 10 food) |
| Buy boat          | Yes          | Purchase a boat from house adj. to water, placed on water tile (costs 10 wood) |
| Train priest      | Yes          | Produce a priest from your church (costs 1 gold)         |
| Heal              | Yes          | Priest heals adjacent piece 1 heart (costs 1 faith)      |
| Research          | Yes          | Perform a research upgrade at your castle                |
| Enter tower       | Yes          | King enters a tower, transforming it into a castle        |
| Summon arch angel | Yes          | Summon arch angel (100 faith + 10 praying priests)       |
| Attack            | Yes          | Attack an enemy piece or building within range           |

## Combat

Combat uses **attack**, **defense**, and **hearts**:

- Peasants start with **1 heart**. Special units have their own heart values.
- An attacker deals damage equal to its **attack** stat.
- **Defense** permanently absorbs hits (like armor). Defense acts as extra hearts that **cannot be healed**.
- Damage is applied to defense first, then hearts: total HP = hearts + defense.
- When hearts reach 0, the piece is **destroyed** and all equipment is **lost**.
- A priest can heal **1 heart** for **1 faith** (defense cannot be healed).
- Melee units have an attack range of 1 (adjacent tiles only).
- Units with a bow have an attack range of 2. Mounted bow = range 3. Bow in tower = range 4.
- Buildings have **1 defense, 0 hearts**. Requires attack > 1 to destroy.

### Combat examples

| Attacker         | Attack | Target              | Defense | Hearts | Damage dealt              | Result                     |
|------------------|--------|---------------------|---------|--------|---------------------------|----------------------------|
| Peasant          | 1      | Peasant             | 0       | 1/1    | 1 to hearts               | Destroyed                  |
| Peasant          | 1      | Defender (shield)   | 1       | 1/1    | 1 to defense              | Defense now 0, hearts 1/1  |
| Swordsman        | 2      | Defender (shield)   | 1       | 1/1    | 1 to defense, 1 to hearts | Destroyed                  |
| Swordsman        | 2      | Soldier (sword+shield) | 1    | 1/1    | 1 to defense, 1 to hearts | Destroyed                  |
| Arch angel       | 3      | King                | 1       | 3/3    | 1 to defense, 2 to hearts | King at 1/3, no defense    |
| Peasant          | 1      | House               | 1       | —      | Absorbed                  | House survives             |
| Swordsman        | 2      | House               | 1       | —      | Exceeds def               | House destroyed            |
| Arch angel       | 3      | Castle              | 1       | —      | Exceeds def               | Castle destroyed, king dies |

## Vision (Fog of War)

Each player can only see tiles within the **view range** of their units and buildings. All other tiles appear as "unexplored" with no information about enemy units, buildings, or terrain.

| Source     | View range |
|------------|------------|
| Peasant    | 1          |
| Priest     | 1          |
| King       | 2          |
| Arch angel | 3          |
| House      | 1          |
| Tower      | 4          |
| Castle     | 3          |
| Wall       | 0          |
| Church     | 1          |

Equipped pieces: base view + mount bonus (horse/boat: +1 view).

The opponent's resource state is also hidden.

### Queen research — Kingdom visibility

When the **queen research** is completed at the castle, **every tile adjacent to a building you own becomes visible**. This effectively illuminates the player's entire territory — the connected network of buildings and the land around them.

Without queen research:
```
. . v v v . . . . v v v .
. . v H v . . . . v H v .
. . v v v . . . . v v v .
```

With queen research:
```
. . v v v v v v v v v v .
. . v H v v v v v v H v .
. . v v v v v v v v v v .
```

Each building reveals its immediate neighbors. With queen research, all buildings contribute to a connected visible territory, turning isolated pockets of vision into a unified map awareness across your kingdom.

## Win Conditions

A player loses when:

- Their **king dies** — either killed in the field or killed when their castle is destroyed, OR
- They have **no pieces and no houses** remaining on the map.

As long as a player has at least one unit or one house (and their king is alive), they are still in the game.

The win condition is checked after every attack action.

## Themes

Games can use custom visual themes that replace the default images for all game assets. A theme provides images for:

- **Pieces**: Day/night variants for peasant, priest, king, arch angel.
- **Equipment**: Sword, shield, bow.
- **Steeds**: Horse, boat.
- **Buildings**: Day/night variants for house, tower, castle, wall, church.
- **Landscape**: Grass, tree, sand, water, mountain, unexplored.

Themes are managed by admins through the theme editor.
