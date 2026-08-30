import * as readline from "node:readline";
import { handleAction } from "@shared/game/engine.ts";
import type { Game } from "@shared/game/types.ts";
import type { GameAction, TilePosition, PlayerType } from "@shared/actions/index.ts";
import { generateAllActions, pickAction } from "@shared/ai/index.ts";
import { createRandom } from "@shared/utils/random.ts";
import { readGameFile, writeGameFile } from "../game-file.ts";
import { parseCommand } from "../parse-command.ts";
import { renderBoard, renderStatus, renderTileInfo } from "../render.ts";
import { formatJsonResponse } from "../json-output.ts";
import {
  loadSupabaseConfig,
  loadSession,
  invokeEdgeFunction,
} from "../supabase-client.ts";

const HELP_TEXT = `
Commands:
  select <row>,<col>        Select a tile (sel)
  move <from> <to>          Move unit between positions (m)
  move <row>,<col>          Move selected unit to position (m)
  attack <from> <to>        Attack from position to target (a)
  attack <row>,<col>        Attack target with selected unit (a)
  build <type> <row>,<col>  Build: house, tower, wall, church (b)
  spawn <row>,<col>         Spawn peasant on your house
  craft <type> <row>,<col>  Craft: sword, shield, bow
  steed <type> <house> <target>  Buy: horse, boat
  train <row>,<col>         Train priest at church
  heal <priest> <target>    Priest heals adjacent piece
  research <type> <row>,<col>  Research: speed, mining2, mining3, queen
  enter <king> <tower>      King enters tower (creates castle)
  summon <row>,<col>        Summon arch angel at church
  pass [phase]              Wait one hour (or the rest of the phase)
  end                       End your phase
  inspect <row>,<col>       Show tile details (i)
  status                    Show resources and clock (st)
  board                     Redraw the board (show)
  help                      Show this help (h)
  quit                      Exit (q)
`;

const parseArgs = (
  args: ReadonlyArray<string>,
): { target: string; player: PlayerType | undefined; json: boolean; auto: boolean; online: boolean } => {
  const target = args.at(0) ?? "";
  const playerIndex = args.indexOf("--player");
  const playerArg = playerIndex !== -1 ? args.at(playerIndex + 1) : undefined;
  const json = args.includes("--json");
  const auto = args.includes("--auto");
  const online = args.includes("--online");

  const player: PlayerType | undefined =
    playerArg === "day" || playerArg === "night" ? playerArg : undefined;

  return { target, player, json, auto, online };
};

export const runPlay = async (args: ReadonlyArray<string>): Promise<void> => {
  const { target, player, json, auto, online } = parseArgs(args);

  if (target === "") {
    console.error("Usage: cli play <file|game-id> [--player <day|night>] [--auto] [--online]");
    process.exit(1);
  }

  if (online) {
    await runOnlineMode(target, player ?? "day", auto);
  } else if (auto) {
    await runAutoMode(target, player ?? "night");
  } else if (json) {
    await runJsonMode(target, player ?? "day");
  } else if (player !== undefined) {
    await runInteractiveMode(target, player);
  } else {
    await runHotseatMode(target);
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

  const selectedPosition: { value: TilePosition | undefined } = { value: undefined };

  const processLine = async (line: string): Promise<void> => {
    const game = await readGameFile(filePath);

    if (game.currentPlayer !== player) {
      console.log(JSON.stringify({ success: false, error: "Not your turn", currentPlayer: game.currentPlayer }));
      return;
    }

    const parsed = parseCommand(line, player, selectedPosition.value);

    if (parsed.type === "error") {
      console.log(JSON.stringify({ success: false, error: parsed.message }));
      return;
    }

    if (parsed.type === "select") {
      selectedPosition.value = parsed.position;
      console.log(formatJsonResponse(game));
      return;
    }

    if (parsed.type !== "action") {
      console.log(formatJsonResponse(game));
      return;
    }

    const { game: updatedGame, result } = handleAction(game, parsed.action);

    if (result.success) {
      selectedPosition.value = undefined;
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
  const closed: { value: boolean } = { value: false };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("close", () => {
    closed.value = true;
  });

  const showBoard = (game: Game): void => {
    console.log("\n" + renderBoard(game, selectedPosition.value));
    console.log(renderStatus(game));
  };

  const prompt = (): void => {
    if (closed.value) return;
    readGameFile(filePath).then((game) => {
      if (closed.value) return;
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
      if (closed.value) return;
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

      case "board": {
        showBoard(currentGame);
        break;
      }

      case "select": {
        const tile = currentGame.tiles.find(
          (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
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
          (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
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

const runHotseatMode = async (filePath: string): Promise<void> => {
  const selectedPosition: { value: TilePosition | undefined } = { value: undefined };
  const closed: { value: boolean } = { value: false };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("close", () => {
    closed.value = true;
  });

  const showBoard = (game: Game): void => {
    console.log("\n" + renderBoard(game, selectedPosition.value));
    console.log(renderStatus(game));
  };

  const prompt = (): void => {
    if (closed.value) return;
    readGameFile(filePath).then((game) => {
      if (closed.value) return;
      if (game.gameOver === true) {
        console.log(`\n\x1b[1mGame Over! ${game.winner ?? "Unknown"} wins!\x1b[0m`);
        rl.close();
        process.exit(0);
        return;
      }

      const currentPlayer = game.currentPlayer;
      const marker = currentPlayer === "day" ? "\x1b[33m☀\x1b[0m" : "\x1b[35m☾\x1b[0m";
      const selLabel =
        selectedPosition.value !== undefined
          ? ` [${selectedPosition.value.row},${selectedPosition.value.column}]`
          : "";

      rl.question(`${marker} ${currentPlayer}${selLabel}> `, (input) => {
        handleInput(game, input);
      });
    }).catch((error) => {
      if (closed.value) return;
      console.error("Error reading game file:", error);
      prompt();
    });
  };

  const handleInput = (currentGame: Game, input: string): void => {
    const currentPlayer = currentGame.currentPlayer;
    const parsed = parseCommand(input, currentPlayer, selectedPosition.value);

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

      case "board": {
        showBoard(currentGame);
        break;
      }

      case "select": {
        const tile = currentGame.tiles.find(
          (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
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
          (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
        );
        if (tile === undefined) {
          console.log("Invalid position.");
        } else {
          console.log(renderTileInfo(tile));
        }
        break;
      }

      case "action": {
        readGameFile(filePath).then((latestGame) => {
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
        return;
      }

      case "error": {
        console.log(parsed.message);
        break;
      }
    }

    prompt();
  };

  const game = await readGameFile(filePath);
  console.log("Hot-seat mode: both players share this terminal");
  showBoard(game);
  console.log("");
  prompt();
};

const runAutoMode = async (
  filePath: string,
  player: PlayerType,
): Promise<void> => {
  const random = createRandom(Date.now());
  const delayMs = 500;

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  console.log(`AI playing as: ${player}`);
  console.log("Watching for turns... (Ctrl+C to exit)\n");

  const tick = async (): Promise<void> => {
    const game = await readGameFile(filePath);

    if (game.gameOver === true) {
      console.log(renderBoard(game));
      console.log(renderStatus(game));
      console.log(`\n\x1b[1mGame Over! ${game.winner ?? "Unknown"} wins!\x1b[0m`);
      process.exit(0);
      return;
    }

    if (game.currentPlayer !== player) {
      await sleep(delayMs);
      return tick();
    }

    const actions = generateAllActions(game, player);

    if (actions.length === 0) {
      console.log("No valid actions available. Waiting...");
      await sleep(delayMs);
      return tick();
    }

    const action = pickAction(actions, random);
    if (action === undefined) {
      await sleep(delayMs);
      return tick();
    }

    const { game: updatedGame, result } = handleAction(game, action);

    if (result.success) {
      const summary = `${action.type}${result.message !== undefined ? `: ${result.message}` : ""}`;
      console.log(`  [${player}] ${summary}`);
      await writeGameFile(filePath, updatedGame);
    }

    await sleep(100);
    return tick();
  };

  await tick();
};

// ============================================
// ONLINE MODE (Supabase)
// ============================================

const parseOnlineGameState = (data: unknown): Game | null => {
  if (data === null || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record["tiles"] === undefined || record["currentPlayer"] === undefined) return null;
  return {
    ...record,
    id: String(record["id"] ?? ""),
    createdAt: new Date(String(record["createdAt"] ?? new Date().toISOString())),
    updatedAt: new Date(String(record["updatedAt"] ?? new Date().toISOString())),
    size: Number(record["size"] ?? 0),
    tiles: record["tiles"] as Game["tiles"],
    dayPlayer: record["dayPlayer"] as Game["dayPlayer"],
    nightPlayer: record["nightPlayer"] as Game["nightPlayer"],
    currentPlayer: record["currentPlayer"] as Game["currentPlayer"],
    clock: record["clock"] as Game["clock"],
    creatorEmail: String(record["creatorEmail"] ?? ""),
    gameOver: record["gameOver"] === true,
    winner: (record["winner"] as Game["winner"]) ?? null,
  } as Game;
};

const runOnlineMode = async (
  gameId: string,
  player: PlayerType,
  auto: boolean,
): Promise<void> => {
  const session = await loadSession();
  if (session === null) {
    console.error("Not logged in. Run: cli login --email <email> --password <password>");
    process.exit(1);
    return;
  }

  if (Date.now() > session.expiresAt) {
    console.error("Session expired. Run: cli login --email <email> --password <password>");
    process.exit(1);
    return;
  }

  const config = await loadSupabaseConfig();
  const random = createRandom(Date.now());

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchGameState = async (): Promise<Game | null> => {
    const { data, status } = await invokeEdgeFunction(config, session.accessToken, "game-state", { gameId });
    if (status !== 200) {
      const errorMessage = (data as Record<string, unknown>)?.["error"] ?? `HTTP ${status}`;
      console.error(`Error fetching game: ${errorMessage}`);
      return null;
    }
    return parseOnlineGameState(data);
  };

  const sendAction = async (action: GameAction): Promise<{ success: boolean; message?: string; error?: string }> => {
    const { data, status } = await invokeEdgeFunction(config, session.accessToken, "game-action", { gameId, action });
    const record = data as Record<string, unknown>;
    if (status !== 200) {
      return { success: false, error: String(record?.["error"] ?? `HTTP ${status}`) };
    }
    const result = record["result"] as Record<string, unknown> | undefined;
    return {
      success: result?.["success"] === true,
      message: result?.["message"] as string | undefined,
      error: result?.["error"] as string | undefined,
    };
  };

  console.log(`Online mode: ${auto ? "AI" : "interactive"} as ${player}`);
  console.log(`Game: ${gameId}`);
  console.log(`Logged in as: ${session.email}\n`);

  if (auto) {
    const tick = async (): Promise<void> => {
      const game = await fetchGameState();
      if (game === null) {
        await sleep(2000);
        return tick();
      }

      if (game.gameOver === true) {
        console.log(`\n\x1b[1mGame Over! ${game.winner ?? "Unknown"} wins!\x1b[0m`);
        process.exit(0);
        return;
      }

      if (game.currentPlayer !== player) {
        await sleep(2000);
        return tick();
      }

      const actions = generateAllActions(game, player);
      const action = pickAction(actions, random);

      if (action === undefined) {
        console.log("No valid actions. Waiting...");
        await sleep(2000);
        return tick();
      }

      const result = await sendAction(action);
      if (result.success) {
        const summary = `${action.type}${result.message !== undefined ? `: ${result.message}` : ""}`;
        console.log(`  [${player}] ${summary}`);
      } else {
        console.log(`  [${player}] ${action.type} failed: ${result.error}`);
      }

      await sleep(200);
      return tick();
    };

    await tick();
  } else {
    // Interactive online mode
    const closed = { value: false };
    const selectedPosition: { value: TilePosition | undefined } = { value: undefined };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("close", () => {
      closed.value = true;
    });

    const showBoard = (game: Game): void => {
      console.log("\n" + renderBoard(game, selectedPosition.value));
      console.log(renderStatus(game));
    };

    const prompt = async (): Promise<void> => {
      if (closed.value) return;
      const game = await fetchGameState();
      if (game === null) {
        console.error("Failed to fetch game state. Retrying...");
        await sleep(2000);
        return prompt();
      }

      if (game.gameOver === true) {
        showBoard(game);
        console.log(`\n\x1b[1mGame Over! ${game.winner ?? "Unknown"} wins!\x1b[0m`);
        rl.close();
        process.exit(0);
        return;
      }

      const isMyTurn = game.currentPlayer === player;
      const marker = player === "day" ? "\x1b[33m☀\x1b[0m" : "\x1b[35m☾\x1b[0m";
      const turnLabel = isMyTurn ? "" : " (waiting)";

      rl.question(`${marker} ${player}${turnLabel}> `, async (input) => {
        const parsed = parseCommand(input, player, selectedPosition.value);

        switch (parsed.type) {
          case "help":
            console.log(HELP_TEXT);
            break;
          case "quit":
            console.log("Goodbye!");
            rl.close();
            process.exit(0);
            break;
          case "status":
            console.log(renderStatus(game));
            break;
          case "board":
            showBoard(game);
            break;
          case "select": {
            const tile = game.tiles.find(
              (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
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
            const tile = game.tiles.find(
              (candidate) => candidate.row === parsed.position.row && candidate.column === parsed.position.column,
            );
            if (tile === undefined) {
              console.log("Invalid position.");
            } else {
              console.log(renderTileInfo(tile));
            }
            break;
          }
          case "action": {
            if (!isMyTurn) {
              console.log("Not your turn. Waiting for opponent.");
              break;
            }
            const result = await sendAction(parsed.action);
            if (result.success) {
              console.log(result.message ?? "OK");
              selectedPosition.value = undefined;
              const updatedGame = await fetchGameState();
              if (updatedGame !== null) {
                showBoard(updatedGame);
              }
            } else {
              console.log(`Error: ${result.error}`);
            }
            break;
          }
          case "error":
            console.log(parsed.message);
            break;
        }

        return prompt();
      });
    };

    const game = await fetchGameState();
    if (game !== null) {
      console.log(`Playing as: ${player}`);
      showBoard(game);
      console.log("");
    }
    await prompt();
  }
};
