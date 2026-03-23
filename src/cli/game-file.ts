import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Game } from "@shared/game/types.ts";

const DATE_FIELDS = ["createdAt", "updatedAt", "dayPlayerLastMove", "nightPlayerLastMove"] as const;

export const readGameFile = async (filePath: string): Promise<Game> => {
  const raw = await fs.readFile(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);

  return DATE_FIELDS.reduce(
    (game, field) => ({
      ...game,
      [field]:
        typeof game[field] === "string"
          ? new Date(game[field])
          : game[field] ?? null,
    }),
    parsed,
  ) as Game;
};

export const writeGameFile = async (
  filePath: string,
  game: Game,
): Promise<void> => {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  const serialized = {
    ...game,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    dayPlayerLastMove: game.dayPlayerLastMove?.toISOString() ?? null,
    nightPlayerLastMove: game.nightPlayerLastMove?.toISOString() ?? null,
  };

  await fs.writeFile(resolved, JSON.stringify(serialized, null, 2), "utf-8");
};
