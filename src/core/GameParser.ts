import { Building } from "./Building";
import { Clock } from "./Clock";
import { Landscape } from "./Landscape";
import { Piece } from "./Piece";
import { Player } from "@shared/player";
import { ResourceMap } from "@shared/player/resource-map";
import { Tile } from "./Tile";
import type { ServerGameState, ServerTile, ServerPlayer } from "./GameTypes";

const parseClock = (clock?: { time: number }): Clock =>
  new Clock(clock?.time ?? 6);

const parsePlayer = (serverPlayer: ServerPlayer): Player =>
  new Player({
    type: serverPlayer.type,
    resources: new ResourceMap(serverPlayer.resources ?? {}),
  });

const parseTile = (tile: ServerTile): Tile =>
  new Tile({
    row: tile.row,
    column: tile.column,
    landscape: tile.landscape !== null ? new Landscape(tile.landscape) : undefined,
    building:
      tile.building !== null
        ? new Building({
            type: tile.building.type,
            production: new ResourceMap(tile.building.production ?? {}),
            cost: new ResourceMap(tile.building.cost ?? {}),
            walkable: tile.building.walkable ?? true,
            viewRange: tile.building.viewRange ?? 1,
            owner: new Player({
              type: tile.building.owner?.type ?? "day",
            }),
          })
        : undefined,
    piece:
      tile.piece !== null
        ? new Piece({
            type: tile.piece.type,
            viewRange: tile.piece.viewRange ?? 1,
            attackRange: tile.piece.attackRange ?? tile.piece.viewRange ?? 1,
            owner: new Player({ type: tile.piece.owner?.type ?? "day" }),
            upgradeCost: new ResourceMap(tile.piece.upgradeCost ?? {}),
            walkableLandscape: tile.piece.walkableLandscape ?? [],
            lootableLandscape: tile.piece.lootableLandscape ?? [],
          })
        : undefined,
  });

const parseTiles = (serverTiles: ServerTile[]): Tile[] =>
  serverTiles.map(parseTile);

export const parseGameState = (game: ServerGameState) => ({
  id: game.id ?? game._id ?? "",
  clock: parseClock(game.clock),
  currentPlayer: game.currentPlayer ?? "day" as const,
  dayPlayer: parsePlayer(game.dayPlayer),
  nightPlayer: parsePlayer(game.nightPlayer),
  tiles: parseTiles(game.tiles),
  gameOver: game.gameOver ?? false,
  winner: game.winner ?? null,
});
