import type { Game } from "@shared/game/types";
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
export const processAction = ({
  game,
  action,
}: {
  game: Game;
  action: GameAction;
}): { result: ActionResult; updatedGame: Game } => {
  const engine = new GameEngine(game);

  const result = ((): ActionResult => {
    switch (action.type) {
      case "click":
        return handleClickAction({ engine, action });
      case "build":
        return handleBuildAction({ engine, action });
      case "createPeasant":
        return handleCreatePeasantAction({ engine, action });
      case "upgrade":
        return handleUpgradeAction({ engine, action });
      case "attack":
        return handleAttackAction({ engine, action });
      default:
        return { success: false, error: "Unknown action type" };
    }
  })();

  return {
    result,
    updatedGame: engine.getGameState(),
  };
};

const handleClickAction = ({
  engine,
  action,
}: {
  engine: GameEngine;
  action: ClickAction;
}): ActionResult => {
  return engine.handleClick(
    action.player,
    action.position,
    action.selectedPosition,
  );
};

const handleBuildAction = ({
  engine,
  action,
}: {
  engine: GameEngine;
  action: BuildAction;
}): ActionResult => {
  return engine.handleBuild(
    action.player,
    action.buildingType,
    action.position,
    action.selectedPosition,
  );
};

const handleCreatePeasantAction = ({
  engine,
  action,
}: {
  engine: GameEngine;
  action: CreatePeasantAction;
}): ActionResult => {
  return engine.handleCreatePeasant(action.player, action.position);
};

const handleUpgradeAction = ({
  engine,
  action,
}: {
  engine: GameEngine;
  action: UpgradeAction;
}): ActionResult => {
  return engine.handleUpgrade(
    action.player,
    action.position,
    action.targetType,
  );
};

const handleAttackAction = ({
  engine,
  action,
}: {
  engine: GameEngine;
  action: AttackAction;
}): ActionResult => {
  return engine.handleAttack(
    action.player,
    action.position,
    action.selectedPosition,
  );
};
