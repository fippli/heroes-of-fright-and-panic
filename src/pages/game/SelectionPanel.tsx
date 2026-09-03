import { BuildingType, HOUSE_LEVEL_NAMES, CASTLE_LEVEL_NAMES, TOWER_LEVEL_NAMES } from "@shared/building";
import { EquipmentType, createEquipment } from "@shared/equipment";
import { PieceKind } from "@shared/piece";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import type { Game } from "../../core/Board";
import { costEntries, type GameUiState, type TargetMode } from "../../core/ui-state";
import { ActionButton, affordable } from "./ActionButton";

const KIND_LABEL: Record<string, string> = { peasant: "Peasant", king: "King", priest: "Priest", archAngel: "Archangel" };
const BUILDING_LABEL: Record<string, string> = { house: "House", tower: "Tower", castle: "Castle", wall: "Wall", church: "Church", dock: "Dock" };
const ITEM_LABEL: Record<string, string> = { sword: "Sword", shield: "Shield", bow: "Bow", helmet: "Helmet", torso: "Cuirass", legs: "Greaves", horse: "Horse", boat: "Boat" };

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
 * Sidebar inventory for the selected tile. Pieces get a paper-doll with
 * equipment slots and stats; own buildings get their actions.
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
  const pieceCan = (cost: ResourceMap): boolean => can(cost) && piece?.acted !== true;
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
          : building.type === BuildingType.castle
            ? CASTLE_LEVEL_NAMES[building.level] ?? "Castle"
            : building.type === BuildingType.tower
              ? TOWER_LEVEL_NAMES[building.level] ?? "Tower"
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
          enabled: pieceCan(createEquipment(type).cost),
          hotkey: hotkey === "" ? "click" : hotkey,
          onBuy: () => void game.craftEquipmentAt(type, at),
        }
      : undefined;

  return (
    <section className="selection">
      {!open && (
        <p className="hint">Select one of your pieces or buildings to see it here. Grab a piece to move it.</p>
      )}
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
                {piece.acted && <span className="acted-tag">has acted</span>}
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

          {ownBuilding !== null && building !== null && (
            <p className="hint">This building's actions are in the menu on the right.</p>
          )}
        </>
      )}
    </section>
  );
};
