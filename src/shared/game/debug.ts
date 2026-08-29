/**
 * Debug views of a game: personal data stripped, plus a compact summary of
 * where every piece is. Used by the open `game-debug` edge function.
 */

import type { PlayerType } from "@shared/piece/index.ts";
import type { Game } from "./types.ts";

export const AI_EMAIL = "ai@bot";

export type PlayerRole = "human" | "ai" | "open";

export const playerRole = (email: string | null | undefined): PlayerRole => {
  if (email === null || email === undefined || email === "") {
    return "open";
  }
  return email === AI_EMAIL ? "ai" : "human";
};

export type RedactedGame = Omit<
  Game,
  "creatorEmail" | "dayPlayerEmail" | "nightPlayerEmail" | "invitedEmail"
> & {
  readonly dayPlayerRole: PlayerRole;
  readonly nightPlayerRole: PlayerRole;
  readonly hasInvite: boolean;
};

/** Drop every email address, keeping only which kind of player fills each seat */
export const redactGame = (game: Game): RedactedGame => {
  const {
    creatorEmail: _creator,
    dayPlayerEmail,
    nightPlayerEmail,
    invitedEmail,
    ...rest
  } = game;
  return {
    ...rest,
    dayPlayerRole: playerRole(dayPlayerEmail),
    nightPlayerRole: playerRole(nightPlayerEmail),
    hasInvite: invitedEmail !== null && invitedEmail !== undefined,
  };
};

export type PieceSummary = {
  readonly row: number;
  readonly column: number;
  readonly kind: string;
  readonly hearts: number;
  readonly landscape: string | null;
  readonly building: string | null;
};

export type GameSummary = {
  readonly id: string;
  readonly name: string | undefined;
  readonly size: number;
  readonly tileCount: number;
  readonly currentPlayer: PlayerType;
  readonly clock: Game["clock"];
  readonly gameOver: boolean;
  readonly winner: PlayerType | null;
  readonly dayPlayerRole: PlayerRole;
  readonly nightPlayerRole: PlayerRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly pieces: { readonly day: PieceSummary[]; readonly night: PieceSummary[] };
};

/** Compact overview: seats, clock, and every piece's position per player */
export const summarizeGame = (game: Game): GameSummary => {
  const pieces = { day: [] as PieceSummary[], night: [] as PieceSummary[] };
  game.tiles.forEach((tile) => {
    const piece = tile.piece;
    if (piece === null || piece === undefined) {
      return;
    }
    const owner = piece.owner === "night" ? "night" : "day";
    pieces[owner].push({
      row: tile.row,
      column: tile.column,
      kind: piece.kind,
      hearts: piece.hearts,
      landscape: tile.landscape?.type ?? null,
      building: tile.building?.type ?? null,
    });
  });
  return {
    id: game.id,
    name: game.name,
    size: game.size,
    tileCount: game.tiles.length,
    currentPlayer: game.currentPlayer,
    clock: game.clock,
    gameOver: game.gameOver,
    winner: game.winner ?? null,
    dayPlayerRole: playerRole(game.dayPlayerEmail),
    nightPlayerRole: playerRole(game.nightPlayerEmail),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    pieces,
  };
};
