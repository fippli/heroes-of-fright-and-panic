/**
 * Randomized self-play test harness.
 *
 * Imports the game engine directly and plays games with randomized valid moves.
 * After every action it checks a set of invariants to catch engine bugs.
 *
 * Usage:
 *   pnpm dlx tsx --tsconfig tsconfig.base.json scripts/test-play.ts [--games N] [--seed S] [--verbose]
 */

import { createGame } from "../src/shared/game/create-game.ts";
import { handleAction, checkWinCondition } from "../src/shared/game/engine.ts";
import type { Game } from "../src/shared/game/types.ts";
import type { GameAction, PlayerType, TilePosition } from "../src/shared/actions/index.ts";
import type { Tile } from "../src/shared/map/tile.ts";
import { LandscapeType } from "../src/shared/map/landscape.ts";
import { BuildingType } from "../src/shared/building/index.ts";
import { EquipmentType } from "../src/shared/equipment/index.ts";
import { ResearchType, canResearch } from "../src/shared/research/index.ts";
import { SteedType } from "../src/shared/steed/index.ts";
import { PieceKind, getWalkableLandscape, getPieceAttackRange, pieceHasEquipment } from "../src/shared/piece/index.ts";
import { canAfford, type ResourceMap } from "../src/shared/player/resource-map.ts";
import { buildingCostOf } from "../src/shared/building/index.ts";
import { createEquipment } from "../src/shared/equipment/index.ts";
import { createSteed } from "../src/shared/steed/index.ts";
import { researchCostOf } from "../src/shared/research/index.ts";
import * as hex from "../src/shared/map/hex.ts";

// ============================================
// CLI ARGS
// ============================================

const args = process.argv.slice(2);
const gamesIndex = args.indexOf("--games");
const seedIndex = args.indexOf("--seed");
const verbose = args.includes("--verbose");
const totalGames = gamesIndex !== -1 ? Number(args.at(gamesIndex + 1) ?? 100) : 100;
const baseSeed = seedIndex !== -1 ? (args.at(seedIndex + 1) ?? "test") : "test";

// ============================================
// SIMPLE RNG (seeded)
// ============================================

const createSeededRandom = (seed: string): (() => number) => {
  const state = { value: Array.from(seed).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) };
  return () => {
    state.value = (state.value * 1664525 + 1013904223) | 0;
    return (state.value >>> 0) / 4294967296;
  };
};

const pickRandom = <T>(items: ReadonlyArray<T>, random: () => number): T | undefined =>
  items.at(Math.floor(random() * items.length));

// ============================================
// HELPERS
// ============================================

const getPlayer = (game: Game, playerType: PlayerType) =>
  playerType === "day" ? game.dayPlayer : game.nightPlayer;

const findNeighbors = (position: TilePosition, tiles: ReadonlyArray<Tile>): ReadonlyArray<Tile> =>
  hex.findNeighbors(position, tiles as Tile[]);

const findTile = (tiles: ReadonlyArray<Tile>, position: TilePosition): Tile | undefined =>
  tiles.find((tile) => tile.row === position.row && tile.column === position.column);

// ============================================
// ACTION GENERATORS
// ============================================

const generateMoveActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const myPieces = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.owner === player,
  );

  return myPieces.flatMap((fromTile) => {
    const piece = fromTile.piece!;
    const walkable = getWalkableLandscape(piece);
    const neighbors = findNeighbors(fromTile, game.tiles);

    return neighbors
      .filter((neighbor) => {
        if (neighbor.piece !== null) return false;
        if (neighbor.landscape === null) return false;
        if (!walkable.includes(neighbor.landscape.type)) return false;
        if (neighbor.building !== null && neighbor.building.owner !== player && !neighbor.building.walkableByEnemy) return false;
        return true;
      })
      .map((neighbor): GameAction => ({
        type: "move",
        player,
        from: { row: fromTile.row, column: fromTile.column },
        to: { row: neighbor.row, column: neighbor.column },
      }));
  });
};

const generateBuildActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const buildableTypes = [BuildingType.house, BuildingType.tower, BuildingType.wall, BuildingType.church]
    .filter((buildingType) => canAfford(playerData.resources, buildingCostOf(buildingType)));

  if (buildableTypes.length === 0) return [];

  const myPiecePositions = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.owner === player,
  );

  const grassNeighbors = myPiecePositions.flatMap((pieceTile) =>
    findNeighbors(pieceTile, game.tiles).filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.grass &&
        neighbor.building === null,
    ),
  );

  // Deduplicate positions
  const seen = new Set<string>();
  const uniqueGrass = grassNeighbors.filter((tile) => {
    const key = `${tile.row},${tile.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueGrass.flatMap((grassTile) =>
    buildableTypes.map((buildingType): GameAction => ({
      type: "build",
      player,
      buildingType,
      position: { row: grassTile.row, column: grassTile.column },
    })),
  );
};

const generateSpawnActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 0, food: 1, faith: 0 })) return [];

  return game.tiles
    .filter(
      (tile) =>
        tile.building !== null &&
        tile.building.type === BuildingType.house &&
        tile.building.owner === player &&
        tile.piece === null,
    )
    .map((tile): GameAction => ({
      type: "spawnPeasant",
      player,
      position: { row: tile.row, column: tile.column },
    }));
};

const generateCraftActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const myEquippable = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.owner === player &&
      tile.piece.canEquip,
  );

  return myEquippable.flatMap((tile) => {
    const piece = tile.piece!;
    return [EquipmentType.sword, EquipmentType.shield, EquipmentType.bow]
      .filter((equipType) => {
        if (pieceHasEquipment(piece, equipType)) return false;
        const equip = createEquipment(equipType);
        return canAfford(playerData.resources, equip.cost);
      })
      .map((equipmentType): GameAction => ({
        type: "craftEquipment",
        player,
        equipmentType,
        piecePosition: { row: tile.row, column: tile.column },
      }));
  });
};

const generateAttackActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const myPieces = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.owner === player &&
      tile.piece.baseAttack > 0,
  );

  return myPieces.flatMap((attackerTile) => {
    const piece = attackerTile.piece!;
    const attackRange = (() => {
      if (
        attackerTile.building !== null &&
        attackerTile.building.type === BuildingType.tower &&
        pieceHasEquipment(piece, EquipmentType.bow)
      ) {
        return attackerTile.building.viewRange;
      }
      return getPieceAttackRange(piece);
    })();

    // Find all tiles in range with enemy pieces or buildings
    const tilesInRange = getTilesInRange(game.tiles, attackerTile, attackRange);

    return tilesInRange
      .map((pos) => findTile(game.tiles, pos))
      .filter((tile): tile is Tile => tile !== undefined)
      .filter((tile) => {
        const hasEnemyPiece = tile.piece !== null && tile.piece.owner !== player;
        const hasEnemyBuilding = tile.building !== null && tile.building.owner !== player;
        return hasEnemyPiece || hasEnemyBuilding;
      })
      .map((targetTile): GameAction => ({
        type: "attack",
        player,
        attackerPosition: { row: attackerTile.row, column: attackerTile.column },
        targetPosition: { row: targetTile.row, column: targetTile.column },
      }));
  });
};

const generateTrainActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 1, food: 0, faith: 0 })) return [];

  return game.tiles
    .filter(
      (tile) =>
        tile.building !== null &&
        tile.building.type === BuildingType.church &&
        tile.building.owner === player &&
        tile.piece === null,
    )
    .map((tile): GameAction => ({
      type: "trainPriest",
      player,
      churchPosition: { row: tile.row, column: tile.column },
    }));
};

const generateHealActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  if (!canAfford(playerData.resources, { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, faith: 1 })) return [];

  const priests = game.tiles.filter(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.priest &&
      tile.piece.owner === player,
  );

  return priests.flatMap((priestTile) =>
    findNeighbors(priestTile, game.tiles)
      .filter(
        (neighbor) =>
          neighbor.piece !== null &&
          neighbor.piece.owner === player &&
          neighbor.piece.hearts < neighbor.piece.maxHearts,
      )
      .map((targetTile): GameAction => ({
        type: "heal",
        player,
        priestPosition: { row: priestTile.row, column: priestTile.column },
        targetPosition: { row: targetTile.row, column: targetTile.column },
      })),
  );
};

const generateResearchActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const castles = game.tiles.filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.castle &&
      tile.building.owner === player,
  );

  if (castles.length === 0) return [];

  const researchable = [ResearchType.speed, ResearchType.miningII, ResearchType.miningIII, ResearchType.queen]
    .filter((researchType) =>
      canResearch(playerData.research, researchType) &&
      canAfford(playerData.resources, researchCostOf(researchType)),
    );

  return castles.flatMap((castle) =>
    researchable.map((researchType): GameAction => ({
      type: "research",
      player,
      researchType,
      castlePosition: { row: castle.row, column: castle.column },
    })),
  );
};

const generateEnterTowerActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const kingTile = game.tiles.find(
    (tile) =>
      tile.piece !== null &&
      tile.piece.kind === PieceKind.king &&
      tile.piece.owner === player,
  );

  if (kingTile === undefined) return [];

  const adjacentTowers = findNeighbors(kingTile, game.tiles).filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.tower &&
      tile.building.owner === player,
  );

  return adjacentTowers.map((towerTile): GameAction => ({
    type: "enterTower",
    player,
    kingPosition: { row: kingTile.row, column: kingTile.column },
    towerPosition: { row: towerTile.row, column: towerTile.column },
  }));
};

const generateSteedActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => {
  const playerData = getPlayer(game, player);
  const houses = game.tiles.filter(
    (tile) =>
      tile.building !== null &&
      tile.building.type === BuildingType.house &&
      tile.building.owner === player,
  );

  if (houses.length === 0) return [];

  const affordableSteeds = [SteedType.horse, SteedType.boat].filter((steedType) =>
    canAfford(playerData.resources, createSteed(steedType).cost),
  );

  if (affordableSteeds.length === 0) return [];

  return houses.flatMap((houseTile) =>
    findNeighbors(houseTile, game.tiles)
      .filter((neighbor) => neighbor.piece === null)
      .flatMap((neighbor) =>
        affordableSteeds
          .filter((steedType) => {
            if (steedType === SteedType.boat) {
              return neighbor.landscape?.type === LandscapeType.water;
            }
            return true;
          })
          .map((steedType): GameAction => ({
            type: "buySteed",
            player,
            steedType,
            housePosition: { row: houseTile.row, column: houseTile.column },
            targetPosition: { row: neighbor.row, column: neighbor.column },
          })),
      ),
  );
};

const generateAllActions = (game: Game, player: PlayerType): ReadonlyArray<GameAction> => [
  ...generateMoveActions(game, player),
  ...generateBuildActions(game, player),
  ...generateSpawnActions(game, player),
  ...generateCraftActions(game, player),
  ...generateAttackActions(game, player),
  ...generateTrainActions(game, player),
  ...generateHealActions(game, player),
  ...generateResearchActions(game, player),
  ...generateEnterTowerActions(game, player),
  ...generateSteedActions(game, player),
];

// ============================================
// TILES IN RANGE (simplified BFS)
// ============================================

const getTilesInRange = (
  tiles: ReadonlyArray<Tile>,
  center: TilePosition,
  range: number,
): ReadonlyArray<TilePosition> => {
  const visited = new Set<string>();
  visited.add(`${center.row},${center.column}`);
  const result: TilePosition[] = [center];
  const frontier: TilePosition[] = [center];

  Array.from({ length: range }, () => {
    const nextFrontier: TilePosition[] = [];
    frontier.splice(0).forEach((pos) => {
      findNeighbors(pos, tiles).forEach((neighbor) => {
        const key = `${neighbor.row},${neighbor.column}`;
        if (!visited.has(key)) {
          visited.add(key);
          result.push({ row: neighbor.row, column: neighbor.column });
          nextFrontier.push({ row: neighbor.row, column: neighbor.column });
        }
      });
    });
    frontier.push(...nextFrontier);
  });

  return result;
};

// ============================================
// INVARIANT CHECKS
// ============================================

type InvariantViolation = {
  readonly invariant: string;
  readonly detail: string;
};

const checkInvariants = (
  game: Game,
  actionIndex: number,
  action: GameAction,
): ReadonlyArray<InvariantViolation> => {
  const violations: InvariantViolation[] = [];

  const checkResources = (resources: ResourceMap, label: string): void => {
    const entries: ReadonlyArray<[string, number]> = [
      ["wood", resources.wood],
      ["stone", resources.stone],
      ["iron", resources.iron],
      ["gold", resources.gold],
      ["food", resources.food],
      ["faith", resources.faith],
    ];
    entries.forEach(([name, value]) => {
      if (value < 0) {
        violations.push({
          invariant: "no-negative-resources",
          detail: `${label} ${name} is ${value} after action #${actionIndex} (${action.type})`,
        });
      }
    });
  };

  // 1. No negative resources
  checkResources(game.dayPlayer.resources, "day");
  checkResources(game.nightPlayer.resources, "night");

  // 2. No dead pieces on the board
  game.tiles.forEach((tile) => {
    if (tile.piece !== null && tile.piece.hearts <= 0) {
      violations.push({
        invariant: "no-dead-pieces",
        detail: `Dead ${tile.piece.kind} at (${tile.row},${tile.column}) hearts=${tile.piece.hearts} after action #${actionIndex}`,
      });
    }
  });

  // 3. No two pieces on the same tile (tiles array integrity)
  const tileKeys = new Set<string>();
  game.tiles.forEach((tile) => {
    const key = `${tile.row},${tile.column}`;
    if (tileKeys.has(key)) {
      violations.push({
        invariant: "no-duplicate-tiles",
        detail: `Duplicate tile at (${tile.row},${tile.column}) after action #${actionIndex}`,
      });
    }
    tileKeys.add(key);
  });

  // 4. gameOver consistency
  const dayKingAlive = game.tiles.some(
    (tile) => tile.piece !== null && tile.piece.kind === PieceKind.king && tile.piece.owner === "day",
  );
  const nightKingAlive = game.tiles.some(
    (tile) => tile.piece !== null && tile.piece.kind === PieceKind.king && tile.piece.owner === "night",
  );

  if (!dayKingAlive && !game.gameOver) {
    violations.push({
      invariant: "game-over-on-king-death",
      detail: `Day king is dead but gameOver is false after action #${actionIndex}`,
    });
  }
  if (!nightKingAlive && !game.gameOver) {
    violations.push({
      invariant: "game-over-on-king-death",
      detail: `Night king is dead but gameOver is false after action #${actionIndex}`,
    });
  }

  // 5. Clock range
  if (game.clock.time < 0 || game.clock.time >= 24) {
    violations.push({
      invariant: "clock-in-range",
      detail: `Clock is ${game.clock.time} after action #${actionIndex}`,
    });
  }

  // 6. currentPlayer matches clock phase (unless game over)
  if (!game.gameOver) {
    const expectedPlayer = game.clock.time >= 6 && game.clock.time < 18 ? "day" : "night";
    if (game.currentPlayer !== expectedPlayer) {
      violations.push({
        invariant: "player-matches-phase",
        detail: `Clock is ${game.clock.time} (${expectedPlayer} phase) but currentPlayer is ${game.currentPlayer} after action #${actionIndex}`,
      });
    }
  }

  // 7. Tile count unchanged
  const expectedTileCount = game.size * game.size;
  if (game.tiles.length !== expectedTileCount) {
    violations.push({
      invariant: "tile-count-unchanged",
      detail: `Expected ${expectedTileCount} tiles, got ${game.tiles.length} after action #${actionIndex}`,
    });
  }

  // 8. At most one king per player
  const dayKings = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.kind === PieceKind.king && tile.piece.owner === "day",
  );
  const nightKings = game.tiles.filter(
    (tile) => tile.piece !== null && tile.piece.kind === PieceKind.king && tile.piece.owner === "night",
  );
  if (dayKings.length > 1) {
    violations.push({
      invariant: "max-one-king",
      detail: `Day has ${dayKings.length} kings after action #${actionIndex}`,
    });
  }
  if (nightKings.length > 1) {
    violations.push({
      invariant: "max-one-king",
      detail: `Night has ${nightKings.length} kings after action #${actionIndex}`,
    });
  }

  return violations;
};

// ============================================
// GAME RUNNER
// ============================================

const MAX_ACTIONS_PER_GAME = 2000;

type GameResult = {
  readonly gameIndex: number;
  readonly seed: string;
  readonly actions: number;
  readonly outcome: "day_wins" | "night_wins" | "stalemate" | "error";
  readonly violations: ReadonlyArray<InvariantViolation>;
  readonly error?: string;
};

const runGame = (gameIndex: number, seed: string): GameResult => {
  const random = createSeededRandom(seed);
  const initial = {
    id: "test",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...createGame({
      boardSize: 10,
      name: "Test",
      alliance: "day",
      creatorEmail: "test@test",
      inviteEmail: null,
      seed,
    }),
  } as Game;

  const allViolations: InvariantViolation[] = [];
  const state = { game: initial, actionCount: 0 };

  // eslint-disable-next-line no-constant-condition
  while (state.actionCount < MAX_ACTIONS_PER_GAME) {
    if (state.game.gameOver) break;

    const currentPlayer = state.game.currentPlayer;
    const actions = generateAllActions(state.game, currentPlayer);

    if (actions.length === 0) {
      // No valid actions — stalemate
      if (verbose) {
        console.log(`  Game ${gameIndex}: no valid actions for ${currentPlayer} at action #${state.actionCount}`);
      }
      return {
        gameIndex,
        seed,
        actions: state.actionCount,
        outcome: "stalemate",
        violations: allViolations,
      };
    }

    const action = pickRandom(actions, random);
    if (action === undefined) break;

    try {
      const { game: nextGame, result } = handleAction(state.game, action);

      if (!result.success) {
        // Generated action was rejected — this is a bug in our generator
        if (verbose) {
          console.log(`  Game ${gameIndex} action #${state.actionCount}: ${action.type} REJECTED: ${result.error}`);
        }
        // Skip and try another action (generator imperfection, not engine bug)
        state.actionCount++;
        continue;
      }

      state.game = nextGame;
      state.actionCount++;

      if (verbose && state.actionCount % 100 === 0) {
        console.log(`  Game ${gameIndex}: ${state.actionCount} actions...`);
      }

      // Check invariants after every successful action
      const violations = checkInvariants(state.game, state.actionCount, action);
      violations.forEach((violation) => {
        allViolations.push(violation);
        console.error(`  VIOLATION in game ${gameIndex}: [${violation.invariant}] ${violation.detail}`);
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  CRASH in game ${gameIndex} action #${state.actionCount}: ${action.type} — ${message}`);
      if (error instanceof Error && error.stack !== undefined) {
        console.error(error.stack);
      }
      return {
        gameIndex,
        seed,
        actions: state.actionCount,
        outcome: "error",
        violations: allViolations,
        error: `${action.type}: ${message}`,
      };
    }
  }

  const outcome = (() => {
    if (state.game.gameOver) {
      return state.game.winner === "day" ? "day_wins" as const : "night_wins" as const;
    }
    return "stalemate" as const;
  })();

  return {
    gameIndex,
    seed,
    actions: state.actionCount,
    outcome,
    violations: allViolations,
  };
};

// ============================================
// MAIN
// ============================================

console.log(`Running ${totalGames} randomized games (seed base: "${baseSeed}")...\n`);

const stats = { dayWins: 0, nightWins: 0, stalemates: 0, errors: 0, totalViolations: 0, totalActions: 0, rejectedActions: 0 };

const results = Array.from({ length: totalGames }, (_, gameIndex) => {
  const seed = `${baseSeed}-${gameIndex}`;
  const result = runGame(gameIndex, seed);

  switch (result.outcome) {
    case "day_wins": stats.dayWins++; break;
    case "night_wins": stats.nightWins++; break;
    case "stalemate": stats.stalemates++; break;
    case "error": stats.errors++; break;
  }
  stats.totalViolations += result.violations.length;
  stats.totalActions += result.actions;

  if (verbose || result.violations.length > 0 || result.outcome === "error") {
    const violationSuffix = result.violations.length > 0 ? ` (${result.violations.length} violations)` : "";
    const errorSuffix = result.error !== undefined ? ` — ${result.error}` : "";
    console.log(`Game ${gameIndex} [${seed}]: ${result.outcome} in ${result.actions} actions${violationSuffix}${errorSuffix}`);
  }

  return result;
});

// Summary
console.log("\n========================================");
console.log("RESULTS");
console.log("========================================");
console.log(`Games played:     ${totalGames}`);
console.log(`Total actions:    ${stats.totalActions}`);
console.log(`Avg actions/game: ${Math.round(stats.totalActions / totalGames)}`);
console.log(`Day wins:         ${stats.dayWins}`);
console.log(`Night wins:       ${stats.nightWins}`);
console.log(`Stalemates:       ${stats.stalemates}`);
console.log(`Errors/crashes:   ${stats.errors}`);
console.log(`Violations:       ${stats.totalViolations}`);

if (stats.totalViolations > 0) {
  console.log("\nVIOLATION SUMMARY:");
  const violationCounts = new Map<string, number>();
  results.flatMap((result) => result.violations).forEach((violation) => {
    violationCounts.set(violation.invariant, (violationCounts.get(violation.invariant) ?? 0) + 1);
  });
  violationCounts.forEach((count, invariant) => {
    console.log(`  ${invariant}: ${count}`);
  });
}

if (stats.errors > 0) {
  console.log("\nERROR DETAILS:");
  results
    .filter((result) => result.outcome === "error")
    .forEach((result) => {
      console.log(`  Game ${result.gameIndex} [${result.seed}]: ${result.error}`);
    });
}

const exitCode = stats.totalViolations > 0 || stats.errors > 0 ? 1 : 0;
console.log(`\n${exitCode === 0 ? "ALL CLEAR" : "ISSUES FOUND"}`);
process.exit(exitCode);
