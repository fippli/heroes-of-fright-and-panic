import { BuildingType } from "@shared/building";
import { PieceType } from "@shared/piece";

export type TilePosition = {
  row: number;
  column: number;
};

export type PlayerType = "day" | "night";

// Base action interface
interface BaseAction {
  player: PlayerType;
}

// Click action - for selecting tiles and moving pieces
export interface ClickAction extends BaseAction {
  type: "click";
  position: TilePosition;
  selectedPosition?: TilePosition; // Current selected tile (if any)
}

// Build action - for constructing buildings
export interface BuildAction extends BaseAction {
  type: "build";
  buildingType: BuildingType;
  position: TilePosition;
  selectedPosition?: TilePosition;
}

// Create peasant action
export interface CreatePeasantAction extends BaseAction {
  type: "createPeasant";
  position: TilePosition;
}

// Upgrade action - for upgrading pieces
export interface UpgradeAction extends BaseAction {
  type: "upgrade";
  position: TilePosition;
  targetType?: PieceType; // Optional: specific upgrade target (e.g., archer)
}

// Attack action
export interface AttackAction extends BaseAction {
  type: "attack";
  position: TilePosition; // Target position
  selectedPosition: TilePosition; // Attacker position
}

// Union type of all actions
export type GameAction =
  | ClickAction
  | BuildAction
  | CreatePeasantAction
  | UpgradeAction
  | AttackAction;

// Action result
export interface ActionResult {
  success: boolean;
  error?: string;
  message?: string;
}
