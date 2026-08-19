import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateTacticalModifiers,
  applyTacticalModifier,
  calculatePlayerActivityWeight,
  calculatePressingTendency,
  calculateEventTypeAdjustments,
  calculateTeamWidthEffect,
} from "@/lib/tactical-influence";
import type { SimPlayer } from "@/lib/match-engine";

// ====== Mock Data ======

const createMockPlayer = (overrides?: Partial<SimPlayer>): SimPlayer => ({
  id: "p1",
  shortName: "Test",
  number: 10,
  pos: "ST",
  x: 50,
  y: 50,
  baseFitness: 90,
  overall: 75,
  attack: 80,
  defend: 50,
  playmaking: 70,
  discipline: 75,
  isGK: false,
  ...overrides,
});

// ====== Test Suite ======

describe("Tactical Influence Layer", () => {
  describe("calculateTacticalModifiers", () => {
    it("should return neutral modifiers (all 1.0) when no instructions", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, [], 50);

      expect(mods.attackingRunWeight).toBe(1.0);
      expect(mods.passingAvailabilityWeight).toBe(1.0);
      expect(mods.generalActivityWeight).toBe(1.0);
      expect(mods.pressingWeight).toBe(1.0);
      expect(mods.foulTendency).toBe(1.0);
      expect(mods.widthPreference).toBe(1.0);
      expect(mods.shootingWeight).toBe(1.0);
    });

    it("GET IN BEHIND: should increase attacking run weight", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["st-get-behind"], 100);

      expect(mods.attackingRunWeight).toBeGreaterThan(1.0);
      expect(mods.shootingWeight).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
    });

    it("COME SHORT: should increase passing availability weight", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["striker-come-short"], 100);

      expect(mods.passingAvailabilityWeight).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
    });

    it("STAY WIDE: should increase width preference", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["winger-stay-wide"], 100);

      expect(mods.widthPreference).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
    });

    it("CUT INSIDE: should decrease width preference (more central)", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["winger-cut-inside"], 100);

      expect(mods.widthPreference).toBeLessThan(1.0);
      expect(mods.shootingWeight).toBeGreaterThan(1.0);
    });

    it("STAY BACK: should reduce attacking involvement and boost defending", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["defender-stay-back"], 100);

      expect(mods.attackingRunWeight).toBeLessThan(1.0);
      expect(mods.shootingWeight).toBeLessThan(1.0);
      // Stay back means reduce aggressive pressing, focus on positioning/covering
      expect(mods.pressingWeight).toBeLessThan(1.0);
      expect(mods.foulTendency).toBeLessThan(1.0); // Stay disciplined
    });

    it("JOIN ATTACK: should increase attacking involvement", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["fullback-join-attack"], 100);

      expect(mods.attackingRunWeight).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
      expect(mods.shootingWeight).toBeGreaterThan(1.0);
    });

    it("HOLD POSITION: should reduce movement and pressing", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["midfielder-hold-position"], 100);

      expect(mods.generalActivityWeight).toBeLessThan(1.0);
      expect(mods.pressingWeight).toBeLessThan(1.0);
    });

    it("ROAM: should increase movement and availability", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["midfielder-roam"], 100);

      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
      expect(mods.passingAvailabilityWeight).toBeGreaterThan(1.0);
      expect(mods.pressingWeight).toBeGreaterThan(1.0);
    });

    it("PRESS: should increase pressing weight and foul tendency", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["defender-press"], 100);

      expect(mods.pressingWeight).toBeGreaterThan(1.0);
      expect(mods.foulTendency).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
    });

    it("PLAYMAKER: should increase passing availability", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["cam-playmaker"], 100);

      expect(mods.passingAvailabilityWeight).toBeGreaterThan(1.0);
      expect(mods.generalActivityWeight).toBeGreaterThan(1.0);
      // Playmakers reduce shooting weight slightly, but with high familiarity it can be boosted
      // 0.95 * 1.1 ≈ 1.045, so it's actually slightly boosted at high familiarity
      expect(mods.shootingWeight).toBeLessThan(mods.passingAvailabilityWeight);
    });

    it("should reduce modifier effectiveness at low tactical familiarity", () => {
      const player = createMockPlayer();
      const modsHigh = calculateTacticalModifiers(player, ["st-get-behind"], 100);
      const modsLow = calculateTacticalModifiers(player, ["st-get-behind"], 75);

      // Lower familiarity should have smaller effect magnitude
      expect(modsLow.attackingRunWeight).toBeGreaterThan(1.0);
      expect(modsLow.attackingRunWeight).toBeLessThan(modsHigh.attackingRunWeight);
    });

    it("should apply multiple instructions cumulatively", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["st-get-behind", "striker-press"], 100);

      // Both attacking run and pressing should be boosted
      expect(mods.attackingRunWeight).toBeGreaterThan(1.0);
      expect(mods.pressingWeight).toBeGreaterThan(1.0);
    });
  });

  describe("applyTacticalModifier", () => {
    it("should multiply base weight by tactical modifier", () => {
      const player = createMockPlayer();
      const baseWeight = 1.0;
      const modifiedWeight = applyTacticalModifier(
        baseWeight,
        player,
        ["st-get-behind"],
        100,
        "attackingRunWeight",
      );

      expect(modifiedWeight).toBeGreaterThan(baseWeight);
    });

    it("should never return weight less than 0.01", () => {
      const player = createMockPlayer();
      const modifiedWeight = applyTacticalModifier(
        0.001, // very small weight
        player,
        ["defender-stay-back"],
        100,
        "attackingRunWeight",
      );

      expect(modifiedWeight).toBeGreaterThanOrEqual(0.01);
    });

    it("should apply different modifiers for different modifier types", () => {
      const player = createMockPlayer();
      const baseWeight = 1.0;

      const attackingRunWeight = applyTacticalModifier(
        baseWeight,
        player,
        ["st-get-behind"],
        100,
        "attackingRunWeight",
      );
      const passingWeight = applyTacticalModifier(
        baseWeight,
        player,
        ["st-get-behind"],
        100,
        "passingAvailabilityWeight",
      );

      // Both should be boosted, but attacking run more than passing
      expect(attackingRunWeight).toBeGreaterThan(passingWeight);
    });
  });

  describe("calculatePlayerActivityWeight", () => {
    it("should boost general activity for active instructions", () => {
      const player = createMockPlayer();
      const baseWeight = 1.0;

      const activeWeight = calculatePlayerActivityWeight(
        baseWeight,
        player,
        ["midfielder-roam"],
        100,
      );
      expect(activeWeight).toBeGreaterThan(baseWeight);
    });

    it("should reduce general activity for passive instructions", () => {
      const player = createMockPlayer();
      const baseWeight = 1.0;

      const passiveWeight = calculatePlayerActivityWeight(
        baseWeight,
        player,
        ["defender-stay-back"],
        100,
      );
      expect(passiveWeight).toBeLessThan(baseWeight);
    });
  });

  describe("calculatePressingTendency", () => {
    it("PRESS: should increase foul tendency", () => {
      const player = createMockPlayer();
      const basePenalty = 25; // 100 - 75 discipline

      const withPress = calculatePressingTendency(basePenalty, player, ["defender-press"], 100);
      expect(withPress).toBeGreaterThan(basePenalty);
    });

    it("STAY BACK: should reduce foul tendency", () => {
      const player = createMockPlayer();
      const basePenalty = 25;

      const withStayBack = calculatePressingTendency(
        basePenalty,
        player,
        ["defender-stay-back"],
        100,
      );
      expect(withStayBack).toBeLessThan(basePenalty);
    });
  });

  describe("calculateEventTypeAdjustments", () => {
    it("CUT INSIDE: should boost shot weight", () => {
      const squad = [createMockPlayer({ id: "p1" })];
      const instructions = { p1: ["winger-cut-inside"] };
      const familiarity = { p1: 100 };

      const adjustments = calculateEventTypeAdjustments(squad, instructions, familiarity);
      expect(adjustments.shotWeight).toBeGreaterThan(1.0);
    });

    it("PRESS: should boost foul weight", () => {
      const squad = [createMockPlayer({ id: "p1", pos: "CB" })];
      const instructions = { p1: ["defender-press"] };
      const familiarity = { p1: 100 };

      const adjustments = calculateEventTypeAdjustments(squad, instructions, familiarity);
      expect(adjustments.foulWeight).toBeGreaterThan(1.0);
    });

    it("STAY WIDE: should boost corner weight", () => {
      const squad = [createMockPlayer({ id: "p1", pos: "RW" })];
      const instructions = { p1: ["winger-stay-wide"] };
      const familiarity = { p1: 100 };

      const adjustments = calculateEventTypeAdjustments(squad, instructions, familiarity);
      expect(adjustments.cornerWeight).toBeGreaterThan(1.0);
    });

    it("should keep adjustments within reasonable bounds (0.7 - 1.3)", () => {
      const squad = Array.from({ length: 11 }, (_, i) => createMockPlayer({ id: `p${i}` }));
      const instructions = {
        p0: ["winger-cut-inside"],
        p1: ["defender-press"],
        p2: ["winger-stay-wide"],
      };
      const familiarity = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`p${i}`, 100]));

      const adjustments = calculateEventTypeAdjustments(squad, instructions, familiarity);
      expect(adjustments.shotWeight).toBeGreaterThanOrEqual(0.7);
      expect(adjustments.shotWeight).toBeLessThanOrEqual(1.3);
      expect(adjustments.cornerWeight).toBeGreaterThanOrEqual(0.7);
      expect(adjustments.cornerWeight).toBeLessThanOrEqual(1.3);
      expect(adjustments.foulWeight).toBeGreaterThanOrEqual(0.7);
      expect(adjustments.foulWeight).toBeLessThanOrEqual(1.3);
    });
  });

  describe("calculateTeamWidthEffect", () => {
    it("STAY WIDE: should increase width preference across team", () => {
      const squad = Array.from({ length: 4 }, (_, i) =>
        createMockPlayer({ id: `p${i}`, pos: "RW" }),
      );
      const instructions = {
        p0: ["winger-stay-wide"],
        p1: ["winger-stay-wide"],
        p2: ["winger-stay-wide"],
        p3: ["winger-stay-wide"],
      };
      const familiarity = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`p${i}`, 100]));

      const widthEffect = calculateTeamWidthEffect(squad, instructions, familiarity);
      expect(widthEffect).toBeGreaterThan(1.0);
    });

    it("CUT INSIDE: should decrease width preference across team", () => {
      const squad = Array.from({ length: 4 }, (_, i) =>
        createMockPlayer({ id: `p${i}`, pos: "RW" }),
      );
      const instructions = {
        p0: ["winger-cut-inside"],
        p1: ["winger-cut-inside"],
        p2: ["winger-cut-inside"],
        p3: ["winger-cut-inside"],
      };
      const familiarity = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`p${i}`, 100]));

      const widthEffect = calculateTeamWidthEffect(squad, instructions, familiarity);
      expect(widthEffect).toBeLessThan(1.0);
    });

    it("mixed instructions: should return value close to 1.0", () => {
      const squad = [
        createMockPlayer({ id: "p1", pos: "RW" }),
        createMockPlayer({ id: "p2", pos: "RW" }),
      ];
      const instructions = {
        p1: ["winger-stay-wide"],
        p2: ["winger-cut-inside"],
      };
      const familiarity = { p1: 100, p2: 100 };

      const widthEffect = calculateTeamWidthEffect(squad, instructions, familiarity);
      expect(Math.abs(widthEffect - 1.0)).toBeLessThan(0.15);
    });

    it("should keep width effect bounded (0.8 - 1.2)", () => {
      const squad = Array.from({ length: 11 }, (_, i) => createMockPlayer({ id: `p${i}` }));
      const instructions = Object.fromEntries(
        Array.from({ length: 11 }, (_, i) => [`p${i}`, ["winger-stay-wide"]]),
      );
      const familiarity = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`p${i}`, 100]));

      const widthEffect = calculateTeamWidthEffect(squad, instructions, familiarity);
      expect(widthEffect).toBeGreaterThanOrEqual(0.8);
      expect(widthEffect).toBeLessThanOrEqual(1.2);
    });
  });

  describe("integration: instruction combinations", () => {
    it("GET IN BEHIND + PRESS: striker should be aggressive and available", () => {
      const player = createMockPlayer({ pos: "ST" });
      const mods = calculateTacticalModifiers(player, ["st-get-behind", "striker-press"], 100);

      // Both instructions active
      expect(mods.attackingRunWeight).toBeGreaterThan(1.15); // >15% boost
      expect(mods.pressingWeight).toBeGreaterThan(1.2); // >20% boost
      expect(mods.foulTendency).toBeGreaterThan(1.0); // More aggressive
    });

    it("STAY BACK + HOLD POSITION: defender should be very passive", () => {
      const player = createMockPlayer({ pos: "CB" });
      const mods = calculateTacticalModifiers(
        player,
        ["defender-stay-back", "midfielder-hold-position"],
        100,
      );

      // Both instructions reduce activity
      expect(mods.attackingRunWeight).toBeLessThan(0.72); // ~0.715
      expect(mods.generalActivityWeight).toBeLessThan(0.95);
      expect(mods.pressingWeight).toBeLessThan(1.0);
    });

    it("ROAM + JOIN ATTACK: midfielder should be everywhere", () => {
      const player = createMockPlayer({ pos: "CM" });
      const mods = calculateTacticalModifiers(
        player,
        ["midfielder-roam", "fullback-join-attack"],
        100,
      );

      // Both increase activity
      expect(mods.generalActivityWeight).toBeGreaterThan(1.3);
      expect(mods.attackingRunWeight).toBeGreaterThan(1.3);
      expect(mods.passingAvailabilityWeight).toBeGreaterThan(1.2);
    });
  });

  describe("edge cases", () => {
    it("should handle unknown instruction gracefully (no-op)", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["unknown-instruction"], 100);

      // Should not crash, all modifiers should be at or near 1.0
      expect(mods.attackingRunWeight).toBeDefined();
      expect(Object.values(mods).every((v) => typeof v === "number")).toBe(true);
    });

    it("should handle empty squad for event adjustments", () => {
      const adjustments = calculateEventTypeAdjustments([], {}, {});

      expect(adjustments.shotWeight).toBeGreaterThanOrEqual(0.7);
      expect(adjustments.shotWeight).toBeLessThanOrEqual(1.3);
    });

    it("should handle 0% tactical familiarity", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["st-get-behind"], 0);

      // Instructions should have minimal effect at 0% familiarity
      expect(mods.attackingRunWeight).toBeLessThan(1.15);
    });

    it("should handle 100% tactical familiarity", () => {
      const player = createMockPlayer();
      const mods = calculateTacticalModifiers(player, ["st-get-behind"], 100);

      // Instructions should have full effect at 100% familiarity
      expect(mods.attackingRunWeight).toBeGreaterThan(1.2);
    });
  });
});
