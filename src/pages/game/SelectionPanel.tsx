import { BuildingType, HOUSE_LEVEL_NAMES, houseUpgradeCost } from "@shared/building";
import { EquipmentType, createEquipment } from "@shared/equipment";
import { PieceKind, peasantSpawnCost, priestTrainCost, archAngelSummonCost } from "@shared/piece";
import { ResearchType, researchCostOf } from "@shared/research";
import { SteedType, createSteed } from "@shared/steed";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import type { Game } from "../../core/Board";
import { costEntries, type GameUiState, type TargetMode } from "../../core/ui-state";
import { ActionButton, affordable } from "./ActionButton";

const KIND_LABEL: Record<string, string> = { peasant: "Peasant", king: "King", priest: "Priest", archAngel: "Archangel" };
const BUILDING_LABEL: Record<string, string> = { house: "House", tower: "Tower", castle: "Castle", wall: "Wall", church: "Church", dock: "Dock" };
const ITEM_LABEL: Record<string, string> = { sword: "Sword", shield: "Shield", bow: "Bow", helmet: "Helmet", torso: "Cuirass", legs: "Greaves", horse: "Horse", boat: "Boat" };

const RESEARCH: readonly { readonly type: ResearchType; readonly label: string; readonly key: string }[] = [
  { type: ResearchType.speed, label: "Speed", key: "4" },
  { type: ResearchType.queen, label: "Queen", key: "7" },
];

type SlotProps = {
  readonly label: string;
  readonly item: string | null;
  readonly sprite: string | undefined;
  readonly side: "left" | "right";
  /** When set, an empty slot shows a + that buys the item */
  readonly buy?: {
    readonly cost: ResourceMap;
    readonly enabled: boolean;
    readonly hotkey: string;
    readonly onBuy: () => void;
  };
  readonly icons: Record<string, string>;
};

/** One paper-doll slot: the item's sprite when carried, otherwise an empty diamond with a + to buy it */
const Slot = ({ label, item, sprite, side, buy, icons }: SlotProps) => {
  const costText = buy !== undefined ? costEntries(buy.cost).map((entry) => `${entry.amount} ${entry.resource}`).join(", ") : "";
  return (
    <div className={`doll__slot doll__slot--${side}${item !== null ? " doll__slot--filled" : ""}`}>
      <div className="doll__diamond" title={item !== null ? ITEM_LABEL[item] ?? item : buy !== undefined ? `Buy ${label.toLowerCase()} — ${costText} (${buy.hotkey})` : `${label}: empty`}>
        {item !== null && sprite !== undefined && <img src={sprite} alt={ITEM_LABEL[item] ?? item} />}
        {item === null && buy !== undefined && (
          <button type="button" className="doll__buy" disabled={!buy.enabled} onClick={buy.onBuy} aria-label={`Buy ${label.toLowerCase()}`}>
            +
          </button>
        )}
      </div>
      <span className="doll__label">{item !== null ? ITEM_LABEL[item] ?? item : label}</span>
      {item === null && buy !== undefined && (
        <span className="doll__cost">
          {costEntries(buy.cost).map(({ resource, amount }) => (
            <span key={resource}><img src={icons[resource]} alt={resource} />{amount}</span>
          ))}
        </span>
      )}
    </div>
  );
};

/**
 * Slides in from the left of the board when a tile is selected. Pieces get a
 * paper-doll with equipment slots and stats; own buildings get their actions.
 */
export const SelectionPanel = ({ game, ui }: { readonly game: Game; readonly ui: GameUiState }) => {
  const selected = ui.selected;
  const open = selected !== null;
  const piece = selected?.pieceInfo ?? null;
  const building = selected?.buildingInfo ?? null;
  const at = selected !== null ? { row: selected.row, column: selected.column } : null;
  const ownPiece = selected?.piece ?? null;
  const ownBuilding = selected?.building ?? null;
  const can = (cost: ResourceMap): boolean => ui.isPlayer && ui.isMyTurn && affordable(ui.resources, cost);
  const icons = ui.icons;

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

  const title =
    piece !== null
      ? KIND_LABEL[piece.kind] ?? piece.kind
      : building !== null
        ? building.type === BuildingType.house
          ? HOUSE_LEVEL_NAMES[building.level] ?? "House"
          : BUILDING_LABEL[building.type] ?? building.type
        : selected?.landscape ?? "Tile";
  const owner = piece?.owner ?? building?.owner ?? null;

  const has = (item: string): string | null =>
    piece !== null && (piece.equipment.includes(item) || piece.steed === item) ? item : null;

  // Only your own peasant can be equipped; the + buys the item straight away
  const buyFor = (type: EquipmentType, hotkey: string) =>
    ownPiece === PieceKind.peasant && at !== null
      ? {
          cost: createEquipment(type).cost,
          enabled: can(createEquipment(type).cost),
          hotkey: hotkey === "" ? "click" : hotkey,
          onBuy: () => void game.craftEquipmentAt(type, at),
        }
      : undefined;

  return (
    <aside className={`selection${open ? " selection--open" : ""}`} aria-hidden={!open}>
      {selected !== null && (
        <>
          <header className="selection__head">
            <div>
              <h2>{title}</h2>
              <span className="selection__meta">
                {owner !== null && <span className={`owner owner--${owner}`}>{owner}</span>}
                {selected.row},{selected.column} · {selected.landscape ?? "?"}
              </span>
            </div>
            <button type="button" className="action-btn selection__close" onClick={() => game.cancel()} title="Close (Esc)">×</button>
          </header>

          {piece !== null && (
            <section className="doll">
              <div className="doll__column">
                <Slot label="Helmet" item={has("helmet")} sprite={ui.sprites.items.helmet} side="left" icons={icons} buy={buyFor(EquipmentType.helmet, "")} />
                <Slot label="Cuirass" item={has("torso")} sprite={ui.sprites.items.torso} side="left" icons={icons} buy={buyFor(EquipmentType.torso, "")} />
                <Slot label="Greaves" item={has("legs")} sprite={ui.sprites.items.legs} side="left" icons={icons} buy={buyFor(EquipmentType.legs, "")} />
              </div>
              <div className="doll__figure">
                {ui.sprites.piece !== null && <img src={ui.sprites.piece} alt={title} />}
                <div className="doll__hearts" aria-label={`${piece.hearts} of ${piece.maxHearts} hearts`}>
                  {Array.from({ length: piece.maxHearts }, (_, index) => (
                    <span key={index} className={index < piece.hearts ? "heart" : "heart heart--lost"}>♥</span>
                  ))}
                </div>
              </div>
              <div className="doll__column">
                <Slot label="Sword" item={has("sword")} sprite={ui.sprites.items.sword} side="right" icons={icons} buy={buyFor(EquipmentType.sword, "S")} />
                <Slot label="Shield" item={has("shield")} sprite={ui.sprites.items.shield} side="right" icons={icons} buy={buyFor(EquipmentType.shield, "D")} />
                <Slot label="Bow" item={has("bow")} sprite={ui.sprites.items.bow} side="right" icons={icons} buy={buyFor(EquipmentType.bow, "B")} />
              </div>
              <div className="doll__foot">
                <Slot label="Steed" item={piece.steed} sprite={piece.steed !== null ? ui.sprites.items[piece.steed] : undefined} side="right" icons={icons} />
              </div>
            </section>
          )}

          {piece !== null && (
            <dl className="stats">
              <div><dt>Attack</dt><dd>{piece.attack}</dd></div>
              <div><dt>Defense</dt><dd>{piece.defense}</dd></div>
              <div><dt>Range</dt><dd>{piece.attackRange}</dd></div>
              <div><dt>View</dt><dd>{piece.viewRange}</dd></div>
              <div><dt>Move</dt><dd>{piece.move}</dd></div>
            </dl>
          )}

          {ownPiece === PieceKind.peasant && (
            <p className="hint">Steeds are bought at a house and mounted by walking onto them.</p>
          )}

          {ownPiece === PieceKind.king && (
            <section className="selection__actions">
              <h3>King</h3>
              {targetButton("Enter tower", "E", "enterTower", createResourceMap({}), "Turns an adjacent tower into your castle")}
            </section>
          )}

          {ownPiece === PieceKind.priest && (
            <section className="selection__actions">
              <h3>Priest</h3>
              {targetButton("Heal", "G", "heal", createResourceMap({ faith: 1 }), "Restores one heart to an adjacent ally")}
            </section>
          )}

          {selected.steed !== null && piece === null && (
            <div className="selection__portrait">
              {ui.sprites.items[selected.steed] !== undefined && <img src={ui.sprites.items[selected.steed]} alt={selected.steed} />}
              <span className="selection__meta">A {ITEM_LABEL[selected.steed]?.toLowerCase() ?? selected.steed} waits here — move a piece onto this tile to mount it.</span>
            </div>
          )}

          {building !== null && piece === null && ui.sprites.building !== null && (
            <div className="selection__portrait">
              <img src={ui.sprites.building} alt={title} />
              <span className="selection__meta">view range {building.viewRange}</span>
            </div>
          )}

          {ownBuilding === BuildingType.house && at !== null && building !== null && (
            <section className="selection__actions">
              <h3>{HOUSE_LEVEL_NAMES[building.level] ?? "House"}</h3>
              {houseUpgradeCost(building.level) !== null && (
                <ActionButton
                  label={`Upgrade to ${HOUSE_LEVEL_NAMES[building.level + 1]}`}
                  hotkey="U"
                  cost={houseUpgradeCost(building.level) as ResourceMap}
                  icons={icons}
                  enabled={can(houseUpgradeCost(building.level) as ResourceMap)}
                  onClick={() => void game.upgradeBuildingAt(at)}
                  title={building.level === 1 ? "Homestead: +2 stone and +1 iron per adjacent mountain" : "Manor: +1 gold per mountain, double wood and food"}
                />
              )}
              <ActionButton label="Spawn peasant" hotkey="P" cost={peasantSpawnCost()} icons={icons} enabled={can(peasantSpawnCost())} onClick={() => void game.spawnPeasantAt(at)} />
              {targetButton("Buy horse", "O", "horse", createSteed(SteedType.horse).cost, "Placed on a tile next to the house")}
            </section>
          )}

          {ownBuilding === BuildingType.dock && at !== null && (
            <section className="selection__actions">
              <h3>Dock</h3>
              {targetButton("Build boat", "F", "boat", createSteed(SteedType.boat).cost, "Placed on water next to the dock; a piece mounts it by moving onto it")}
            </section>
          )}

          {ownBuilding === BuildingType.church && at !== null && (
            <section className="selection__actions">
              <h3>Church</h3>
              <ActionButton label="Train priest" hotkey="N" cost={priestTrainCost()} icons={icons} enabled={can(priestTrainCost())} onClick={() => void game.trainPriestAt(at)} />
              <ActionButton label="Summon archangel" hotkey="M" cost={archAngelSummonCost()} icons={icons} enabled={can(archAngelSummonCost())} onClick={() => void game.summonArchAngelAt(at)} />
            </section>
          )}

          {ownBuilding === BuildingType.castle && at !== null && (
            <section className="selection__actions">
              <h3>Research</h3>
              {RESEARCH.map(({ type, label, key }) => (
                <ActionButton key={type} label={label} hotkey={key} cost={researchCostOf(type)} icons={icons} enabled={can(researchCostOf(type))} onClick={() => void game.researchAt(type, at)} />
              ))}
            </section>
          )}

          {ownBuilding === BuildingType.tower && (
            <section className="selection__actions">
              <h3>Tower</h3>
              <p className="hint">Select your king next to this tower and use Enter tower to make it a castle.</p>
            </section>
          )}
        </>
      )}
    </aside>
  );
};
