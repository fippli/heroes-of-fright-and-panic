import { readGameFile, writeGameFile } from "../src/cli/game-file.ts";
import { handleAction } from "../src/shared/game/engine.ts";
import type { GameAction } from "../src/shared/actions/index.ts";
import type { Game } from "../src/shared/game/types.ts";

const FILE_PATH = "games/claude-game.json";

const printBoard = (game: Game): void => {
  const lines = Array.from({ length: game.size }, (_, row) => {
    const cols = Array.from({ length: game.size }, (_unused, col) => {
      const tile = game.tiles.find(
        (t) => t.row === row && t.column === col,
      );
      if (tile === undefined) return "?";
      if (tile.piece !== null) {
        const sym: Record<string, string> = {
          peasant: "p",
          king: "K",
          priest: "r",
          archAngel: "A",
        };
        const ch = sym[tile.piece.kind] ?? "?";
        return tile.piece.owner === "day" ? ch.toUpperCase() : ch.toLowerCase();
      }
      if (tile.building !== null) {
        const sym: Record<string, string> = {
          house: "H",
          tower: "T",
          wall: "W",
          church: "R",
          castle: "C",
        };
        const ch = sym[tile.building.type] ?? "?";
        return tile.building.owner === "day" ? ch.toUpperCase() : ch.toLowerCase();
      }
      const landscape: Record<string, string> = {
        grass: ".",
        tree: "T",
        mountain: "M",
        water: "~",
        sand: "S",
        farm: "F",
      };
      return landscape[tile.landscape?.type ?? ""] ?? "?";
    });
    return `${String(row).padStart(2)} ${cols.join("")}`;
  });
  console.log(lines.join("\n"));
  console.log(`   ${Array.from({ length: game.size }, (_, i) => i % 10).join("")}`);
  console.log(
    `Clock: ${game.clock.time} | Turn: ${game.currentPlayer} | Day: W${game.dayPlayer.resources.wood} S${game.dayPlayer.resources.stone} I${game.dayPlayer.resources.iron} G${game.dayPlayer.resources.gold} Fd${game.dayPlayer.resources.food} Fa${game.dayPlayer.resources.faith} | Night: W${game.nightPlayer.resources.wood} S${game.nightPlayer.resources.stone} I${game.nightPlayer.resources.iron} G${game.nightPlayer.resources.gold} Fd${game.nightPlayer.resources.food} Fa${game.nightPlayer.resources.faith}`,
  );
  if (game.gameOver) {
    console.log(`GAME OVER - Winner: ${game.winner}`);
  }
  console.log("");
};

const doAction = (
  game: Game,
  action: GameAction,
): Game => {
  const { game: updated, result } = handleAction(game, action);
  if (result.success) {
    console.log(`  ${action.player}: ${action.type} => ${result.message}`);
  } else {
    console.log(`  ${action.player}: ${action.type} => FAILED: ${result.error}`);
  }
  return updated;
};

const run = async (): Promise<void> => {
  const initial = await readGameFile(FILE_PATH);
  console.log("=== Initial State ===");
  printBoard(initial);

  // Play the game!
  const actions: GameAction[] = [
    // === DAY PHASE (clock 6-18) ===
    // Day: Move peasant from (5,0) toward grass at (4,1)
    { type: "move", player: "day", from: { row: 5, column: 0 }, to: { row: 4, column: 1 } },
    // Day: Build house at (4,1) - wait, peasant is there. Build adjacent.
    // Neighbors of peasant at (4,1) even row: NE(3,1)=mountain, E(4,2)=sand, SE(5,1)=sand, SW(5,0)=tree, W(4,0)=tree, NW(3,0)=tree
    // No grass neighbors... Let me move peasant to (1,1) which is grass and has grass neighbors
    // Actually let me move toward (0,0) grass area. Path: (4,1) -> (3,0)tree -> (2,0)tree -> (1,1)grass -> (0,0)grass
    // Each move is 1 action = 1 hour
    { type: "move", player: "day", from: { row: 4, column: 1 }, to: { row: 3, column: 0 } },
    { type: "move", player: "day", from: { row: 3, column: 0 }, to: { row: 2, column: 0 } },
    { type: "move", player: "day", from: { row: 2, column: 0 }, to: { row: 1, column: 0 } },
    { type: "move", player: "day", from: { row: 1, column: 0 }, to: { row: 1, column: 1 } },
    // Peasant at (1,1) grass. Neighbors even row: NE(0,1)=tree, E(1,2)=tree, SE(2,1)=mountain, SW(2,0)=tree, W(1,0)=tree, NW(0,0)=grass
    // Build house at (1,1)? Need unit adjacent. Peasant IS on (1,1), build needs adjacent unit.
    // Can build on (0,0) grass - neighbor of (1,1)? NW of (1,1) odd row: (0,1)=tree. Hmm.
    // Let me recalculate. (1,1) is odd row. Neighbors: E(1,2), W(1,0), NE(0,2), NW(0,1), SE(2,2), SW(2,1)
    // (0,2)=grass! Build house there!
    { type: "build", player: "day", buildingType: "house" as const, position: { row: 0, column: 2 } },
    // Now move king up too - King at (6,0) even row. NE: (5,0)tree
    { type: "move", player: "day", from: { row: 6, column: 0 }, to: { row: 5, column: 0 } },
    { type: "move", player: "day", from: { row: 5, column: 0 }, to: { row: 4, column: 0 } },
    { type: "move", player: "day", from: { row: 4, column: 0 }, to: { row: 3, column: 0 } },
    // Build another house
    { type: "build", player: "day", buildingType: "house" as const, position: { row: 0, column: 3 } },
    // Day still has some actions left, let's keep building
    { type: "move", player: "day", from: { row: 3, column: 0 }, to: { row: 2, column: 0 } },
    { type: "move", player: "day", from: { row: 2, column: 0 }, to: { row: 1, column: 0 } },

    // === NIGHT PHASE (clock 18-6) ===
    // Night peasant at (0,13) tree, king at (0,14) grass
    // Night: Move peasant toward grass. Neighbors of (0,13) even row: E(0,14)=king, W(0,12)=grass, NE(-1,13)=invalid, SE(1,13)=tree, SW(1,12)=grass
    { type: "move", player: "night", from: { row: 0, column: 13 }, to: { row: 0, column: 12 } },
    // Build house at (0,12) - peasant is there. Need adjacent grass.
    // Neighbors of (0,12) even row: E(0,13)=tree, W(0,11)=tree, NE(-1,12)=invalid, NW(-1,11)=invalid, SE(1,12)=grass, SW(1,11)=tree
    // (1,12) is grass! Build house there.
    { type: "build", player: "night", buildingType: "house" as const, position: { row: 1, column: 12 } },
    // Move peasant to gather more. Move to (1,12) area
    { type: "move", player: "night", from: { row: 0, column: 12 }, to: { row: 1, column: 12 } },
    // Neighbors of (1,12) odd row: E(1,13)tree, W(1,11)tree, NE(0,13)tree, NW(0,12)grass, SE(2,13)sand, SW(2,12)sand
    // Build house on (0,12) now - adjacent to peasant at (1,12)? (1,12) odd row NW = (0,12). Yes!
    // Wait (0,12) is grass, let me build there
    // Actually, let me check: is (0,12) grass? Looking at map: row 0 col 12 = grass. Yes!
    { type: "build", player: "night", buildingType: "house" as const, position: { row: 0, column: 12 } },
    // Move king to help build
    { type: "move", player: "night", from: { row: 0, column: 14 }, to: { row: 0, column: 13 } },
    { type: "move", player: "night", from: { row: 0, column: 13 }, to: { row: 1, column: 13 } },
    // Night: Build more houses. (1,13) odd row neighbors: E(1,14)tree, NE(0,14)grass, SE(2,14)sand...
    // (0,14) is grass - build house!
    { type: "build", player: "night", buildingType: "house" as const, position: { row: 0, column: 14 } },
    // More moves and builds
    { type: "move", player: "night", from: { row: 1, column: 13 }, to: { row: 1, column: 12 } },
    // Oops, peasant is there. Let's move king elsewhere
    // Actually let me move king to different spot
    // (1,13) odd row: SE(2,14)sand, SW(2,13)sand, E(1,14)tree
    { type: "move", player: "night", from: { row: 1, column: 12 }, to: { row: 0, column: 12 } },
    // Wait, there's a house at (0,12). Can walk on house if own.
    { type: "move", player: "night", from: { row: 0, column: 12 }, to: { row: 0, column: 11 } },
    { type: "move", player: "night", from: { row: 0, column: 11 }, to: { row: 0, column: 10 } },
    { type: "build", player: "night", buildingType: "house" as const, position: { row: 0, column: 9 } },
  ];

  const finalGame = actions.reduce((game, action) => {
    if (game.gameOver) return game;
    return doAction(game, action);
  }, initial);

  console.log("\n=== After Turn 1 ===");
  printBoard(finalGame);

  await writeGameFile(FILE_PATH, finalGame);
  console.log("Game saved.");
};

run();
