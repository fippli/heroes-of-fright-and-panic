import * as readline from "node:readline";
import { GameEngine } from "@shared/game/engine.ts";
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
  build <type> <row>,<col>  Build: house, farm, tower, castle (b)
  spawn <row>,<col>      Create peasant in your house
  upgrade <row>,<col> [archer]  Upgrade unit (u)
  inspect <row>,<col>    Show tile details (i)
  status                 Show resources and clock (st)
  help                   Show this help (h)
  quit                   Exit (q)

Legend:
  Terrain:  . grass  ♣ tree  ~ water  : sand  ▲ mountain  ? fog
  Units:    p peasant  s soldier  k knight  a archer
  Buildings: H house  F farm  T tower  C castle
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

const game = createLocalGame(size);
const engine = new GameEngine(game);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const selectedPosition: { value: TilePosition | undefined } = { value: undefined };

const prompt = () => {
  const state = engine.getGameState();
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
  const state = engine.getGameState();
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
      const result = (() => {
        switch (parsed.action.type) {
          case "click":
            return engine.handleClick(
              parsed.action.player,
              parsed.action.position,
              parsed.action.selectedPosition,
            );
          case "build":
            return engine.handleBuild(
              parsed.action.player,
              parsed.action.buildingType,
              parsed.action.position,
              parsed.action.selectedPosition,
            );
          case "createPeasant":
            return engine.handleCreatePeasant(
              parsed.action.player,
              parsed.action.position,
            );
          case "upgrade":
            return engine.handleUpgrade(
              parsed.action.player,
              parsed.action.position,
              parsed.action.targetType,
            );
          case "attack":
            return engine.handleAttack(
              parsed.action.player,
              parsed.action.position,
              parsed.action.selectedPosition,
            );
          default:
            return { success: false, error: "Unknown action" };
        }
      })();

      if (result.success) {
        console.log(result.message ?? "OK");
        selectedPosition.value = undefined;
      } else {
        console.log(`Error: ${result.error}`);
      }

      const updatedState = engine.getGameState();
      console.log("\n" + renderBoard(updatedState, selectedPosition.value));
      console.log(renderStatus(updatedState));
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
console.log(`Map size: ${size}x${size}`);
console.log('Type "help" for commands.\n');
console.log(renderBoard(engine.getGameState(), selectedPosition.value));
console.log(renderStatus(engine.getGameState()));
console.log("");
prompt();
