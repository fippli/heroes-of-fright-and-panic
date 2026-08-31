import { BuildingType, buildingCostOf } from "@shared/building";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import type { Game } from "../../core/Board";
import type { GameUiState } from "../../core/ui-state";
import { ActionButton, affordable } from "./ActionButton";

const BUILDINGS: readonly { readonly type: BuildingType; readonly label: string; readonly key: string }[] = [
  { type: BuildingType.house, label: "House", key: "H" },
  { type: BuildingType.tower, label: "Tower", key: "T" },
  { type: BuildingType.wall, label: "Wall", key: "W" },
  { type: BuildingType.church, label: "Church", key: "R" },
  { type: BuildingType.dock, label: "Dock", key: "K" },
];

export const BuildMenu = ({ game, ui }: { readonly game: Game; readonly ui: GameUiState }) => {
  if (!ui.isPlayer) return null;
  const can = (cost: ResourceMap): boolean => ui.isMyTurn && affordable(ui.resources, cost);
  const sprite = (type: BuildingType): string => game.imageAssets.buildingImage(game.player, type).image.src;

  return (
    <>
      <section className="panel">
        <h2>Turn</h2>
        <div className="action-list">
          <ActionButton label="End phase" hotkey="Space" cost={createResourceMap({})} icons={ui.icons} enabled={ui.isMyTurn} onClick={() => void game.passTurn(true)} />
        </div>
        <p className="hint">Every piece and building may act once per phase. End the phase when you are done — night falls, production arrives, everything rests.</p>
      </section>

      <section className="panel">
        <h2>Build</h2>
        <div className="action-list">
          {BUILDINGS.map(({ type, label, key }) => (
            <ActionButton
              key={type}
              label={label}
              hotkey={key}
              cost={buildingCostOf(type)}
              icons={ui.icons}
              icon={sprite(type)}
              active={ui.pendingBuild === type}
              enabled={can(buildingCostOf(type))}
              onClick={() => game.setPendingBuild(type)}
            />
          ))}
        </div>
        <p className="hint">
          {ui.pendingBuild !== null
            ? "Click a highlighted tile to place it. Esc cancels."
            : "Pick a building, then click a tile inside your kingdom (what you can see). Docks go on sand by the water; a castle is made by walking your king into a tower."}
        </p>
      </section>
    </>
  );
};
