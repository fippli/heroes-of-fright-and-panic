/**
 * Randomized self-play test harness.
 *
 * Uses the shared AI module to play games with weighted random moves.
 * After every action it checks a set of invariants to catch engine bugs.
 *
 * Usage:
 *   pnpm dlx tsx --tsconfig tsconfig.base.json scripts/test-play.ts [--games N] [--seed S] [--verbose]
 */

import { createGame } from "../src/shared/game/create-game.ts";
import { handleAction } from "../src/shared/game/engine.ts";
import type { Game } from "../src/shared/game/types.ts";
import type { GameAction, PlayerType } from "../src/shared/actions/index.ts";
import { PieceKind } from "../src/shared/piece/index.ts";
import type { ResourceMap } from "../src/shared/player/resource-map.ts";
import { generateAllActions, pickAction } from "../src/shared/ai/index.ts";

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

  // 3. No duplicate tiles
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
    const expectedPlayer: PlayerType = game.clock.time >= 6 && game.clock.time < 18 ? "day" : "night";
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

    const action = pickAction(actions, random);
    if (action === undefined) break;

    try {
      const { game: nextGame, result } = handleAction(state.game, action);

      if (!result.success) {
        if (verbose) {
          console.log(`  Game ${gameIndex} action #${state.actionCount}: ${action.type} REJECTED: ${result.error}`);
        }
        state.actionCount++;
        continue;
      }

      state.game = nextGame;
      state.actionCount++;

      if (verbose && state.actionCount % 100 === 0) {
        console.log(`  Game ${gameIndex}: ${state.actionCount} actions...`);
      }

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

const stats = { dayWins: 0, nightWins: 0, stalemates: 0, errors: 0, totalViolations: 0, totalActions: 0 };

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
