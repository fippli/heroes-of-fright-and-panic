import type { BuildingType } from "./Building";
import type { LandscapeType } from "./Landscape";
import type { PieceKind } from "./Piece";
import type { ResourceMap } from "@shared/player/resource-map";

export type { PlayerType } from "@shared/actions/index";

export type GameAction = {
  type: string;
  player: PlayerType;
  position?: { row: number; column: number };
  selectedPosition?: { row: number; column: number };
  buildingType?: BuildingType;
  targetKind?: PieceKind;
};

type GameClock = {
  time: number;
  hasDawned: boolean;
  hasDusked: boolean;
};

export type ServerPlayer = {
  type: PlayerType;
  resources: { wood: number; gold: number; stone: number; food: number; iron?: number; faith?: number };
};

export type ServerTile = {
  row: number;
  column: number;
  landscape: { type: LandscapeType; lootDrop?: ResourceMap } | null;
  building: {
    type: BuildingType;
    cost?: ResourceMap;
    walkableByOwner?: boolean;
    walkableByEnemy?: boolean;
    viewRange?: number;
    defense?: number;
    owner?: PlayerType;
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
  themeId?: string | null;
};

export type ActionResponse = {
  result: {
    success: boolean;
    error?: string;
    message?: string;
  };
  game: ServerGameState;
};
