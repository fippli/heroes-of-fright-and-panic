import type { GameAction, TilePosition, PlayerType } from "@shared/actions/index.ts";
import { BuildingType } from "@shared/building/index.ts";
import { PieceType } from "@shared/piece/index.ts";

type ParsedCommand =
  | { type: "action"; action: GameAction }
  | { type: "select"; position: TilePosition }
  | { type: "inspect"; position: TilePosition }
  | { type: "help" }
  | { type: "status" }
  | { type: "quit" }
  | { type: "error"; message: string };

const parsePosition = (input: string): TilePosition | null => {
  const parts = input.split(",");
  if (parts.length !== 2) return null;

  const row = Number(parts.at(0));
  const column = Number(parts.at(1));

  if (Number.isNaN(row) || Number.isNaN(column)) return null;

  return { row, column };
};

export const parseCommand = (
  input: string,
  currentPlayer: PlayerType,
  selectedPosition: TilePosition | undefined,
): ParsedCommand => {
  const trimmed = input.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  const command = parts.at(0) ?? "";

  switch (command) {
    case "help":
    case "h":
      return { type: "help" };

    case "quit":
    case "q":
      return { type: "quit" };

    case "status":
    case "st":
      return { type: "status" };

    case "select":
    case "sel": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: select <row>,<col>" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return { type: "select", position };
    }

    case "inspect":
    case "i": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: inspect <row>,<col>" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return { type: "inspect", position };
    }

    case "move":
    case "m": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: move <row>,<col>" };
      }
      if (selectedPosition === undefined) {
        return { type: "error", message: "No unit selected. Use: select <row>,<col> first" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: {
          type: "click",
          player: currentPlayer,
          position,
          selectedPosition,
        },
      };
    }

    case "attack":
    case "a": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: attack <row>,<col>" };
      }
      if (selectedPosition === undefined) {
        return { type: "error", message: "No unit selected. Use: select <row>,<col> first" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: {
          type: "attack",
          player: currentPlayer,
          position,
          selectedPosition,
        },
      };
    }

    case "build":
    case "b": {
      const buildingName = parts.at(1);
      const posStr = parts.at(2);
      if (buildingName === undefined || posStr === undefined) {
        return { type: "error", message: "Usage: build <house|farm|tower|castle> <row>,<col>" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const buildingType = parseBuildingType(buildingName);
      if (buildingType === null) {
        return { type: "error", message: `Unknown building: ${buildingName}. Options: house, farm, tower, castle` };
      }
      return {
        type: "action",
        action: {
          type: "build",
          player: currentPlayer,
          buildingType,
          position,
          selectedPosition,
        },
      };
    }

    case "spawn": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: spawn <row>,<col>" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: {
          type: "createPeasant",
          player: currentPlayer,
          position,
        },
      };
    }

    case "upgrade":
    case "u": {
      const posStr = parts.at(1);
      const targetName = parts.at(2);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: upgrade <row>,<col> [archer]" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const targetType = targetName === "archer" ? PieceType.archer : undefined;
      return {
        type: "action",
        action: {
          type: "upgrade",
          player: currentPlayer,
          position,
          targetType,
        },
      };
    }

    case "loot":
    case "l": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: loot <row>,<col>" };
      }
      if (selectedPosition === undefined) {
        return { type: "error", message: "No unit selected. Use: select <row>,<col> first" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: {
          type: "click",
          player: currentPlayer,
          position,
          selectedPosition,
        },
      };
    }

    default:
      return { type: "error", message: `Unknown command: "${command}". Type "help" for commands.` };
  }
};

const parseBuildingType = (name: string): BuildingType | null => {
  switch (name) {
    case "house":
      return BuildingType.house;
    case "farm":
      return BuildingType.farm;
    case "tower":
      return BuildingType.tower;
    case "castle":
      return BuildingType.castle;
    default:
      return null;
  }
};
