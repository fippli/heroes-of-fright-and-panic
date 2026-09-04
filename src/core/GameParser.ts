import { Building } from "./Building";
import { Clock } from "./Clock";
import { Landscape } from "./Landscape";
import { Piece } from "./Piece";
import { createPlayer, type Player } from "@shared/player";
import { createResourceMap } from "@shared/player/resource-map";
import {
  type Piece as EnginePiece,
  PieceKind,
  createArchAngel,
  createKing,
  createPeasant,
  createPriest,
  getPieceView,
  getPieceAttackRange,
  getPieceAttack,
  getPieceDefense,
  getPieceMove,
  getWalkableLandscape,
} from "@shared/piece";
import { Tile } from "./Tile";
import type { ServerGameState, ServerTile, ServerPlayer } from "./GameTypes";

const parseClock = (clock?: { time: number }): Clock =>
  new Clock(clock?.time ?? 6);

const parsePlayer = (serverPlayer: ServerPlayer): Player =>
  createPlayer({
    type: serverPlayer.type,
    resources: createResourceMap(serverPlayer.resources),
    research: { hasQueen: serverPlayer.research?.hasQueen ?? false },
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
            level: tile.building.level ?? 1,
            acted: tile.building.acted ?? false,
            connections: tile.building.connections ?? null,
            owner: createPlayer({
              type: tile.building.owner ?? "day",
            }),
          })
        : undefined,
    piece: tile.piece != null ? parsePiece(tile.piece) : undefined,
    steed: tile.steed != null ? tile.steed.type : null,
    river: tile.river ?? null,
  });

type ServerPiece = NonNullable<ServerTile["piece"]>;

const defaultEnginePiece = (kind: PieceKind, owner: "day" | "night"): EnginePiece => {
  switch (kind) {
    case PieceKind.king:
      return createKing(owner);
    case PieceKind.priest:
      return createPriest(owner);
    case PieceKind.archAngel:
      return createArchAngel(owner);
    case PieceKind.peasant:
    default:
      return createPeasant(owner);
  }
};

// Games saved before the engine overhaul may lack equipment/steed/base stats.
// Fill anything missing from the kind's factory defaults so the shared getters
// never see a partial piece.
export const normalizePiece = (serverPiece: ServerPiece): EnginePiece => {
  const owner = serverPiece.owner ?? "day";
  const defaults = defaultEnginePiece(serverPiece.kind, owner);
  const definedFields = Object.fromEntries(
    Object.entries(serverPiece).filter(([, value]) => value !== undefined),
  );
  return {
    ...defaults,
    ...definedFields,
    owner,
    equipment: Array.isArray(serverPiece.equipment)
      ? (serverPiece.equipment as EnginePiece["equipment"])
      : defaults.equipment,
    steed: (serverPiece.steed ?? null) as EnginePiece["steed"],
  };
};

// Engine pieces carry base stats + equipment/steed, not the effective ranges
// the renderer needs. Derive them with the shared getters so the view/move
// overlays match what the engine will actually allow.
const parsePiece = (serverPiece: ServerPiece): Piece => {
  const enginePiece = normalizePiece(serverPiece);
  return new Piece({
    kind: serverPiece.kind,
    viewRange: serverPiece.viewRange ?? getPieceView(enginePiece),
    attackRange: serverPiece.attackRange ?? getPieceAttackRange(enginePiece),
    owner: createPlayer({ type: serverPiece.owner ?? "day" }),
    walkableLandscape: [...getWalkableLandscape(enginePiece)],
    equipment: enginePiece.equipment.map((item) => item.type),
    steed: enginePiece.steed?.type ?? null,
    hearts: enginePiece.hearts,
    maxHearts: enginePiece.maxHearts,
    attack: getPieceAttack(enginePiece),
    defense: getPieceDefense(enginePiece),
    move: getPieceMove(enginePiece),
    acted: enginePiece.acted ?? false,
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
