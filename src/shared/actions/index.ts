import { BuildingType } from "@shared/building/index.ts";
import { PieceType } from "@shared/piece/index.ts";

export type { TilePosition } from "@shared/map/tile.ts";

export type PlayerType = "day" | "night";

// Base action type
type BaseAction = {
  player: PlayerType;
};

// Click action - for selecting tiles and moving pieces
export type ClickAction = BaseAction & {
  type: "click";
  position: TilePosition;
  selectedPosition?: TilePosition; // Current selected tile (if any)
};

// Build action - for constructing buildings
export type BuildAction = BaseAction & {
  type: "build";
  buildingType: BuildingType;
  position: TilePosition;
  selectedPosition?: TilePosition;
};

// Create peasant action
export type CreatePeasantAction = BaseAction & {
  type: "createPeasant";
  position: TilePosition;
};

// Upgrade action - for upgrading pieces
export type UpgradeAction = BaseAction & {
  type: "upgrade";
  position: TilePosition;
  targetType?: PieceType; // Optional: specific upgrade target (e.g., archer)
};

// Attack action
export type AttackAction = BaseAction & {
  type: "attack";
  position: TilePosition; // Target position
  selectedPosition: TilePosition; // Attacker position
};

// Union type of all actions
export type GameAction =
  | ClickAction
  | BuildAction
  | CreatePeasantAction
  | UpgradeAction
  | AttackAction;

// Action result
export type ActionResult = {
  success: boolean;
  error?: string;
  message?: string;
};
