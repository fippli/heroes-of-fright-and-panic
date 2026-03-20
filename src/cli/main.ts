import * as readline from "node:readline";
import { handleAction } from "@shared/game/engine.ts";
import type { Game } from "@shared/game/types.ts";
import type { TilePosition } from "@shared/actions/index.ts";
import { createLocalGame } from "./create-game.ts";
import { parseCommand } from "./parse-command.ts";
import { renderBoard, renderStatus, renderTileInfo } from "./render.ts";

const HELP_TEXT = `
Commands:
  select <row>,<col>     Select a tile (sel)
  move <row>,<col>       Move selected unit (m)
  loot <row>,<col>       Loot adjacent resource (l)
  attack <row>,<col>     Attack target with selected unit (a)
  build <type> <row>,<col>  Build: house, tower, wall, church (b)
  spawn <row>,<col>      Create peasant in your house
  inspect <row>,<col>    Show tile details (i)
  status                 Show resources and clock (st)
  help                   Show this help (h)
  quit                   Exit (q)

Legend:
  Terrain:  . grass  T tree  W water  S sand  M mountain  # fog
  Units:    p peasant  K king  r priest  A arch angel
  Buildings: H house  T tower  C castle  W wall  X church
  Colors:   yellow = day  magenta = night
`;

const size = (() => {
  const arg = process.argv.at(2);
  if (arg !== undefined) {
    const parsed = Number(arg);
    if (!Number.isNaN(parsed) && parsed >= 10 && parsed <= 100) {
      return parsed;
    }
  }
  return 15;
})();

const seed = (() => {
  const seedIndex = process.argv.indexOf("--seed");
  if (seedIndex === -1) return undefined;
  return process.argv.at(seedIndex + 1);
})();

const gameState: { value: Game } = { value: createLocalGame(size, seed) as Game };

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const selectedPosition: { value: TilePosition | undefined } = { value: undefined };

const prompt = () => {
  const state = gameState.value;
  const marker = state.currentPlayer === "day" ? "\x1b[33m☀\x1b[0m" : "\x1b[35m☾\x1b[0m";
  const selLabel =
    selectedPosition.value !== undefined
      ? ` [${selectedPosition.value.row},${selectedPosition.value.column}]`
      : "";
  rl.question(`${marker} ${state.currentPlayer}${selLabel}> `, (input) => {
    handleInput(input);
  });
};

const handleInput = (input: string) => {
  const state = gameState.value;
  const parsed = parseCommand(input, state.currentPlayer, selectedPosition.value);

  switch (parsed.type) {
    case "help": {
      console.log(HELP_TEXT);
      break;
    }

    case "quit": {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
      break;
    }

    case "status": {
      console.log(renderStatus(state));
      break;
    }

    case "select": {
      const tile = state.tiles.find(
        (t) => t.row === parsed.position.row && t.column === parsed.position.column,
      );
      if (tile === undefined) {
        console.log("Invalid position.");
      } else {
        selectedPosition.value = parsed.position;
        console.log(`Selected: ${renderTileInfo(tile)}`);
      }
      break;
    }

    case "inspect": {
      const tile = state.tiles.find(
        (t) => t.row === parsed.position.row && t.column === parsed.position.column,
      );
      if (tile === undefined) {
        console.log("Invalid position.");
      } else {
        console.log(renderTileInfo(tile));
      }
      break;
    }

    case "action": {
      const { game: updatedGame, result } = handleAction(state, parsed.action as any);

      if (result.success) {
        console.log(result.message ?? "OK");
        selectedPosition.value = undefined;
        gameState.value = updatedGame;
      } else {
        console.log(`Error: ${result.error}`);
      }

      console.log("\n" + renderBoard(gameState.value, selectedPosition.value));
      console.log(renderStatus(gameState.value));
      break;
    }

    case "error": {
      console.log(parsed.message);
      break;
    }
  }

  prompt();
};

console.log("Heroes of Fright and Panic — CLI");
console.log(`Map size: ${size}x${size} | Seed: ${seed ?? "random"}`);
console.log('Type "help" for commands.\n');
console.log(renderBoard(gameState.value, selectedPosition.value));
console.log(renderStatus(gameState.value));
console.log("");
prompt();
