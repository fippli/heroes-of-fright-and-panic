/**
 * Turn a recorded game event into one line a player can read.
 */
import type { GameAction, TilePosition } from "../actions/index.ts";
import type { GameEvent } from "./events.ts";

const side = (player: string | null): string =>
  player === "day" ? "Day" : player === "night" ? "Night" : "Someone";

const at = (position: TilePosition): string => `${position.row},${position.column}`;

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Positions an event concerns, for fog-of-war filtering */
export const eventPositions = (action: GameAction | null): ReadonlyArray<TilePosition> => {
  if (action === null) return [];
  switch (action.type) {
    case "move": return [action.from, action.to];
    case "build": return [action.position];
    case "spawnPeasant": return [action.position];
    case "craftEquipment": return [action.piecePosition];
    case "buySteed": return [action.housePosition, action.targetPosition];
    case "trainPriest": return [action.churchPosition];
    case "heal": return [action.priestPosition, action.targetPosition];
    case "research": return [action.castlePosition];
    case "enterTower": return [action.kingPosition, action.towerPosition];
    case "summonArchAngel": return [action.churchPosition];
    case "attack": return [action.attackerPosition, action.targetPosition];
    case "pass": return [];
    default: return [];
  }
};

export const describeAction = (player: string | null, action: GameAction): string => {
  const who = side(player);
  switch (action.type) {
    case "move": return `${who} moved a piece ${at(action.from)} → ${at(action.to)}`;
    case "build": return `${who} built a ${action.buildingType} at ${at(action.position)}`;
    case "spawnPeasant": return `${who} spawned a peasant at ${at(action.position)}`;
    case "craftEquipment": return `${who} equipped a ${action.equipmentType} at ${at(action.piecePosition)}`;
    case "buySteed": return `${who} bought a ${action.steedType} at ${at(action.targetPosition)}`;
    case "trainPriest": return `${who} trained a priest at ${at(action.churchPosition)}`;
    case "heal": return `${who} healed a piece at ${at(action.targetPosition)}`;
    case "research": return `${who} researched ${action.researchType}`;
    case "enterTower": return `${who}'s king entered the tower at ${at(action.towerPosition)} — it is a castle now`;
    case "summonArchAngel": return `${who} summoned an archangel at ${at(action.churchPosition)}`;
    case "attack": return `${who} attacked ${at(action.targetPosition)} from ${at(action.attackerPosition)}`;
    case "pass": return action.toPhaseEnd === true ? `${who} ended their phase` : `${who} waited an hour`;
    default: return `${who} acted`;
  }
};

export const describeEvent = (event: GameEvent): string => {
  switch (event.kind) {
    case "created":
      return "The game began";
    case "error":
      return "Something went wrong on the server";
    case "action":
    case "ai": {
      if (event.action === null) {
        return event.result?.error !== undefined ? capitalise(event.result.error) : `${side(event.player)} acted`;
      }
      const line = describeAction(event.player, event.action);
      if (event.result !== null && !event.result.success) {
        return `${line} — refused: ${event.result.error ?? "unknown reason"}`;
      }
      return line;
    }
    default:
      return "";
  }
};
