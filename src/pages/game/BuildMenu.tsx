import { BuildingType, buildingCostOf } from "@shared/building";
import { EquipmentType, createEquipment } from "@shared/equipment";
import { PieceKind, peasantSpawnCost, priestTrainCost, archAngelSummonCost } from "@shared/piece";
import { ResearchType, researchCostOf } from "@shared/research";
import { SteedType, createSteed } from "@shared/steed";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import { canAffordCost } from "@shared/resource";
import { createPlayer } from "@shared/player";
import type { Game } from "../../core/Board";
import { costEntries, type GameUiState, type TargetMode } from "../../core/ui-state";

const KIND_LABEL: Record<string, string> = { peasant: "Peasant", king: "King", priest: "Priest", archAngel: "Archangel" };

const Inspector = ({ ui }: { readonly ui: GameUiState }) => {
  const selected = ui.selected;
  if (selected === null) return null;
  const piece = selected.pieceInfo;
  const building = selected.buildingInfo;
  return (
    <section className="panel">
      <h2>Selected</h2>
      <dl className="inspector">
        <dt>Tile</dt>
        <dd>{selected.row},{selected.column} · {selected.landscape ?? "unknown"}</dd>
        {building !== null && (
          <>
            <dt>Building</dt>
            <dd>{building.type} · {building.owner} · view {building.viewRange}</dd>
          </>
        )}
        {piece !== null && (
          <>
            <dt>Piece</dt>
            <dd>{KIND_LABEL[piece.kind] ?? piece.kind} · {piece.owner}</dd>
            <dt>Hearts</dt>
            <dd>
              <span className="hearts" aria-label={`${piece.hearts} of ${piece.maxHearts}`}>
                {"♥".repeat(piece.hearts)}<span className="hearts--lost">{"♥".repeat(Math.max(0, piece.maxHearts - piece.hearts))}</span>
              </span>
            </dd>
            <dt>Attack / Defense</dt>
            <dd>{piece.attack} / {piece.defense}</dd>
            <dt>Range / View / Move</dt>
            <dd>{piece.attackRange} / {piece.viewRange} / {piece.move}</dd>
            {(piece.equipment.length > 0 || piece.steed !== null) && (
              <>
                <dt>Carrying</dt>
                <dd>{[...piece.equipment, ...(piece.steed !== null ? [piece.steed] : [])].join(", ")}</dd>
              </>
            )}
          </>
        )}
      </dl>
    </section>
  );
};

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
  readonly title?: string;
};

const ActionButton = ({ label, hotkey, cost, icon, active, enabled, onClick, title }: ActionButtonProps) => (
  <button
    type="button"
    className={`action-btn${active === true ? " action-btn--active" : ""}`}
    disabled={!enabled}
    onClick={onClick}
    title={title}
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
  const targetButton = (label: string, hotkey: string, mode: TargetMode, cost: ResourceMap, hint: string) => (
    <ActionButton
      label={ui.pendingTarget === mode ? `${label} — click a tile` : label}
      hotkey={hotkey}
      cost={cost}
      active={ui.pendingTarget === mode}
      enabled={can(cost)}
      onClick={() => game.setPendingTarget(mode)}
      title={hint}
    />
  );

  return (
    <>
      <Inspector ui={ui} />
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
            {targetButton("Buy horse", "O", "horse", createSteed(SteedType.horse).cost, "Placed on a tile next to the house")}
            {targetButton("Buy boat", "F", "boat", createSteed(SteedType.boat).cost, "Placed on water next to the house")}
          </div>
          <p className="hint">Steeds are placed on a tile next to the house; a piece mounts one by moving onto it.</p>
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

      {selected !== null && selected.piece === PieceKind.king && (
        <section className="panel">
          <h2>King</h2>
          <div className="action-list">
            {targetButton("Enter tower", "E", "enterTower", createResourceMap({}), "Turns an adjacent tower into your castle")}
          </div>
        </section>
      )}

      {selected !== null && selected.piece === PieceKind.priest && (
        <section className="panel">
          <h2>Priest</h2>
          <div className="action-list">
            {targetButton("Heal", "G", "heal", createResourceMap({ faith: 1 }), "Restores one heart to an adjacent ally")}
          </div>
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
