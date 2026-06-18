import type { BuildingType } from "@shared/building/index.ts";
import type { EquipmentType } from "@shared/equipment/index.ts";
import type { ResearchType } from "@shared/research/index.ts";
import type { SteedType } from "@shared/steed/index.ts";
import type { TilePosition } from "@shared/map/tile.ts";

export type { TilePosition };

export type PlayerType = "day" | "night";

type BaseAction = {
  readonly player: PlayerType;
};

export type MoveAction = BaseAction & {
  readonly type: "move";
  readonly from: TilePosition;
  readonly to: TilePosition;
};

export type BuildAction = BaseAction & {
  readonly type: "build";
  readonly buildingType: BuildingType;
  readonly position: TilePosition;
};

export type SpawnPeasantAction = BaseAction & {
  readonly type: "spawnPeasant";
  readonly position: TilePosition;
};

export type CraftEquipmentAction = BaseAction & {
  readonly type: "craftEquipment";
  readonly equipmentType: EquipmentType;
  readonly piecePosition: TilePosition;
};

export type BuySteedAction = BaseAction & {
  readonly type: "buySteed";
  readonly steedType: SteedType;
  readonly housePosition: TilePosition;
  readonly targetPosition: TilePosition;
};

export type TrainPriestAction = BaseAction & {
  readonly type: "trainPriest";
  readonly churchPosition: TilePosition;
};

export type HealAction = BaseAction & {
  readonly type: "heal";
  readonly priestPosition: TilePosition;
  readonly targetPosition: TilePosition;
};

export type ResearchAction = BaseAction & {
  readonly type: "research";
  readonly researchType: ResearchType;
  readonly castlePosition: TilePosition;
};

export type EnterTowerAction = BaseAction & {
  readonly type: "enterTower";
  readonly kingPosition: TilePosition;
  readonly towerPosition: TilePosition;
};

export type SummonArchAngelAction = BaseAction & {
  readonly type: "summonArchAngel";
  readonly churchPosition: TilePosition;
};

export type AttackAction = BaseAction & {
  readonly type: "attack";
  readonly attackerPosition: TilePosition;
  readonly targetPosition: TilePosition;
};

export type LootAction = BaseAction & {
  readonly type: "loot";
  readonly piecePosition: TilePosition;
  readonly targetPosition: TilePosition;
};

export type GameAction =
  | MoveAction
  | BuildAction
  | SpawnPeasantAction
  | CraftEquipmentAction
  | BuySteedAction
  | TrainPriestAction
  | HealAction
  | ResearchAction
  | EnterTowerAction
  | SummonArchAngelAction
  | AttackAction
  | LootAction;

export type ActionResult = {
  readonly success: boolean;
  readonly error?: string;
  readonly message?: string;
};
