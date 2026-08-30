import type { GameAction, TilePosition, PlayerType } from "@shared/actions/index.ts";
import { BuildingType } from "@shared/building/index.ts";
import { EquipmentType } from "@shared/equipment/index.ts";
import { ResearchType } from "@shared/research/index.ts";
import { SteedType } from "@shared/steed/index.ts";

export type ParsedCommand =
  | { readonly type: "action"; readonly action: GameAction }
  | { readonly type: "select"; readonly position: TilePosition }
  | { readonly type: "inspect"; readonly position: TilePosition }
  | { readonly type: "help" }
  | { readonly type: "status" }
  | { readonly type: "board" }
  | { readonly type: "quit" }
  | { readonly type: "error"; readonly message: string };

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

    case "board":
    case "show":
      return { type: "board" };

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
      const firstStr = parts.at(1);
      const secondStr = parts.at(2);
      if (firstStr === undefined) {
        return { type: "error", message: "Usage: move <from> <to> or select first then move <to>" };
      }
      // Two-argument form: move <from> <to>
      if (secondStr !== undefined) {
        const from = parsePosition(firstStr);
        const to = parsePosition(secondStr);
        if (from === null || to === null) {
          return { type: "error", message: "Invalid position. Use: row,col row,col" };
        }
        return {
          type: "action",
          action: { type: "move", player: currentPlayer, from, to },
        };
      }
      // One-argument form: move <to> (requires selection)
      if (selectedPosition === undefined) {
        return { type: "error", message: "No unit selected. Use: select <row>,<col> first or move <from> <to>" };
      }
      const position = parsePosition(firstStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "move", player: currentPlayer, from: selectedPosition, to: position },
      };
    }

    case "attack":
    case "a": {
      const firstStr = parts.at(1);
      const secondStr = parts.at(2);
      if (firstStr === undefined) {
        return { type: "error", message: "Usage: attack <attacker> <target> or select first then attack <target>" };
      }
      // Two-argument form: attack <attacker> <target>
      if (secondStr !== undefined) {
        const attackerPosition = parsePosition(firstStr);
        const targetPosition = parsePosition(secondStr);
        if (attackerPosition === null || targetPosition === null) {
          return { type: "error", message: "Invalid position. Use: row,col row,col" };
        }
        return {
          type: "action",
          action: { type: "attack", player: currentPlayer, attackerPosition, targetPosition },
        };
      }
      // One-argument form: attack <target> (requires selection)
      if (selectedPosition === undefined) {
        return { type: "error", message: "No unit selected. Use: select <row>,<col> first or attack <from> <to>" };
      }
      const targetPosition = parsePosition(firstStr);
      if (targetPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "attack", player: currentPlayer, attackerPosition: selectedPosition, targetPosition },
      };
    }

    case "build":
    case "b": {
      const buildingName = parts.at(1);
      const posStr = parts.at(2);
      if (buildingName === undefined || posStr === undefined) {
        return { type: "error", message: "Usage: build <house|tower|wall|church> <row>,<col>" };
      }
      const position = parsePosition(posStr);
      if (position === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const buildingType = parseBuildingType(buildingName);
      if (buildingType === null) {
        return { type: "error", message: `Unknown building: ${buildingName}. Options: house, tower, wall, church` };
      }
      return {
        type: "action",
        action: { type: "build", player: currentPlayer, buildingType, position },
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
        action: { type: "spawnPeasant", player: currentPlayer, position },
      };
    }

    case "craft": {
      const equipName = parts.at(1);
      const posStr = parts.at(2);
      if (equipName === undefined || posStr === undefined) {
        return { type: "error", message: "Usage: craft <sword|shield|bow> <row>,<col>" };
      }
      const piecePosition = parsePosition(posStr);
      if (piecePosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const equipmentType = parseEquipmentType(equipName);
      if (equipmentType === null) {
        return { type: "error", message: `Unknown equipment: ${equipName}. Options: sword, shield, bow` };
      }
      return {
        type: "action",
        action: { type: "craftEquipment", player: currentPlayer, equipmentType, piecePosition },
      };
    }

    case "steed": {
      const steedName = parts.at(1);
      const houseStr = parts.at(2);
      const targetStr = parts.at(3);
      if (steedName === undefined || houseStr === undefined || targetStr === undefined) {
        return { type: "error", message: "Usage: steed <horse|boat> <houseRow>,<houseCol> <targetRow>,<targetCol>" };
      }
      const housePosition = parsePosition(houseStr);
      const targetPosition = parsePosition(targetStr);
      if (housePosition === null || targetPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const steedType = parseSteedType(steedName);
      if (steedType === null) {
        return { type: "error", message: `Unknown steed: ${steedName}. Options: horse, boat` };
      }
      return {
        type: "action",
        action: { type: "buySteed", player: currentPlayer, steedType, housePosition, targetPosition },
      };
    }

    case "train": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: train <row>,<col>" };
      }
      const churchPosition = parsePosition(posStr);
      if (churchPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "trainPriest", player: currentPlayer, churchPosition },
      };
    }

    case "heal": {
      const priestStr = parts.at(1);
      const targetStr = parts.at(2);
      if (priestStr === undefined || targetStr === undefined) {
        return { type: "error", message: "Usage: heal <priestRow>,<priestCol> <targetRow>,<targetCol>" };
      }
      const priestPosition = parsePosition(priestStr);
      const targetPosition = parsePosition(targetStr);
      if (priestPosition === null || targetPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "heal", player: currentPlayer, priestPosition, targetPosition },
      };
    }

    case "research": {
      const researchName = parts.at(1);
      const posStr = parts.at(2);
      if (researchName === undefined || posStr === undefined) {
        return { type: "error", message: "Usage: research <speed|mining2|mining3|queen> <row>,<col>" };
      }
      const castlePosition = parsePosition(posStr);
      if (castlePosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      const researchType = parseResearchType(researchName);
      if (researchType === null) {
        return { type: "error", message: `Unknown research: ${researchName}. Options: speed, mining2, mining3, queen` };
      }
      return {
        type: "action",
        action: { type: "research", player: currentPlayer, researchType, castlePosition },
      };
    }

    case "enter": {
      const kingStr = parts.at(1);
      const towerStr = parts.at(2);
      if (kingStr === undefined || towerStr === undefined) {
        return { type: "error", message: "Usage: enter <kingRow>,<kingCol> <towerRow>,<towerCol>" };
      }
      const kingPosition = parsePosition(kingStr);
      const towerPosition = parsePosition(towerStr);
      if (kingPosition === null || towerPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "enterTower", player: currentPlayer, kingPosition, towerPosition },
      };
    }

    case "summon": {
      const posStr = parts.at(1);
      if (posStr === undefined) {
        return { type: "error", message: "Usage: summon <row>,<col>" };
      }
      const churchPosition = parsePosition(posStr);
      if (churchPosition === null) {
        return { type: "error", message: "Invalid position. Use: row,col" };
      }
      return {
        type: "action",
        action: { type: "summonArchAngel", player: currentPlayer, churchPosition },
      };
    }

    default:
      return { type: "error", message: `Unknown command: "${command}". Type "help" for commands.` };
  }
};

const parseBuildingType = (name: string): BuildingType | null => {
  switch (name) {
    case "house": return BuildingType.house;
    case "tower": return BuildingType.tower;
    case "wall": return BuildingType.wall;
    case "church": return BuildingType.church;
    case "castle": return BuildingType.castle;
    default: return null;
  }
};

const parseEquipmentType = (name: string): EquipmentType | null => {
  switch (name) {
    case "sword": return EquipmentType.sword;
    case "shield": return EquipmentType.shield;
    case "bow": return EquipmentType.bow;
    default: return null;
  }
};

const parseSteedType = (name: string): SteedType | null => {
  switch (name) {
    case "horse": return SteedType.horse;
    case "boat": return SteedType.boat;
    default: return null;
  }
};

const parseResearchType = (name: string): ResearchType | null => {
  switch (name) {
    case "speed": return ResearchType.speed;
    case "mining2": return ResearchType.miningII;
    case "mining3": return ResearchType.miningIII;
    case "queen": return ResearchType.queen;
    default: return null;
  }
};
