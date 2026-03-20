import { createGame } from "@shared/game/create-game.ts";

export const createLocalGame = (size: number, seed?: string | number) => ({
  id: "local",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...createGame({
    boardSize: size,
    name: "CLI Game",
    alliance: "day",
    creatorEmail: "cli@local",
    inviteEmail: null,
    seed,
  }),
});
