import * as readline from "node:readline";
import { handleAction } from "@shared/game/engine.ts";
import type { Game } from "@shared/game/types.ts";
import type { TilePosition, PlayerType } from "@shared/actions/index.ts";
import { readGameFile, writeGameFile } from "../game-file.ts";
import { parseCommand } from "../parse-command.ts";
import { renderBoard, renderStatus, renderTileInfo } from "../render.ts";
import { formatJsonResponse } from "../json-output.ts";

const HELP_TEXT = `
Commands:
  select <row>,<col>        Select a tile (sel)
  move <row>,<col>          Move selected unit (m)
  attack <row>,<col>        Attack target (a)
  build <type> <row>,<col>  Build: house, tower, wall, church (b)
  spawn <row>,<col>         Spawn peasant on your house
  craft <type> <row>,<col>  Craft: sword, shield, bow
  steed <type> <house> <target>  Buy: horse, boat
  train <row>,<col>         Train priest at church
  heal <priest> <target>    Priest heals adjacent piece
  research <type> <row>,<col>  Research: speed, mining2, mining3, queen
  enter <king> <tower>      King enters tower (creates castle)
  summon <row>,<col>        Summon arch angel at church
  loot <row>,<col>          Loot adjacent resource (l)
  inspect <row>,<col>       Show tile details (i)
  status                    Show resources and clock (st)
  help                      Show this help (h)
  quit                      Exit (q)
`;

const parseArgs = (
  args: ReadonlyArray<string>,
): { filePath: string; player: PlayerType; json: boolean } => {
  const filePath = args.at(0) ?? "";
  const playerIndex = args.indexOf("--player");
  const playerArg = playerIndex !== -1 ? args.at(playerIndex + 1) : undefined;
  const json = args.includes("--json");

  const player: PlayerType =
    playerArg === "day" || playerArg === "night" ? playerArg : "day";

  return { filePath, player, json };
};

export const runPlay = async (args: ReadonlyArray<string>): Promise<void> => {
  const { filePath, player, json } = parseArgs(args);

  if (filePath === "") {
    console.error("Usage: cli play <file> --player <day|night> [--json]");
    process.exit(1);
  }

  if (json) {
    await runJsonMode(filePath, player);
  } else {
    await runInteractiveMode(filePath, player);
  }
};

const runJsonMode = async (
  filePath: string,
  player: PlayerType,
): Promise<void> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const processLine = async (line: string): Promise<void> => {
    const game = await readGameFile(filePath);

    if (game.currentPlayer !== player) {
      console.log(JSON.stringify({ success: false, error: "Not your turn", currentPlayer: game.currentPlayer }));
      return;
    }

    const parsed = parseCommand(line, player, undefined);

    if (parsed.type === "error") {
      console.log(JSON.stringify({ success: false, error: parsed.message }));
      return;
    }

    if (parsed.type !== "action") {
      console.log(formatJsonResponse(game));
      return;
    }

    const { game: updatedGame, result } = handleAction(game, parsed.action);

    if (result.success) {
      await writeGameFile(filePath, updatedGame);
    }

    console.log(formatJsonResponse(updatedGame, result));
  };

  // Process lines sequentially
  const lines: string[] = [];
  rl.on("line", (line) => lines.push(line));

  await new Promise<void>((resolve) => rl.on("close", resolve));

  // Process collected lines one at a time
  const processNext = async (remaining: ReadonlyArray<string>): Promise<void> => {
    if (remaining.length === 0) return;
    const [head, ...tail] = remaining;
    await processLine(head);
    await processNext(tail);
  };

  await processNext(lines);
};

const runInteractiveMode = async (
  filePath: string,
  player: PlayerType,
): Promise<void> => {
  const selectedPosition: { value: TilePosition | undefined } = { value: undefined };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const showBoard = (game: Game): void => {
    console.log("\n" + renderBoard(game, selectedPosition.value));
    console.log(renderStatus(game));
  };

  const prompt = (): void => {
    readGameFile(filePath).then((game) => {
      const isMyTurn = game.currentPlayer === player;
      const marker = player === "day" ? "\x1b[33m☀\x1b[0m" : "\x1b[35m☾\x1b[0m";
      const turnLabel = isMyTurn ? "" : " (waiting)";
      const selLabel =
        selectedPosition.value !== undefined
          ? ` [${selectedPosition.value.row},${selectedPosition.value.column}]`
          : "";

      rl.question(`${marker} ${player}${turnLabel}${selLabel}> `, (input) => {
        handleInput(game, input);
      });
    }).catch((error) => {
      console.error("Error reading game file:", error);
      prompt();
    });
  };

  const handleInput = (currentGame: Game, input: string): void => {
    const parsed = parseCommand(input, player, selectedPosition.value);

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
        console.log(renderStatus(currentGame));
        break;
      }

      case "select": {
        const tile = currentGame.tiles.find(
          (tile) => tile.row === parsed.position.row && tile.column === parsed.position.column,
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
        const tile = currentGame.tiles.find(
          (tile) => tile.row === parsed.position.row && tile.column === parsed.position.column,
        );
        if (tile === undefined) {
          console.log("Invalid position.");
        } else {
          console.log(renderTileInfo(tile));
        }
        break;
      }

      case "action": {
        if (currentGame.currentPlayer !== player) {
          console.log("Not your turn. Waiting for opponent.");
          break;
        }

        // Re-read file to get latest state before applying action
        readGameFile(filePath).then((latestGame) => {
          if (latestGame.currentPlayer !== player) {
            console.log("Not your turn. Waiting for opponent.");
            prompt();
            return;
          }

          const { game: updatedGame, result } = handleAction(latestGame, parsed.action);

          if (result.success) {
            console.log(result.message ?? "OK");
            selectedPosition.value = undefined;
            writeGameFile(filePath, updatedGame).then(() => {
              showBoard(updatedGame);
              prompt();
            });
            return;
          }

          console.log(`Error: ${result.error}`);
          prompt();
        });
        return; // Don't call prompt() here — the async chain handles it
      }

      case "error": {
        console.log(parsed.message);
        break;
      }
    }

    prompt();
  };

  // Initial render
  const game = await readGameFile(filePath);
  console.log(`Playing as: ${player}`);
  showBoard(game);
  console.log("");
  prompt();
};
