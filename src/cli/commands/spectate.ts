import * as fs from "node:fs";
import { readGameFile } from "../game-file.ts";
import { renderBoard, renderStatus } from "../render.ts";

export const runSpectate = async (args: ReadonlyArray<string>): Promise<void> => {
  const filePath = args.at(0) ?? "";

  if (filePath === "") {
    console.error("Usage: cli spectate <file>");
    process.exit(1);
  }

  console.log(`Spectating: ${filePath}`);
  console.log("Watching for changes... (Ctrl+C to exit)\n");

  const render = async (): Promise<void> => {
    try {
      const game = await readGameFile(filePath);
      console.clear();
      console.log(`Spectating: ${filePath}\n`);
      console.log(renderBoard(game));
      console.log(renderStatus(game));
      if (game.gameOver === true) {
        console.log(`\n\x1b[1mGame Over! ${game.winner ?? "Unknown"} wins!\x1b[0m`);
      }
    } catch (error) {
      console.error("Error reading game file:", error);
    }
  };

  // Initial render
  await render();

  // Watch for file changes with debounce
  const debounceMs = 200;
  const debounceState = { timeout: null as ReturnType<typeof setTimeout> | null };

  fs.watchFile(filePath, { interval: 500 }, () => {
    if (debounceState.timeout !== null) {
      clearTimeout(debounceState.timeout);
    }
    debounceState.timeout = setTimeout(() => {
      render();
    }, debounceMs);
  });
};
