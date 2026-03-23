import { createLocalGame } from "../create-game.ts";
import { writeGameFile } from "../game-file.ts";
import type { Game } from "@shared/game/types.ts";

const parseArgs = (
  args: ReadonlyArray<string>,
): { size: number; seed: string | undefined; out: string } => {
  const sizeIndex = args.indexOf("--size");
  const seedIndex = args.indexOf("--seed");
  const outIndex = args.indexOf("--out");

  const size = sizeIndex !== -1 ? Number(args.at(sizeIndex + 1)) : 15;
  const seed = seedIndex !== -1 ? args.at(seedIndex + 1) : undefined;
  const out = outIndex !== -1 ? (args.at(outIndex + 1) ?? "games/game.json") : "games/game.json";

  return {
    size: Number.isNaN(size) ? 15 : size,
    seed,
    out,
  };
};

export const runCreate = async (args: ReadonlyArray<string>): Promise<void> => {
  const { size, seed, out } = parseArgs(args);
  const game = createLocalGame(size, seed) as Game;

  await writeGameFile(out, game);

  console.log(`Game created: ${out}`);
  console.log(`  Size: ${size}x${size}`);
  console.log(`  Seed: ${seed ?? "random"}`);
  console.log(`  Day starts at (bottom-left), Night at (top-right)`);
};
