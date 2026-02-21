import type { BuildingType } from "./Building";
import type { LandscapeType } from "./Landscape";
import type { PieceType } from "./Piece";
import type { ResourceMap } from "./ResourceMap";

export type PlayerType = "day" | "night";

export type GameAction = {
  type: string;
  player: PlayerType;
  position?: { row: number; column: number };
  selectedPosition?: { row: number; column: number };
  buildingType?: BuildingType;
  targetType?: PieceType;
};

type GameClock = {
  time: number;
  hasDawned: boolean;
  hasDusked: boolean;
};

export type ServerPlayer = {
  type: PlayerType;
  resources: { wood: number; gold: number; stone: number; food: number };
};

export type ServerTile = {
  row: number;
  column: number;
  landscape: { type: LandscapeType; lootDrop?: ResourceMap } | null;
  building: {
    type: BuildingType;
    production?: ResourceMap;
    cost?: ResourceMap;
    walkable?: boolean;
    viewRange?: number;
    owner?: { type: PlayerType };
  } | null;
  piece: {
    type: PieceType;
    viewRange?: number;
    attackRange?: number;
    owner?: { type: PlayerType };
    upgradeCost?: ResourceMap;
    walkableLandscape?: LandscapeType[];
    lootableLandscape?: LandscapeType[];
  } | null;
};

export type ServerGameState = {
  id: string;
  _id?: string;
  size: number;
  currentPlayer: PlayerType;
  clock: GameClock;
  gameOver?: boolean;
  winner?: PlayerType | null;
  dayPlayer: ServerPlayer;
  nightPlayer: ServerPlayer;
  tiles: ServerTile[];
};

export type ActionResponse = {
  result: {
    success: boolean;
    error?: string;
    message?: string;
  };
  game: ServerGameState;
};
