import { BuildingType, HOUSE_LEVEL_NAMES, houseUpgradeCost, CASTLE_LEVEL_NAMES, castleUpgradeCost, TOWER_LEVEL_NAMES, towerUpgradeCost } from "@shared/building";
import { peasantSpawnCost, priestTrainCost, archAngelSummonCost } from "@shared/piece";
import { ResearchType, researchCostOf } from "@shared/research";
import { SteedType, createSteed } from "@shared/steed";
import type { ResourceMap } from "@shared/player/resource-map";
import type { Game } from "../../core/Board";
import type { GameUiState, TargetMode } from "../../core/ui-state";
import { ActionButton, affordable } from "./ActionButton";

const RESEARCH: readonly { readonly type: ResearchType; readonly label: string; readonly key: string }[] = [
  { type: ResearchType.queen, label: "Queen", key: "7" },
];

const BUILDING_LABEL: Record<string, string> = { house: "House", tower: "Tower", castle: "Castle", wall: "Wall", church: "Church", dock: "Dock" };

/**
 * The selected building, shown entirely in the right sidebar next to the
 * build menu: its identity, and its actions when it is yours (the left
 * panel is for pieces only).
 */
export const BuildingActions = ({ game, ui }: { readonly game: Game; readonly ui: GameUiState }) => {
  const selected = ui.selected;
  const building = selected?.buildingInfo ?? null;
  const ownBuilding = selected?.building ?? null;
  const at = selected !== null ? { row: selected.row, column: selected.column } : null;
  if (building === null || at === null) return null;

  const title =
    building.type === BuildingType.house
      ? HOUSE_LEVEL_NAMES[building.level] ?? "House"
      : building.type === BuildingType.castle
        ? CASTLE_LEVEL_NAMES[building.level] ?? "Castle"
        : building.type === BuildingType.tower
          ? TOWER_LEVEL_NAMES[building.level] ?? "Tower"
          : BUILDING_LABEL[building.type] ?? building.type;

  const icons = ui.icons;
  const can = (cost: ResourceMap): boolean => ui.isPlayer && ui.isMyTurn && affordable(ui.resources, cost);

  const targetButton = (label: string, hotkey: string, mode: TargetMode, cost: ResourceMap, hint: string) => (
    <ActionButton
      label={ui.pendingTarget === mode ? `${label} — click a tile` : label}
      hotkey={hotkey}
      cost={cost}
      icons={icons}
      active={ui.pendingTarget === mode}
      enabled={can(cost)}
      onClick={() => game.setPendingTarget(mode)}
      title={hint}
    />
  );

  return (
    <section className="panel">
      <header className="selection__head">
        <div>
          <h2>{title}</h2>
          <span className="selection__meta">
            <span className={`owner owner--${building.owner}`}>{building.owner}</span>
            {at.row},{at.column} · view range {building.viewRange}
          </span>
        </div>
        {ui.sprites.building !== null && (
          <img src={ui.sprites.building} alt={title} style={{ width: 48, height: 48, imageRendering: "pixelated" }} />
        )}
      </header>

      {ownBuilding === BuildingType.house && (
        <div className="selection__actions">
          <h3>{HOUSE_LEVEL_NAMES[building.level] ?? "House"}</h3>
          {houseUpgradeCost(building.level) !== null && (
            <ActionButton
              label={`Upgrade to ${HOUSE_LEVEL_NAMES[building.level + 1]}`}
              hotkey="U"
              cost={houseUpgradeCost(building.level) as ResourceMap}
              icons={icons}
              enabled={can(houseUpgradeCost(building.level) as ResourceMap) && !building.acted}
              onClick={() => void game.upgradeBuildingAt(at)}
              title={building.level === 1 ? "Homestead: +2 stone and +1 iron per adjacent mountain" : "Manor: +1 gold per mountain, double wood and food"}
            />
          )}
          <ActionButton label="Spawn peasant" hotkey="P" cost={peasantSpawnCost()} icons={icons} enabled={can(peasantSpawnCost()) && building.acted !== true} onClick={() => void game.spawnPeasantAt(at)} />
          {targetButton("Buy horse", "O", "horse", createSteed(SteedType.horse).cost, "Placed on a tile next to the house")}
        </div>
      )}

      {ownBuilding === BuildingType.dock && (
        <div className="selection__actions">
          <h3>Dock</h3>
          {targetButton("Build boat", "F", "boat", createSteed(SteedType.boat).cost, "Placed on water next to the dock; a piece mounts it by moving onto it")}
        </div>
      )}

      {ownBuilding === BuildingType.church && (
        <div className="selection__actions">
          <h3>Church</h3>
          <ActionButton label="Train priest" hotkey="N" cost={priestTrainCost()} icons={icons} enabled={can(priestTrainCost()) && building.acted !== true} onClick={() => void game.trainPriestAt(at)} />
          <ActionButton label="Summon archangel" hotkey="M" cost={archAngelSummonCost()} icons={icons} enabled={can(archAngelSummonCost()) && building.acted !== true} onClick={() => void game.summonArchAngelAt(at)} />
        </div>
      )}

      {ownBuilding === BuildingType.tower && (
        <div className="selection__actions">
          <h3>{TOWER_LEVEL_NAMES[building.level] ?? "Tower"}</h3>
          {towerUpgradeCost(building.level) !== null ? (
            <ActionButton
              label={`Upgrade to ${TOWER_LEVEL_NAMES[building.level + 1]}`}
              hotkey="U"
              cost={towerUpgradeCost(building.level) as ResourceMap}
              icons={icons}
              enabled={can(towerUpgradeCost(building.level) as ResourceMap) && !building.acted}
              onClick={() => void game.upgradeBuildingAt(at)}
              title={building.level === 1 ? "Watchtower: view and bow range 3, defense 2" : "Beacon: view and bow range 4, defense 3"}
            />
          ) : (
            <p className="hint">This beacon watches as far as towers can.</p>
          )}
          <p className="hint">A bow inside shoots as far as the tower sees (range {building.viewRange}).</p>
        </div>
      )}

      {ownBuilding === BuildingType.castle && (
        <div className="selection__actions">
          <h3>{CASTLE_LEVEL_NAMES[building.level] ?? "Castle"}</h3>
          {castleUpgradeCost(building.level) !== null && (
            <ActionButton
              label={`Upgrade to ${CASTLE_LEVEL_NAMES[building.level + 1]}`}
              hotkey="U"
              cost={castleUpgradeCost(building.level) as ResourceMap}
              icons={icons}
              enabled={can(castleUpgradeCost(building.level) as ResourceMap) && !building.acted}
              onClick={() => void game.upgradeBuildingAt(at)}
              title={building.level === 1 ? "Castle: +1 view and defense, unlocks research" : "Citadel: +1 view and defense"}
            />
          )}
          {building.level >= 2 ? (
            RESEARCH.map(({ type, label, key }) => (
              <ActionButton key={type} label={label} hotkey={key} cost={researchCostOf(type)} icons={icons} enabled={can(researchCostOf(type)) && !building.acted} onClick={() => void game.researchAt(type, at)} />
            ))
          ) : (
            <p className="hint">Research unlocks once your Keep becomes a Castle.</p>
          )}
          <p className="hint">If this falls, the kingdom falls with it.</p>
        </div>
      )}
    </section>
  );
};
