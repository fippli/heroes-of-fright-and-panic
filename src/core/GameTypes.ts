import type { BuildingType } from "./Building";
import type { LandscapeType } from "./Landscape";
import type { PieceKind } from "./Piece";
import type { ResourceMap } from "@shared/player/resource-map";

import type { PlayerType } from "@shared/actions/index";

export type { PlayerType };

// The client and engine now share a single, type-safe action contract.
// Re-exported so existing client imports keep working.
export type { GameAction } from "@shared/actions/index";

type GameClock = {
  time: number;
  hasDawned: boolean;
  hasDusked: boolean;
};

export type ServerPlayer = {
  type: PlayerType;
  research?: {
    hasQueen?: boolean;
  };
  resources: {
    wood: number;
    gold: number;
    stone: number;
    food: number;
    iron?: number;
    faith?: number;
  };
};

export type ServerTile = {
  row: number;
  column: number;
  landscape: { type: LandscapeType } | null;
  building: {
    type: BuildingType;
    cost?: ResourceMap;
    walkableByOwner?: boolean;
    walkableByEnemy?: boolean;
    viewRange?: number;
    defense?: number;
    owner?: PlayerType;
    level?: number;
    acted?: boolean;
    /** Curtain-wall edges this wall joins toward (0=E … 5=NE) */
    connections?: number[] | null;
  } | null;
  piece: {
    kind: PieceKind;
    viewRange?: number;
    attackRange?: number;
    owner?: PlayerType;
    hearts?: number;
    maxHearts?: number;
    baseAttack?: number;
    baseDefense?: number;
    equipment?: unknown[];
    steed?: unknown;
    walkableLandscape?: LandscapeType[];
    acted?: boolean;
  } | null;
  /** A steed left on the tile (bought at a house), waiting to be mounted */
  steed?: { type: string } | null;
  /** River overlay connecting two edges of the tile (directions 0=E … 5=NE) */
  river?: { entry: number; exit: number } | null;
};

/** Building fields as they arrive on the wire */
export type ServerBuilding = NonNullable<ServerTile["building"]>;

export type ServerGameState = {
  id: string;
  _id?: string;
  /** When the server last stored this game (ISO string); echoed back as `since` when polling */
  updatedAt?: string;
  size: number;
  currentPlayer: PlayerType;
  clock: GameClock;
  gameOver?: boolean;
  winner?: PlayerType | null;
  dayPlayer: ServerPlayer;
  nightPlayer: ServerPlayer;
  tiles: ServerTile[];
  themeId?: string | null;
  name?: string | null;
  /** Which side this client plays, from the server; null for spectators */
  viewingAs?: PlayerType | null;
  /** A free seat this user could take (non-participants only) */
  canJoin?: PlayerType | null;
  /** Whether the opponent's seat is still empty (participants only) */
  opponentOpen?: boolean;
};

export type ActionResponse = {
  result: {
    success: boolean;
    error?: string;
    message?: string;
  };
  game: ServerGameState;
};
