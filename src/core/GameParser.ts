import { Building } from "./Building";
import { Clock } from "./Clock";
import { Landscape } from "./Landscape";
import { Piece } from "./Piece";
import { createPlayer, type Player } from "@shared/player";
import {
  type Piece as EnginePiece,
  getPieceView,
  getPieceAttackRange,
  getWalkableLandscape,
} from "@shared/piece";
import { Tile } from "./Tile";
import type { ServerGameState, ServerTile, ServerPlayer } from "./GameTypes";

const parseClock = (clock?: { time: number }): Clock =>
  new Clock(clock?.time ?? 6);

const parsePlayer = (serverPlayer: ServerPlayer): Player =>
  createPlayer({
    type: serverPlayer.type,
    resources: serverPlayer.resources,
  });

const parseTile = (tile: ServerTile): Tile =>
  new Tile({
    row: tile.row,
    column: tile.column,
    landscape:
      tile.landscape != null ? new Landscape(tile.landscape) : undefined,
    building:
      tile.building != null
        ? new Building({
            type: tile.building.type,
            viewRange: tile.building.viewRange ?? 1,
            owner: createPlayer({
              type: tile.building.owner ?? "day",
            }),
          })
        : undefined,
    piece: tile.piece != null ? parsePiece(tile.piece) : undefined,
  });

// Engine pieces carry base stats + equipment/steed, not the effective ranges
// the renderer needs. Derive them with the shared getters so the view/move
// overlays match what the engine will actually allow.
const parsePiece = (serverPiece: NonNullable<ServerTile["piece"]>): Piece => {
  const enginePiece = serverPiece as unknown as EnginePiece;
  return new Piece({
    kind: serverPiece.kind,
    viewRange: serverPiece.viewRange ?? getPieceView(enginePiece),
    attackRange: serverPiece.attackRange ?? getPieceAttackRange(enginePiece),
    owner: createPlayer({ type: serverPiece.owner ?? "day" }),
    walkableLandscape: [...getWalkableLandscape(enginePiece)],
  });
};

const parseTiles = (serverTiles: ServerTile[]): Tile[] =>
  serverTiles.map(parseTile);

export const parseGameState = (game: ServerGameState) => ({
  id: game.id ?? game._id ?? "",
  clock: parseClock(game.clock),
  currentPlayer: game.currentPlayer ?? ("day" as const),
  dayPlayer: parsePlayer(game.dayPlayer),
  nightPlayer: parsePlayer(game.nightPlayer),
  tiles: parseTiles(game.tiles),
  gameOver: game.gameOver ?? false,
  winner: game.winner ?? null,
});
