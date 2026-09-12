import { describe, it, expect } from "vitest";
import { LandscapeType } from "@shared/map/landscape.ts";
import { PieceKind } from "@shared/piece/index.ts";
import { EquipmentType } from "@shared/equipment/index.ts";
import { SteedType } from "@shared/steed/index.ts";
import {
  ARMY_PRESETS,
  type BattleState,
  activeUnit,
  applyBattleAction,
  attackableEnemies,
  chooseBattleAction,
  createBattle,
  createPieceFromSpec,
  findArmyPreset,
  generateBattlefield,
  initiativeOf,
  livingUnits,
  reachableTiles,
} from "./index.ts";

const setup = (day = "levy", night = "levy", seed = "test") =>
  createBattle({ seed, day: findArmyPreset(day), night: findArmyPreset(night) });

const playUntilOver = (start: BattleState, maxSteps = 2000): BattleState => {
  let state = start;
  for (let step = 0; step < maxSteps && state.winner === null; step += 1) {
    const result = applyBattleAction(state, chooseBattleAction(state));
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
  }
  return state;
};

describe("battlefield", () => {
  it("is deterministic for a seed and keeps the deployment columns clear", () => {
    const a = generateBattlefield("meadow");
    const b = generateBattlefield("meadow");
    expect(a).toEqual(b);
    expect(a.some((tile) => tile.landscape === LandscapeType.grass && tile.column === 7)).toBe(true);
    a.filter((tile) => tile.column < 2 || tile.column >= 13).forEach((tile) => {
      expect(tile.landscape).toBe(LandscapeType.grass);
    });
  });

  it("differs between seeds", () => {
    expect(generateBattlefield("one")).not.toEqual(generateBattlefield("two"));
  });
});

describe("armies", () => {
  it("builds equipped and mounted pieces from a spec", () => {
    const piece = createPieceFromSpec(
      { kind: PieceKind.peasant, equipment: [EquipmentType.bow, EquipmentType.shield], steed: SteedType.horse },
      "day",
    );
    expect(piece.equipment.map((item) => item.type)).toEqual([EquipmentType.bow, EquipmentType.shield]);
    expect(piece.steed?.type).toBe(SteedType.horse);
  });

  it("orders faster units first: mounted before foot, armour slows", () => {
    const rider = createPieceFromSpec({ kind: PieceKind.peasant, steed: SteedType.horse }, "day");
    const foot = createPieceFromSpec({ kind: PieceKind.peasant }, "day");
    const armoured = createPieceFromSpec({ kind: PieceKind.peasant, equipment: [EquipmentType.torso] }, "day");
    expect(initiativeOf(rider)).toBeGreaterThan(initiativeOf(foot));
    expect(initiativeOf(foot)).toBeGreaterThan(initiativeOf(armoured));
  });

  it("deploys every preset with one king per side", () => {
    ARMY_PRESETS.forEach((preset) => {
      const state = createBattle({ seed: "x", day: preset, night: preset });
      expect(state.units).toHaveLength(preset.units.length * 2);
      const positions = new Set(state.units.map((unit) => `${unit.row},${unit.column}`));
      expect(positions.size).toBe(state.units.length);
      expect(state.units.filter((unit) => unit.owner === "day" && unit.piece.kind === PieceKind.king)).toHaveLength(1);
    });
  });
});

describe("turns", () => {
  it("starts with the highest initiative unit and moves within range", () => {
    const state = setup("levy", "riders");
    const unit = activeUnit(state)!;
    expect(unit.owner).toBe("night"); // mounted king is fastest
    const reach = reachableTiles(state, unit);
    expect(reach.length).toBeGreaterThan(0);
    reach.forEach((tile) => expect(tile.distance).toBeLessThanOrEqual(2));
  });

  it("refuses moving to an unreachable tile", () => {
    const state = setup();
    const result = applyBattleAction(state, { type: "move", to: { row: 0, column: 14 } });
    expect(result.ok).toBe(false);
  });

  it("ends the turn after a move with nothing in range, and rests everyone at a new round", () => {
    const state = setup();
    const unit = activeUnit(state)!;
    const target = reachableTiles(state, unit)[0]!;
    const result = applyBattleAction(state, { type: "move", to: target });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(activeUnit(result.state)?.id).not.toBe(unit.id);
    expect(result.state.units.find((candidate) => candidate.id === unit.id)?.done).toBe(true);

    let rolling = result.state;
    while (rolling.round === 1) {
      const next = applyBattleAction(rolling, { type: "wait" });
      if (!next.ok) throw new Error(next.reason);
      rolling = next.state;
    }
    expect(rolling.round).toBe(2);
    expect(rolling.units.every((candidate) => !candidate.done)).toBe(true);
  });

  it("applies damage to armour before hearts and ends the turn", () => {
    const base = setup("men-at-arms", "men-at-arms");
    // Put a day archer within bow range of a night shield bearer
    const archer = base.units.find((unit) => unit.owner === "day" && unit.piece.equipment.some((item) => item.type === EquipmentType.bow))!;
    const shieldBearer = base.units.find((unit) => unit.owner === "night" && unit.piece.equipment.some((item) => item.type === EquipmentType.shield))!;
    const staged: BattleState = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === archer.id ? { ...unit, row: 4, column: 6 } : unit.id === shieldBearer.id ? { ...unit, row: 4, column: 8 } : unit,
      ),
      order: [archer.id, ...base.order.filter((id) => id !== archer.id)],
      turnIndex: 0,
    };
    expect(attackableEnemies(staged, activeUnit(staged)!).map((unit) => unit.id)).toEqual([shieldBearer.id]);
    const result = applyBattleAction(staged, { type: "attack", targetId: shieldBearer.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const struck = result.state.units.find((unit) => unit.id === shieldBearer.id)!;
    expect(struck.piece.hearts).toBe(1);
    expect(struck.piece.equipment.some((item) => item.type === EquipmentType.shield)).toBe(false);
    expect(activeUnit(result.state)?.id).not.toBe(archer.id);
  });

  it("is won when a king falls", () => {
    const base = setup("levy", "levy");
    const dayPeasant = base.units.find((unit) => unit.owner === "day" && unit.piece.kind === PieceKind.peasant)!;
    const nightKing = base.units.find((unit) => unit.owner === "night" && unit.piece.kind === PieceKind.king)!;
    const staged: BattleState = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === dayPeasant.id
          ? { ...unit, row: 4, column: 7, piece: { ...unit.piece, baseAttack: 9 } }
          : unit.id === nightKing.id
            ? { ...unit, row: 4, column: 8 }
            : unit,
      ),
      order: [dayPeasant.id, ...base.order.filter((id) => id !== dayPeasant.id)],
      turnIndex: 0,
    };
    const result = applyBattleAction(staged, { type: "attack", targetId: nightKing.id });
    expect(result.ok && result.state.winner).toBe("day");
  });
});

describe("ai", () => {
  it("attacks when an enemy is in reach", () => {
    const base = setup("levy", "levy");
    const attacker = activeUnit(base)!;
    const enemy = base.units.find((unit) => unit.owner !== attacker.owner)!;
    const staged: BattleState = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === attacker.id ? { ...unit, row: 4, column: 6 } : unit.id === enemy.id ? { ...unit, row: 4, column: 8 } : unit,
      ),
    };
    const action = chooseBattleAction(staged);
    expect(action.type).toBe("move");
    const moved = applyBattleAction(staged, action);
    if (!moved.ok) throw new Error(moved.reason);
    expect(chooseBattleAction(moved.state)).toEqual({ type: "attack", targetId: enemy.id });
  });

  it("plays every preset matchup to a finish", { timeout: 30_000 }, () => {
    ARMY_PRESETS.forEach((day) => {
      ARMY_PRESETS.forEach((night) => {
        const end = playUntilOver(createBattle({ seed: `${day.id}-${night.id}`, day, night }));
        expect(end.winner).not.toBeNull();
        expect(livingUnits(end).some((unit) => unit.owner === end.winner)).toBe(true);
      });
    });
  });
});
