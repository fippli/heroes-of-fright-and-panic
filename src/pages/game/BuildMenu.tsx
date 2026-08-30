import { BuildingType, buildingCostOf } from "@shared/building";
import { EquipmentType, createEquipment } from "@shared/equipment";
import { PieceKind, peasantSpawnCost, priestTrainCost, archAngelSummonCost } from "@shared/piece";
import { ResearchType, researchCostOf } from "@shared/research";
import { SteedType, createSteed } from "@shared/steed";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import { canAffordCost } from "@shared/resource";
import { createPlayer } from "@shared/player";
import type { Game } from "../../core/Board";
import { costEntries, type GameUiState } from "../../core/ui-state";

const RESOURCE_ICON: Record<string, string> = {
  wood: "/img/wood.png",
  stone: "/img/stone.png",
  food: "/img/food.png",
  gold: "/img/gold.png",
};

const Cost = ({ cost }: { readonly cost: ResourceMap }) => {
  const entries = costEntries(cost);
  if (entries.length === 0) return <span className="cost cost--free">free</span>;
  return (
    <span className="cost">
      {entries.map(({ resource, amount }) => (
        <span key={resource} className="cost__entry" title={resource}>
          {RESOURCE_ICON[resource] !== undefined ? (
            <img src={RESOURCE_ICON[resource]} alt={resource} />
          ) : (
            <span className="cost__label">{resource}</span>
          )}
          {amount}
        </span>
      ))}
    </span>
  );
};

const affordable = (resources: ResourceMap, cost: ResourceMap): boolean =>
  canAffordCost(createPlayer({ type: "day", resources }), cost);

type ActionButtonProps = {
  readonly label: string;
  readonly hotkey?: string;
  readonly cost: ResourceMap;
  readonly icon?: string;
  readonly active?: boolean;
  readonly enabled: boolean;
  readonly onClick: () => void;
};

const ActionButton = ({ label, hotkey, cost, icon, active, enabled, onClick }: ActionButtonProps) => (
  <button
    type="button"
    className={`action-btn${active === true ? " action-btn--active" : ""}`}
    disabled={!enabled}
    onClick={onClick}
  >
    {icon !== undefined && <img className="action-btn__icon" src={icon} alt="" />}
    <span className="action-btn__label">{label}</span>
    {hotkey !== undefined && <kbd className="action-btn__key">{hotkey}</kbd>}
    <Cost cost={cost} />
  </button>
);

const BUILDINGS: readonly { readonly type: BuildingType; readonly label: string; readonly key: string }[] = [
  { type: BuildingType.house, label: "House", key: "H" },
  { type: BuildingType.tower, label: "Tower", key: "T" },
  { type: BuildingType.wall, label: "Wall", key: "W" },
  { type: BuildingType.church, label: "Church", key: "R" },
];

const RESEARCH: readonly { readonly type: ResearchType; readonly label: string; readonly key: string }[] = [
  { type: ResearchType.speed, label: "Speed", key: "4" },
  { type: ResearchType.miningII, label: "Mining II", key: "5" },
  { type: ResearchType.miningIII, label: "Mining III", key: "6" },
  { type: ResearchType.queen, label: "Queen", key: "7" },
];

export const BuildMenu = ({ game, ui }: { readonly game: Game; readonly ui: GameUiState }) => {
  if (!ui.isPlayer) return null;
  const can = (cost: ResourceMap): boolean => ui.isMyTurn && affordable(ui.resources, cost);
  const sprite = (type: BuildingType): string => game.imageAssets.buildingImage(game.player, type).image.src;
  const selected = ui.selected;
  const at = selected !== null ? { row: selected.row, column: selected.column } : null;

  return (
    <>
      <section className="panel">
        <h2>Turn</h2>
        <div className="action-list">
          <ActionButton
            label="Wait an hour"
            hotkey="Space"
            cost={createResourceMap({})}
            enabled={ui.isMyTurn}
            onClick={() => void game.passTurn(false)}
          />
          <ActionButton
            label="End phase"
            hotkey="⇧Space"
            cost={createResourceMap({})}
            enabled={ui.isMyTurn}
            onClick={() => void game.passTurn(true)}
          />
        </div>
        <p className="hint">Every action takes an hour; a phase is 12 hours. Waiting lets the clock run when there is nothing useful to do.</p>
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
            : "Pick a building, then click a tile inside your kingdom (what you can see)."}
        </p>
      </section>

      {selected !== null && at !== null && selected.building === BuildingType.house && (
        <section className="panel">
          <h2>House</h2>
          <div className="action-list">
            <ActionButton
              label="Spawn peasant"
              hotkey="P"
              cost={peasantSpawnCost()}
              enabled={can(peasantSpawnCost())}
              onClick={() => void game.spawnPeasantAt(at)}
            />
            <ActionButton
              label="Buy horse"
              hotkey="O"
              cost={createSteed(SteedType.horse).cost}
              enabled={false}
              onClick={() => undefined}
            />
            <ActionButton
              label="Buy boat"
              hotkey="F"
              cost={createSteed(SteedType.boat).cost}
              enabled={false}
              onClick={() => undefined}
            />
          </div>
          <p className="hint">Steeds: with the house selected, press O (horse) or F (boat) over the tile to place it on.</p>
        </section>
      )}

      {selected !== null && at !== null && selected.building === BuildingType.church && (
        <section className="panel">
          <h2>Church</h2>
          <div className="action-list">
            <ActionButton
              label="Train priest"
              hotkey="N"
              cost={priestTrainCost()}
              enabled={can(priestTrainCost())}
              onClick={() => void game.trainPriestAt(at)}
            />
            <ActionButton
              label="Summon archangel"
              hotkey="M"
              cost={archAngelSummonCost()}
              enabled={can(archAngelSummonCost())}
              onClick={() => void game.summonArchAngelAt(at)}
            />
          </div>
        </section>
      )}

      {selected !== null && at !== null && selected.building === BuildingType.castle && (
        <section className="panel">
          <h2>Castle research</h2>
          <div className="action-list">
            {RESEARCH.map(({ type, label, key }) => (
              <ActionButton
                key={type}
                label={label}
                hotkey={key}
                cost={researchCostOf(type)}
                enabled={can(researchCostOf(type))}
                onClick={() => void game.researchAt(type, at)}
              />
            ))}
          </div>
        </section>
      )}

      {selected !== null && selected.building === BuildingType.tower && (
        <section className="panel">
          <h2>Tower</h2>
          <p className="hint">Select your king, then press E over this tower to turn it into a castle.</p>
        </section>
      )}

      {selected !== null && at !== null && selected.piece === PieceKind.peasant && (
        <section className="panel">
          <h2>Equip peasant</h2>
          <div className="action-list">
            {[
              { type: EquipmentType.sword, label: "Sword", key: "S" },
              { type: EquipmentType.shield, label: "Shield", key: "D" },
              { type: EquipmentType.bow, label: "Bow", key: "B" },
            ].map(({ type, label, key }) => (
              <ActionButton
                key={type}
                label={label}
                hotkey={key}
                cost={createEquipment(type).cost}
                enabled={can(createEquipment(type).cost)}
                onClick={() => void game.craftEquipmentAt(type, at)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
};
