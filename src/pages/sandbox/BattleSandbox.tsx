import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Flex, Box, VStack, HStack, Text, Heading, Button, NativeSelect, Input } from "@chakra-ui/react";
import { Canvas } from "../../canvas";
import { Hexagon } from "../../core/Hexagon";
import { Landscape } from "../../core/Landscape";
import { Tile } from "../../core/Tile";
import { Piece } from "../../core/Piece";
import { Building } from "../../core/Building";
import { defaultImageAssets } from "../../images";
import { createPlayer } from "@shared/player";
import { PieceKind, getPieceAttack, getPieceAttackRange, getPieceDefense, getPieceMove } from "@shared/piece";
import { BuildingType, TOWER_LEVEL_NAMES } from "@shared/building";
import { LandscapeType } from "@shared/map/landscape";
import { findNeighbors } from "@shared/map/hex";
import { MAX_DEFENDERS, SIEGE_MAX_ROUNDS, attackerUnit, towerDefenderUnit } from "@shared/siege";
import type { PlayerType } from "@shared/piece";
import {
  ARMY_PRESETS,
  BATTLEFIELD_COLUMNS,
  BATTLEFIELD_ROWS,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type BattleTile,
  type BattleUnit,
  activeUnit,
  applyBattleAction,
  attackableEnemies,
  chooseBattleAction,
  createBattle,
  createBattleOnField,
  createPieceFromSpec,
  deployArmy,
  describeUnit,
  findArmyPreset,
  generateBattlefield,
  findUnit,
  healableAllies,
  isUnitAlive,
  reachableTiles,
  unitAt,
} from "@shared/battle";
import type { Coordinate } from "../../types/coordinate";

// ============================================
// SETUP
// ============================================

type Controller = "human" | "ai";

/** Open field, or a tower in the middle held by one side */
type Ground = "field" | "siege-night" | "siege-day";

type Setup = {
  readonly seed: string;
  readonly ground: Ground;
  readonly towerLevel: number;
  readonly dayArmy: string;
  readonly nightArmy: string;
  readonly dayController: Controller;
  readonly nightController: Controller;
};

const randomSeed = (): string => Math.random().toString(36).slice(2, 8);

const DEFAULT_SETUP: Setup = {
  seed: "meadow",
  ground: "field",
  towerLevel: 1,
  dayArmy: "men-at-arms",
  nightArmy: "men-at-arms",
  dayController: "human",
  nightController: "ai",
};

/** Delay before the AI acts, so a spectator can follow what happens */
const AI_STEP_MS = 550;

/**
 * A siege on the sandbox field: the holder's first few pieces stand on and
 * around a tower in the middle with the tower's advantages, the other army
 * storms in from its edge.
 */
const startSiege = (setup: Setup, holder: PlayerType): BattleState => {
  const attacker: PlayerType = holder === "day" ? "night" : "day";
  const columns = BATTLEFIELD_COLUMNS;
  const rows = BATTLEFIELD_ROWS;
  const tower = { row: Math.floor(rows / 2), column: Math.floor(columns / 2) };
  const ring = findNeighbors(tower, generateBattlefield(setup.seed, columns, rows) as BattleTile[]);
  const clear = new Set([tower, ...ring].map((tile) => `${tile.row},${tile.column}`));
  const tiles: ReadonlyArray<BattleTile> = generateBattlefield(setup.seed, columns, rows).map((tile) => {
    if (tile.row === tower.row && tile.column === tower.column) {
      return { ...tile, landscape: LandscapeType.grass, building: { type: BuildingType.tower, owner: holder, level: setup.towerLevel } };
    }
    return clear.has(`${tile.row},${tile.column}`) ? { ...tile, landscape: LandscapeType.grass } : tile;
  });

  const holderPreset = findArmyPreset(holder === "day" ? setup.dayArmy : setup.nightArmy);
  // Fighters before the king: the garrison is who the preset lists first, king last
  const garrisonSpecs = [...holderPreset.units].toSorted((a, b) => Number(a.kind === PieceKind.king) - Number(b.kind === PieceKind.king)).slice(0, MAX_DEFENDERS);
  // The tower first, then the neighbours facing away from the attacker
  const posts = [tower, ...ring.toSorted((a, b) => (holder === "day" ? a.column - b.column : b.column - a.column))];
  const defenders = garrisonSpecs.map((spec, index) =>
    towerDefenderUnit(createPieceFromSpec(spec, holder), setup.towerLevel, `defender-${index}`, posts[index]!),
  );
  const attackerPreset = findArmyPreset(attacker === "day" ? setup.dayArmy : setup.nightArmy);
  const attackers = deployArmy(attackerPreset, attacker, columns, rows).map((unit, index) =>
    attackerUnit(unit.piece, `attacker-${index}`, unit),
  );

  return createBattleOnField({
    seed: setup.seed,
    columns,
    rows,
    tiles,
    units: [...attackers, ...defenders],
    opening: `${attackerPreset.name} (${attacker}) storm the ${TOWER_LEVEL_NAMES[setup.towerLevel]} held by ${defenders.length} of ${holderPreset.name} (${holder})`,
    maxRounds: SIEGE_MAX_ROUNDS,
    stalemateWinner: holder,
    hold: { owner: holder, around: tower, radius: 1 },
  });
};

const startBattle = (setup: Setup): BattleState => {
  if (setup.ground === "siege-night") return startSiege(setup, "night");
  if (setup.ground === "siege-day") return startSiege(setup, "day");
  return createBattle({ seed: setup.seed, day: findArmyPreset(setup.dayArmy), night: findArmyPreset(setup.nightArmy) });
};

// ============================================
// EFFECTS (floating text and strike flashes)
// ============================================

type Effect =
  | { readonly kind: "text"; readonly x: number; readonly y: number; readonly text: string; readonly color: string; readonly born: number }
  | { readonly kind: "strike"; readonly from: Coordinate; readonly to: Coordinate; readonly born: number };

const EFFECT_MS = 1100;
const STRIKE_MS = 350;

const worldOf = (position: { readonly row: number; readonly column: number }): Coordinate => ({
  x: Hexagon.x(position.row, position.column),
  y: Hexagon.y(position.row),
});

const effectsFor = (event: BattleEvent, after: BattleState, now: number): ReadonlyArray<Effect> => {
  switch (event.type) {
    case "attack": {
      const attacker = findUnit(after, event.unitId);
      const target = findUnit(after, event.targetId);
      if (attacker === null || target === null) return [];
      const spot = worldOf(target);
      return [
        { kind: "strike", from: worldOf(attacker), to: spot, born: now },
        {
          kind: "text",
          x: spot.x,
          y: spot.y - Hexagon.height / 3,
          text: event.destroyed ? "slain" : `-${event.damage}`,
          color: event.destroyed ? "#ffd54f" : "#ff5252",
          born: now,
        },
      ];
    }
    case "heal": {
      const target = findUnit(after, event.targetId);
      if (target === null) return [];
      const spot = worldOf(target);
      return [{ kind: "text", x: spot.x, y: spot.y - Hexagon.height / 3, text: "+1", color: "#69f0ae", born: now }];
    }
    case "round":
    case "victory":
    case "move":
    case "wait":
      return [];
  }
};

// ============================================
// RENDERING
// ============================================

const toClientPiece = (unit: BattleUnit): Piece =>
  new Piece({
    kind: unit.piece.kind,
    owner: createPlayer({ type: unit.owner }),
    attackRange: getPieceAttackRange(unit.piece),
    equipment: unit.piece.equipment.map((item) => item.type),
    steed: unit.piece.steed?.type ?? null,
    hearts: unit.piece.hearts,
    maxHearts: unit.piece.maxHearts,
    attack: getPieceAttack(unit.piece),
    defense: getPieceDefense(unit.piece),
    move: getPieceMove(unit.piece),
    acted: unit.done,
  });

const buildRenderTiles = (state: BattleState): ReadonlyArray<Tile> => {
  const byKey = new Map(state.units.filter(isUnitAlive).map((unit) => [`${unit.row},${unit.column}`, unit]));
  return state.tiles.map((tile) => {
    const unit = byKey.get(`${tile.row},${tile.column}`);
    return new Tile({
      row: tile.row,
      column: tile.column,
      explored: true,
      landscape: new Landscape({ type: tile.landscape }),
      building:
        tile.building === undefined
          ? undefined
          : new Building({ type: tile.building.type, owner: createPlayer({ type: tile.building.owner }), level: tile.building.level }),
      piece: unit === undefined ? undefined : toClientPiece(unit),
    });
  });
};

const ownerColor = (owner: PlayerType): string => (owner === "day" ? "day.500" : "night.500");

const kindLabel = (kind: PieceKind): string => (kind === PieceKind.archAngel ? "archangel" : kind);

// ============================================
// COMPONENT
// ============================================

export const BattleSandbox = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [state, setState] = useState<BattleState>(() => startBattle(DEFAULT_SETUP));
  const [hovered, setHovered] = useState<BattleUnit | null>(null);
  const stateRef = useRef(state);
  const effectsRef = useRef<Effect[]>([]);
  const seenEventsRef = useRef(state.events.length);
  const hoveredIdRef = useRef<string | null>(null);
  // The canvas handlers live outside React's render cycle, so they read the setup through a ref
  const setupRef = useRef(setup);
  setupRef.current = setup;

  const controllerOf = (owner: PlayerType): Controller => (owner === "day" ? setup.dayController : setup.nightController);
  const current = activeUnit(state);
  const humanTurn = current !== null && controllerOf(current.owner) === "human";

  /** Apply an action, keeping the ref (used by the canvas loop) in step with React state */
  const dispatch = useCallback((action: BattleAction) => {
    const before = stateRef.current;
    const result = applyBattleAction(before, action);
    if (!result.ok) return;
    const after = result.state;
    const now = performance.now();
    after.events.slice(seenEventsRef.current).forEach((event) => {
      effectsRef.current.push(...effectsFor(event, after, now));
    });
    seenEventsRef.current = after.events.length;
    stateRef.current = after;
    setState(after);
  }, []);

  const restart = useCallback((next: Setup) => {
    const fresh = startBattle(next);
    stateRef.current = fresh;
    seenEventsRef.current = fresh.events.length;
    effectsRef.current = [];
    setState(fresh);
  }, []);

  // AI turns
  useEffect(() => {
    if (current === null || controllerOf(current.owner) !== "ai") return;
    const timer = window.setTimeout(() => dispatch(chooseBattleAction(stateRef.current)), AI_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [state, setup.dayController, setup.nightController, dispatch]);

  // Canvas
  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null) return;
    const canvas = new Canvas(canvasRef.current, wrapperRef.current);
    const first = stateRef.current;
    canvas.setContentBounds({
      minX: 0,
      minY: 0,
      maxX: Hexagon.x(1, first.columns) + Hexagon.width,
      maxY: Hexagon.y(first.rows) + Hexagon.height,
    });
    canvas.setZoom(2);
    canvas.centerOn({ x: Hexagon.x(0, first.columns / 2), y: Hexagon.y(first.rows / 2) });

    let frame = 0;
    const loop = () => {
      canvas.init();
      const battle = stateRef.current;
      const renderTiles = buildRenderTiles(battle);
      renderTiles.forEach((tile) => tile.render(canvas.ctx, defaultImageAssets));

      const active = activeUnit(battle);
      if (active !== null) {
        const spot = worldOf(active);
        reachableTiles(battle, active).forEach((tile) => {
          const at = worldOf(tile);
          Hexagon.renderArea(canvas.ctx, at.x, at.y, "#7bed9f33");
        });
        attackableEnemies(battle, active).forEach((enemy) => {
          const at = worldOf(enemy);
          Hexagon.renderArea(canvas.ctx, at.x, at.y, "#ff525244");
          Hexagon.render(canvas.ctx, at.x, at.y, "#ff5252cc");
        });
        healableAllies(battle, active).forEach((ally) => {
          const at = worldOf(ally);
          Hexagon.renderArea(canvas.ctx, at.x, at.y, "#69f0ae44");
          Hexagon.render(canvas.ctx, at.x, at.y, "#69f0aecc");
        });
        Hexagon.render(canvas.ctx, spot.x, spot.y, active.owner === "day" ? "#ffd54f" : "#b388ff");
      }

      const hoveredTile = renderTiles.find((tile) => tile.isMouseOver(canvas.mousePosition.x, canvas.mousePosition.y));
      if (hoveredTile !== undefined) hoveredTile.renderHovered(canvas.ctx);
      const hoveredUnit = hoveredTile === undefined ? null : unitAt(battle, hoveredTile);
      const hoveredId = hoveredUnit?.id ?? null;
      if (hoveredId !== hoveredIdRef.current) {
        hoveredIdRef.current = hoveredId;
        setHovered(hoveredUnit);
      }

      // Effects
      const now = performance.now();
      effectsRef.current = effectsRef.current.filter((effect) => now - effect.born < EFFECT_MS);
      canvas.ctx.save();
      effectsRef.current.forEach((effect) => {
        const age = now - effect.born;
        if (effect.kind === "strike") {
          if (age > STRIKE_MS) return;
          canvas.ctx.strokeStyle = `rgba(255,255,255,${1 - age / STRIKE_MS})`;
          canvas.ctx.lineWidth = 2;
          canvas.ctx.beginPath();
          canvas.ctx.moveTo(effect.from.x, effect.from.y);
          canvas.ctx.lineTo(effect.to.x, effect.to.y);
          canvas.ctx.stroke();
          return;
        }
        const progress = age / EFFECT_MS;
        canvas.ctx.globalAlpha = 1 - progress;
        canvas.ctx.font = "bold 9px monospace";
        canvas.ctx.textAlign = "center";
        canvas.ctx.lineWidth = 2;
        canvas.ctx.strokeStyle = "rgba(0,0,0,0.8)";
        canvas.ctx.fillStyle = effect.color;
        const y = effect.y - progress * Hexagon.height * 0.8;
        canvas.ctx.strokeText(effect.text, effect.x, y);
        canvas.ctx.fillText(effect.text, effect.x, y);
      });
      canvas.ctx.restore();

      canvas.reset();
      frame = requestAnimationFrame(loop);
    };
    loop();

    canvas.click((position: Coordinate) => {
      const battle = stateRef.current;
      const active = activeUnit(battle);
      if (active === null) return;
      const isHuman = (active.owner === "day" ? setupRef.current.dayController : setupRef.current.nightController) === "human";
      if (!isHuman) return;
      const clicked = battle.tiles.find((tile) => Hexagon.collidesWithCoordinates(position.x, position.y, Hexagon.x(tile.row, tile.column), Hexagon.y(tile.row)));
      if (clicked === undefined) return;
      const target = unitAt(battle, clicked);
      if (target !== null) {
        if (attackableEnemies(battle, active).some((enemy) => enemy.id === target.id)) {
          dispatch({ type: "attack", targetId: target.id });
        } else if (healableAllies(battle, active).some((ally) => ally.id === target.id)) {
          dispatch({ type: "heal", targetId: target.id });
        }
        return;
      }
      if (reachableTiles(battle, active).some((tile) => tile.row === clicked.row && tile.column === clicked.column)) {
        dispatch({ type: "move", to: { row: clicked.row, column: clicked.column } });
      }
    });

    canvas.keydown({
      " ": () => {
        const active = activeUnit(stateRef.current);
        if (active === null) return;
        const isHuman = (active.owner === "day" ? setupRef.current.dayController : setupRef.current.nightController) === "human";
        if (isHuman) dispatch({ type: "wait" });
      },
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const orderedUnits = state.order
    .map((id) => findUnit(state, id))
    .filter((unit): unit is BattleUnit => unit !== null && isUnitAlive(unit));

  const inspected = hovered ?? current;

  return (
    <Flex h="100%" bg="bg" fontFamily="mono">
      <Box flex="1" overflow="hidden" ref={wrapperRef}>
        <canvas ref={canvasRef} width="800" height="600" style={{ display: "block", width: "100%", height: "100%" }} />
      </Box>

      <VStack w="280px" p="4" borderLeft="1px solid" borderColor="border" overflow="auto" flexShrink={0} align="stretch" gap="4">
        <Heading size="md">Battle</Heading>

        <Box>
          <Label>Armies</Label>
          <VStack align="stretch" gap="2">
            <SideSetup
              owner="day"
              army={setup.dayArmy}
              controller={setup.dayController}
              onArmy={(dayArmy) => setSetup((s) => ({ ...s, dayArmy }))}
              onController={(dayController) => setSetup((s) => ({ ...s, dayController }))}
            />
            <SideSetup
              owner="night"
              army={setup.nightArmy}
              controller={setup.nightController}
              onArmy={(nightArmy) => setSetup((s) => ({ ...s, nightArmy }))}
              onController={(nightController) => setSetup((s) => ({ ...s, nightController }))}
            />
            <HStack gap="1">
              <NativeSelect.Root size="xs" flex="1">
                <NativeSelect.Field value={setup.ground} onChange={(event) => setSetup((s) => ({ ...s, ground: event.target.value as Ground }))}>
                  <option value="field">Open field</option>
                  <option value="siege-night">Siege: night holds a tower</option>
                  <option value="siege-day">Siege: day holds a tower</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              {setup.ground !== "field" && (
                <NativeSelect.Root size="xs" w="110px">
                  <NativeSelect.Field
                    value={String(setup.towerLevel)}
                    onChange={(event) => setSetup((s) => ({ ...s, towerLevel: Number(event.target.value) }))}
                  >
                    {[1, 2, 3].map((level) => (
                      <option key={level} value={level}>
                        {TOWER_LEVEL_NAMES[level]}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              )}
            </HStack>
            {setup.ground !== "field" && (
              <Text fontSize="2xs" color="fg.muted">
                The holder fields its first {MAX_DEFENDERS} fighters on the tower: they act first, wear its walls as armour, and bows shoot as far as it sees. The
                assault breaks off after {SIEGE_MAX_ROUNDS} rounds.
              </Text>
            )}
            <HStack gap="1">
              <Input
                size="xs"
                value={setup.seed}
                onChange={(event) => setSetup((s) => ({ ...s, seed: event.target.value }))}
                placeholder="field seed"
              />
              <Button size="xs" variant="outline" onClick={() => setSetup((s) => ({ ...s, seed: randomSeed() }))}>
                Roll
              </Button>
            </HStack>
            <Button size="xs" colorPalette="brand" onClick={() => restart(setup)}>
              Start battle
            </Button>
          </VStack>
        </Box>

        <Box>
          <Label>Round {state.round}</Label>
          {state.winner !== null ? (
            <Text fontSize="sm" fontWeight="bold" color={ownerColor(state.winner)}>
              {state.winner === "day" ? "Day" : "Night"} wins!
            </Text>
          ) : current !== null ? (
            <VStack align="stretch" gap="1">
              <Text fontSize="xs">
                <Text as="span" color={ownerColor(current.owner)} fontWeight="bold">
                  {current.owner}
                </Text>{" "}
                {describeUnit(current)} to act
                {controllerOf(current.owner) === "ai" ? " (AI)" : ""}
              </Text>
              {humanTurn && (
                <HStack gap="1">
                  <Button size="xs" variant="outline" onClick={() => dispatch({ type: "wait" })}>
                    {current.moved ? "End turn" : "Wait"}
                  </Button>
                </HStack>
              )}
              <Text fontSize="2xs" color="fg.muted">
                {current.moved ? "Moved. Strike a red enemy, heal a green ally, or end the turn." : "Green: move. Red: attack. Space waits."}
              </Text>
            </VStack>
          ) : null}
        </Box>

        {inspected !== null && (
          <Box>
            <Label>{hovered !== null ? "Under cursor" : "Active unit"}</Label>
            <UnitCard unit={inspected} />
          </Box>
        )}

        <Box>
          <Label>Initiative</Label>
          <VStack gap="0.5" align="stretch">
            {orderedUnits.map((unit) => (
              <Flex
                key={unit.id}
                justify="space-between"
                align="center"
                px="2"
                py="1"
                fontSize="xs"
                borderRadius="sm"
                bg={unit.id === current?.id ? "bg.muted" : "transparent"}
                opacity={unit.done ? 0.45 : 1}
                borderLeft="3px solid"
                borderColor={ownerColor(unit.owner)}
              >
                <Text>{describeUnit(unit)}</Text>
                <Hearts unit={unit} />
              </Flex>
            ))}
          </VStack>
        </Box>

        <Box>
          <Label>Chronicle</Label>
          <Box maxH="160px" overflow="auto" fontSize="2xs" color="fg.muted">
            {state.log.toReversed().map((entry, index) => (
              <Text key={`${state.log.length - index}`} py="0.5">
                {entry}
              </Text>
            ))}
          </Box>
        </Box>
      </VStack>
    </Flex>
  );
};

// ============================================
// PANEL PIECES
// ============================================

const Label = ({ children }: { readonly children: ReactNode }) => (
  <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">
    {children}
  </Text>
);

const Hearts = ({ unit }: { readonly unit: BattleUnit }) => {
  const defense = getPieceDefense(unit.piece);
  return (
    <HStack gap="1" fontSize="2xs">
      {defense > 0 && <Text color="blue.300">def {defense}</Text>}
      <Text color="red.400">
        {unit.piece.hearts}/{unit.piece.maxHearts}
      </Text>
    </HStack>
  );
};

const UnitCard = ({ unit }: { readonly unit: BattleUnit }) => (
  <Box fontSize="xs" borderLeft="3px solid" borderColor={ownerColor(unit.owner)} pl="2">
    <Text fontWeight="bold">
      <Text as="span" color={ownerColor(unit.owner)}>
        {unit.owner}
      </Text>{" "}
      {kindLabel(unit.piece.kind)}
    </Text>
    <Text color="fg.muted">
      {[...unit.piece.equipment.map((item) => item.type), ...(unit.piece.steed !== null ? [unit.piece.steed.type] : [])].join(", ") ||
        "no gear"}
    </Text>
    <HStack gap="3" mt="1" fontSize="2xs">
      <Stat label="hp" value={`${unit.piece.hearts}/${unit.piece.maxHearts}`} />
      <Stat label="atk" value={String(getPieceAttack(unit.piece))} />
      <Stat label="def" value={String(getPieceDefense(unit.piece))} />
      <Stat label="mov" value={String(getPieceMove(unit.piece))} />
      <Stat label="rng" value={String(getPieceAttackRange(unit.piece))} />
      <Stat label="ini" value={String(unit.initiative)} />
    </HStack>
  </Box>
);

const Stat = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <VStack gap="0" align="center">
    <Text color="fg.muted">{label}</Text>
    <Text fontWeight="bold">{value}</Text>
  </VStack>
);

const SideSetup = ({
  owner,
  army,
  controller,
  onArmy,
  onController,
}: {
  readonly owner: PlayerType;
  readonly army: string;
  readonly controller: Controller;
  readonly onArmy: (army: string) => void;
  readonly onController: (controller: Controller) => void;
}) => (
  <VStack align="stretch" gap="1" borderLeft="3px solid" borderColor={ownerColor(owner)} pl="2">
    <HStack gap="2" fontSize="xs">
      <Text w="40px" color={ownerColor(owner)} fontWeight="bold">
        {owner}
      </Text>
      <NativeSelect.Root size="xs" flex="1">
        <NativeSelect.Field value={army} onChange={(event) => onArmy(event.target.value)}>
          {ARMY_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <NativeSelect.Root size="xs" w="80px">
        <NativeSelect.Field value={controller} onChange={(event) => onController(event.target.value as Controller)}>
          <option value="human">Human</option>
          <option value="ai">AI</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
    <Text fontSize="2xs" color="fg.muted">
      {findArmyPreset(army).description}
    </Text>
  </VStack>
);
