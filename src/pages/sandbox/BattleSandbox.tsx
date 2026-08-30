import { useEffect, useRef, useState } from "react";
import { Flex, Box, VStack, HStack, Text, Heading, Button } from "@chakra-ui/react";
import { Canvas } from "../../canvas";
import { Hexagon } from "../../core/Hexagon";
import { Landscape, LandscapeType } from "../../core/Landscape";
import { Tile } from "../../core/Tile";
import { Piece, PieceKind } from "../../core/Piece";
import { type ImageAssets } from "../../images";
import { simpleImageAssets } from "../../images/simple-theme";
import { createPlayer } from "@shared/player";
import * as hex from "@shared/map/hex";
import type { Coordinate } from "../../types/coordinate";

// ============================================
// BATTLE CONFIGURATION
// ============================================

const BATTLEFIELD_COLS = 13;
const BATTLEFIELD_ROWS = 9;

// ============================================
// BATTLE UNIT
// ============================================

type BattleUnit = {
  readonly id: string;
  readonly kind: PieceKind;
  readonly owner: "day" | "night";
  readonly speed: number;
  readonly maxHearts: number;
  readonly attack: number;
  readonly defense: number;
  readonly moveRange: number;
  readonly attackRange: number;
  hearts: number;
  row: number;
  column: number;
  hasActed: boolean;
};

const UNIT_STATS: Record<string, { speed: number; maxHearts: number; attack: number; defense: number; moveRange: number; attackRange: number }> = {
  [PieceKind.peasant]: { speed: 4, maxHearts: 1, attack: 1, defense: 0, moveRange: 3, attackRange: 1 },
  [PieceKind.king]: { speed: 6, maxHearts: 3, attack: 1, defense: 1, moveRange: 4, attackRange: 1 },
  [PieceKind.priest]: { speed: 5, maxHearts: 3, attack: 0, defense: 0, moveRange: 3, attackRange: 1 },
  [PieceKind.archAngel]: { speed: 10, maxHearts: 3, attack: 3, defense: 3, moveRange: 6, attackRange: 1 },
};

const createBattleUnit = (
  id: string,
  kind: PieceKind,
  owner: "day" | "night",
  row: number,
  column: number,
): BattleUnit => {
  const stats = UNIT_STATS[kind] ?? UNIT_STATS[PieceKind.peasant];
  return {
    id,
    kind,
    owner,
    speed: stats.speed,
    maxHearts: stats.maxHearts,
    attack: stats.attack,
    defense: stats.defense,
    moveRange: stats.moveRange,
    attackRange: stats.attackRange,
    hearts: stats.maxHearts,
    row,
    column,
    hasActed: false,
  };
};

// ============================================
// BATTLE STATE
// ============================================

type BattlePhase = "select" | "move" | "attack" | "victory";

type BattleState = {
  readonly tiles: ReadonlyArray<Tile>;
  readonly units: ReadonlyArray<BattleUnit>;
  readonly turnOrder: ReadonlyArray<string>;
  readonly currentUnitIndex: number;
  readonly phase: BattlePhase;
  readonly selectedUnitId: string | null;
  readonly log: ReadonlyArray<string>;
  readonly winner: "day" | "night" | null;
};

const createBattlefield = (): ReadonlyArray<Tile> =>
  Array.from({ length: BATTLEFIELD_ROWS * BATTLEFIELD_COLS }, (_, index) => {
    const column = index % BATTLEFIELD_COLS;
    const row = Math.floor(index / BATTLEFIELD_COLS);
    return new Tile({
      row,
      column,
      explored: true,
      landscape: new Landscape({ type: LandscapeType.grass }),
    });
  });

const computeTurnOrder = (units: ReadonlyArray<BattleUnit>): ReadonlyArray<string> =>
  units
    .filter((unit) => unit.hearts > 0)
    .toSorted((unitA, unitB) => unitB.speed - unitA.speed)
    .map((unit) => unit.id);

const createInitialBattle = (): BattleState => {
  const units: ReadonlyArray<BattleUnit> = [
    // Day army (left side)
    createBattleUnit("day-king", PieceKind.king, "day", 4, 1),
    createBattleUnit("day-peasant-1", PieceKind.peasant, "day", 2, 0),
    createBattleUnit("day-peasant-2", PieceKind.peasant, "day", 3, 0),
    createBattleUnit("day-peasant-3", PieceKind.peasant, "day", 5, 0),
    createBattleUnit("day-peasant-4", PieceKind.peasant, "day", 6, 0),
    // Night army (right side)
    createBattleUnit("night-king", PieceKind.king, "night", 4, 11),
    createBattleUnit("night-peasant-1", PieceKind.peasant, "night", 2, 12),
    createBattleUnit("night-peasant-2", PieceKind.peasant, "night", 3, 12),
    createBattleUnit("night-peasant-3", PieceKind.peasant, "night", 5, 12),
    createBattleUnit("night-peasant-4", PieceKind.peasant, "night", 6, 12),
  ];

  const turnOrder = computeTurnOrder(units);

  return {
    tiles: createBattlefield(),
    units,
    turnOrder,
    currentUnitIndex: 0,
    phase: "select",
    selectedUnitId: null,
    log: ["Battle begins!"],
    winner: null,
  };
};

// ============================================
// BATTLE TILES (merge units onto tiles for rendering)
// ============================================

const buildRenderTiles = (
  baseTiles: ReadonlyArray<Tile>,
  units: ReadonlyArray<BattleUnit>,
): ReadonlyArray<Tile> =>
  baseTiles.map((tile) => {
    const unit = units.find(
      (candidate) => candidate.row === tile.row && candidate.column === tile.column && candidate.hearts > 0,
    );
    if (unit === undefined) return tile;

    const owner = createPlayer({ type: unit.owner });
    const piece = new Piece({
      kind: unit.kind,
      owner,
      viewRange: 1,
      attackRange: unit.attackRange,
      walkableLandscape: [LandscapeType.grass],
    });
    return new Tile({
      row: tile.row,
      column: tile.column,
      explored: true,
      landscape: tile.landscape !== null ? new Landscape(tile.landscape) : undefined,
      piece,
    });
  });

// ============================================
// BFS REACHABLE TILES
// ============================================

const findReachableTiles = (
  tiles: ReadonlyArray<Tile>,
  units: ReadonlyArray<BattleUnit>,
  startRow: number,
  startColumn: number,
  moveRange: number,
): ReadonlyArray<{ readonly row: number; readonly column: number; readonly distance: number }> => {
  const occupiedKeys = new Set(
    units.filter((unit) => unit.hearts > 0).map((unit) => `${unit.row},${unit.column}`),
  );
  const visited = new Map<string, number>();
  const startKey = `${startRow},${startColumn}`;
  visited.set(startKey, 0);

  type FrontierEntry = { readonly row: number; readonly column: number; readonly distance: number };
  const frontier: FrontierEntry[] = [{ row: startRow, column: startColumn, distance: 0 }];

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    if (current.distance >= moveRange) continue;

    const neighbors = hex.findNeighbors(current, tiles as Tile[]);
    neighbors.forEach((neighbor) => {
      const key = `${neighbor.row},${neighbor.column}`;
      if (visited.has(key)) return;
      if (occupiedKeys.has(key) && key !== startKey) return;
      visited.set(key, current.distance + 1);
      frontier.push({ row: neighbor.row, column: neighbor.column, distance: current.distance + 1 });
    });
  }

  return Array.from(visited.entries())
    .filter(([key]) => key !== startKey)
    .map(([key, distance]) => {
      const [rowStr, colStr] = key.split(",");
      return { row: Number(rowStr), column: Number(colStr), distance };
    });
};

// ============================================
// ADJACENT ENEMIES
// ============================================

const findAttackableEnemies = (
  tiles: ReadonlyArray<Tile>,
  units: ReadonlyArray<BattleUnit>,
  unit: BattleUnit,
): ReadonlyArray<BattleUnit> => {
  const neighbors = hex.findNeighbors(unit, tiles as Tile[]);
  const neighborKeys = new Set(neighbors.map((neighbor) => `${neighbor.row},${neighbor.column}`));
  return units.filter(
    (target) =>
      target.hearts > 0 &&
      target.owner !== unit.owner &&
      neighborKeys.has(`${target.row},${target.column}`),
  );
};

// ============================================
// COMPONENT
// ============================================

export const BattleSandbox = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<BattleState>(createInitialBattle());
  const animationFrameRef = useRef<number | null>(null);
  const imageAssets: ImageAssets = simpleImageAssets as ImageAssets;

  const [, setRenderTick] = useState(0);
  const forceUpdate = () => setRenderTick((tick) => tick + 1);

  const battleState = stateRef.current;
  const currentUnitId = battleState.turnOrder[battleState.currentUnitIndex] ?? null;
  const currentUnit = currentUnitId !== null
    ? battleState.units.find((unit) => unit.id === currentUnitId) ?? null
    : null;

  useEffect(() => {
    if (canvasRef.current === null || wrapperRef.current === null) return;

    const canvas = new Canvas(canvasRef.current, wrapperRef.current);

    const loop = () => {
      canvas.init();

      const state = stateRef.current;
      const renderTiles = buildRenderTiles(state.tiles, state.units);

      renderTiles.forEach((tile) => {
        tile.render(canvas.ctx, imageAssets);
      });

      // Highlight current unit
      const activeUnit = state.turnOrder[state.currentUnitIndex] !== undefined
        ? state.units.find((unit) => unit.id === state.turnOrder[state.currentUnitIndex])
        : undefined;

      if (activeUnit !== undefined && activeUnit.hearts > 0) {
        const activeX = Hexagon.x(activeUnit.row, activeUnit.column);
        const activeY = Hexagon.y(activeUnit.row);
        Hexagon.render(canvas.ctx, activeX, activeY, "#00ffff");

        // Show reachable tiles
        if (state.phase === "select") {
          const reachable = findReachableTiles(
            state.tiles, state.units,
            activeUnit.row, activeUnit.column, activeUnit.moveRange,
          );
          reachable.forEach((pos) => {
            const posX = Hexagon.x(pos.row, pos.column);
            const posY = Hexagon.y(pos.row);
            Hexagon.renderArea(canvas.ctx, posX, posY, "#00ff0022");
          });

          // Show attackable enemies
          const attackable = findAttackableEnemies(state.tiles, state.units, activeUnit);
          attackable.forEach((enemy) => {
            const enemyX = Hexagon.x(enemy.row, enemy.column);
            const enemyY = Hexagon.y(enemy.row);
            Hexagon.renderArea(canvas.ctx, enemyX, enemyY, "#ff000044");
            Hexagon.render(canvas.ctx, enemyX, enemyY, "#ff0000aa");
          });
        }
      }

      // Hover
      const hoveredTile = renderTiles.find((tile) =>
        tile.isMouseOver(canvas.mousePosition.x, canvas.mousePosition.y),
      );
      if (hoveredTile !== undefined) {
        hoveredTile.renderHovered(canvas.ctx);
      }

      canvas.reset();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    // Click handler
    canvas.click((position: Coordinate) => {
      const state = stateRef.current;
      if (state.phase === "victory") return;

      const renderTiles = buildRenderTiles(state.tiles, state.units);
      const clickedTile = renderTiles.find((tile) =>
        tile.isMouseOver(position.x, position.y),
      );
      if (clickedTile === undefined) return;

      const activeUnitId = state.turnOrder[state.currentUnitIndex];
      const activeUnit = state.units.find((unit) => unit.id === activeUnitId);
      if (activeUnit === undefined || activeUnit.hearts <= 0) return;

      // Check if clicking an enemy to attack
      const clickedEnemy = state.units.find(
        (unit) =>
          unit.row === clickedTile.row &&
          unit.column === clickedTile.column &&
          unit.hearts > 0 &&
          unit.owner !== activeUnit.owner,
      );

      if (clickedEnemy !== undefined) {
        // Check if adjacent
        const isAdjacent = hex.isNeighborTo(activeUnit, clickedEnemy);
        if (isAdjacent) {
          // Resolve combat
          const damage = Math.max(0, activeUnit.attack - clickedEnemy.defense);
          clickedEnemy.hearts = Math.max(0, clickedEnemy.hearts - damage);
          (clickedEnemy as { defense: number }).defense = Math.max(0, clickedEnemy.defense - activeUnit.attack);

          const destroyed = clickedEnemy.hearts <= 0;
          const logEntry = destroyed
            ? `${activeUnit.owner} ${activeUnit.kind} destroyed ${clickedEnemy.owner} ${clickedEnemy.kind}!`
            : `${activeUnit.owner} ${activeUnit.kind} hit ${clickedEnemy.owner} ${clickedEnemy.kind} for ${damage} damage`;

          activeUnit.hasActed = true;

          // Check victory
          const dayAlive = state.units.some((unit) => unit.owner === "day" && unit.hearts > 0);
          const nightAlive = state.units.some((unit) => unit.owner === "night" && unit.hearts > 0);
          const winner = !dayAlive ? "night" : !nightAlive ? "day" : null;

          stateRef.current = {
            ...state,
            log: [...state.log, logEntry, ...(winner !== null ? [`${winner} wins!`] : [])],
            phase: winner !== null ? "victory" : state.phase,
            winner,
            currentUnitIndex: advanceTurn(state),
          };
          forceUpdate();
          return;
        }
      }

      // Check if clicking a reachable tile to move
      const reachable = findReachableTiles(
        state.tiles, state.units,
        activeUnit.row, activeUnit.column, activeUnit.moveRange,
      );
      const isReachable = reachable.some(
        (pos) => pos.row === clickedTile.row && pos.column === clickedTile.column,
      );

      if (isReachable) {
        activeUnit.row = clickedTile.row;
        activeUnit.column = clickedTile.column;

        // Check if any enemies are now adjacent — if so, stay in select phase for attack
        const adjacentEnemies = findAttackableEnemies(state.tiles, state.units, activeUnit);
        if (adjacentEnemies.length === 0) {
          activeUnit.hasActed = true;
          stateRef.current = {
            ...state,
            log: [...state.log, `${activeUnit.owner} ${activeUnit.kind} moved`],
            currentUnitIndex: advanceTurn(state),
          };
        } else {
          stateRef.current = {
            ...state,
            log: [...state.log, `${activeUnit.owner} ${activeUnit.kind} moved — can attack!`],
          };
        }
        forceUpdate();
      }
    });

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const advanceTurn = (state: BattleState): number => {
    const aliveOrder = state.turnOrder.filter((unitId) => {
      const unit = state.units.find((candidate) => candidate.id === unitId);
      return unit !== undefined && unit.hearts > 0;
    });

    if (aliveOrder.length === 0) return 0;

    const currentId = state.turnOrder[state.currentUnitIndex];
    const currentIndexInAlive = aliveOrder.indexOf(currentId);
    const nextIndex = (currentIndexInAlive + 1) % aliveOrder.length;
    const nextId = aliveOrder[nextIndex];

    // Reset hasActed for next round if wrapping
    if (nextIndex === 0) {
      state.units.forEach((unit) => { unit.hasActed = false; });
    }

    return state.turnOrder.indexOf(nextId);
  };

  const handleReset = () => {
    stateRef.current = createInitialBattle();
    forceUpdate();
  };

  const handleSkip = () => {
    const state = stateRef.current;
    if (state.phase === "victory") return;

    const activeUnit = state.units.find((unit) => unit.id === state.turnOrder[state.currentUnitIndex]);
    if (activeUnit !== undefined) {
      activeUnit.hasActed = true;
    }

    stateRef.current = {
      ...state,
      log: [...state.log, `${activeUnit?.owner ?? "?"} ${activeUnit?.kind ?? "?"} waits`],
      currentUnitIndex: advanceTurn(state),
    };
    forceUpdate();
  };

  return (
    <Flex h="100%" bg="bg" fontFamily="mono">
      <Box flex="1" overflow="hidden" ref={wrapperRef}>
        <canvas ref={canvasRef} width="800" height="600" style={{ display: "block", width: "100%", height: "100%" }} />
      </Box>

      <VStack
        w="220px"
        p="4"
        borderLeft="1px solid"
        borderColor="border"
        overflow="auto"
        flexShrink={0}
        align="stretch"
        gap="3"
      >
        <Heading size="md">Battle</Heading>

        {battleState.winner !== null && (
          <Box>
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">Victory</Text>
            <Text fontSize="sm" fontWeight="bold" color={battleState.winner === "day" ? "day.500" : "night.500"}>
              {battleState.winner === "day" ? "Day" : "Night"} wins!
            </Text>
          </Box>
        )}

        <Box>
          <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">Current Turn</Text>
          {currentUnit !== null && (
            <Text fontSize="xs">
              <Text as="span" color={currentUnit.owner === "day" ? "day.500" : "night.500"}>
                {currentUnit.owner}
              </Text>
              {" "}{currentUnit.kind}
              {" "}({currentUnit.hearts}/{currentUnit.maxHearts} hp)
            </Text>
          )}
          <HStack mt="2" gap="1">
            <Button size="xs" variant="outline" onClick={handleSkip}>Skip</Button>
            <Button size="xs" variant="outline" onClick={handleReset}>Reset</Button>
          </HStack>
        </Box>

        <Box>
          <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">Turn Order</Text>
          <VStack gap="0.5" align="stretch">
            {battleState.turnOrder
              .map((unitId) => battleState.units.find((unit) => unit.id === unitId))
              .filter((unit): unit is BattleUnit => unit !== undefined && unit.hearts > 0)
              .map((unit) => (
                <Flex
                  key={unit.id}
                  justify="space-between"
                  align="center"
                  px="2"
                  py="1"
                  fontSize="xs"
                  borderRadius="sm"
                  bg={unit.id === currentUnitId ? "bg.muted" : "transparent"}
                  borderLeft="3px solid"
                  borderColor={unit.owner === "day" ? "day.500" : "night.500"}
                >
                  <Text>{unit.kind}</Text>
                  <Text color="red.400">{unit.hearts}/{unit.maxHearts}</Text>
                </Flex>
              ))}
          </VStack>
        </Box>

        <Box>
          <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">Controls</Text>
          <Text fontSize="2xs" color="fg.muted">
            Click green tile to move. Click red enemy to attack. Arrow keys to pan.
          </Text>
        </Box>

        <Box>
          <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide" mb="1">Log</Text>
          <Box maxH="120px" overflow="auto" fontSize="2xs" color="fg.muted">
            {battleState.log.toReversed().map((entry, index) => (
              <Text key={index} py="0.5">{entry}</Text>
            ))}
          </Box>
        </Box>
      </VStack>
    </Flex>
  );
};
