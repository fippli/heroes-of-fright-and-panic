import type { WithId } from "mongodb";
import type { Game } from "../database";
import type {
  GameAction,
  ActionResult,
  ClickAction,
  BuildAction,
  CreatePeasantAction,
  UpgradeAction,
  AttackAction,
} from "@shared/actions";
import { GameEngine } from "./engine";

/**
 * Process a game action and return the result
 */
export function processAction(
  game: WithId<Game>,
  action: GameAction,
): { result: ActionResult; updatedGame: WithId<Game> } {
  const engine = new GameEngine(game);

  let result: ActionResult;

  switch (action.type) {
    case "click":
      result = handleClickAction(engine, action);
      break;
    case "build":
      result = handleBuildAction(engine, action);
      break;
    case "createPeasant":
      result = handleCreatePeasantAction(engine, action);
      break;
    case "upgrade":
      result = handleUpgradeAction(engine, action);
      break;
    case "attack":
      result = handleAttackAction(engine, action);
      break;
    default:
      result = { success: false, error: "Unknown action type" };
  }

  return {
    result,
    updatedGame: engine.getGameState(),
  };
}

function handleClickAction(
  engine: GameEngine,
  action: ClickAction,
): ActionResult {
  return engine.handleClick(
    action.player,
    action.position,
    action.selectedPosition,
  );
}

function handleBuildAction(
  engine: GameEngine,
  action: BuildAction,
): ActionResult {
  return engine.handleBuild(
    action.player,
    action.buildingType,
    action.position,
    action.selectedPosition,
  );
}

function handleCreatePeasantAction(
  engine: GameEngine,
  action: CreatePeasantAction,
): ActionResult {
  return engine.handleCreatePeasant(action.player, action.position);
}

function handleUpgradeAction(
  engine: GameEngine,
  action: UpgradeAction,
): ActionResult {
  return engine.handleUpgrade(action.player, action.position, action.targetType);
}

function handleAttackAction(
  engine: GameEngine,
  action: AttackAction,
): ActionResult {
  return engine.handleAttack(
    action.player,
    action.position,
    action.selectedPosition,
  );
}
