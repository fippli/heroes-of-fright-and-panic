import { handleAction } from "@shared/game/engine.ts";
import type { Game } from "@shared/game/types.ts";
import { generateAllActions, pickAction } from "@shared/ai/index.ts";
import { createRandom } from "@shared/utils/random.ts";
import { readGameFile, writeGameFile } from "../game-file.ts";
import { renderBoard, renderStatus } from "../render.ts";

const parseArgs = (
  args: ReadonlyArray<string>,
): { filePath: string; delayMs: number } => {
  const filePath = args.at(0) ?? "";
  const delayIndex = args.indexOf("--delay");
  const delayArg = delayIndex !== -1 ? Number(args.at(delayIndex + 1)) : 300;
  const delayMs = Number.isNaN(delayArg) ? 300 : delayArg;

  return { filePath, delayMs };
};

export const runAutoPlay = async (args: ReadonlyArray<string>): Promise<void> => {
  const { filePath, delayMs } = parseArgs(args);

  if (filePath === "") {
    console.error("Usage: cli auto-play <file> [--delay <ms>]");
    process.exit(1);
  }

  const random = createRandom(Date.now());

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  console.log("AI vs AI — both players controlled by AI");
  console.log(`Delay between actions: ${delayMs}ms`);
  console.log("Use 'cli spectate <file>' in another terminal to watch.\n");

  const initial = await readGameFile(filePath);
  console.log(renderBoard(initial));
  console.log(renderStatus(initial));
  console.log("");

  const tick = async (game: Game, actionCount: number): Promise<void> => {
    if (game.gameOver === true) {
      console.log(`\n${renderBoard(game)}`);
      console.log(renderStatus(game));
      console.log(`\nGame Over after ${actionCount} actions!`);
      console.log(`Winner: ${game.winner ?? "unknown"}`);
      process.exit(0);
      return;
    }

    const currentPlayer = game.currentPlayer;
    const actions = generateAllActions(game, currentPlayer);

    if (actions.length === 0) {
      console.log(`${currentPlayer} has no valid actions. Stalemate.`);
      process.exit(0);
      return;
    }

    const action = pickAction(actions, random);
    if (action === undefined) {
      process.exit(0);
      return;
    }

    const { game: updatedGame, result } = handleAction(game, action);

    if (!result.success) {
      // Rejected action — skip and retry immediately
      return tick(game, actionCount);
    }

    const marker = currentPlayer === "day" ? "\x1b[33m☀\x1b[0m" : "\x1b[35m☾\x1b[0m";
    const message = result.message ?? action.type;
    console.log(`  ${marker} ${currentPlayer}: ${message}`);

    await writeGameFile(filePath, updatedGame);
    await sleep(delayMs);

    return tick(updatedGame, actionCount + 1);
  };

  await tick(initial, 0);
};
