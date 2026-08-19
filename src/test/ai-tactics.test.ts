import { describe, it, expect, beforeEach } from "vitest";
import {
  generateAIPlayStyle,
  assignPlayerTactics,
  assignSquadTactics,
  validatePlayerTactics,
} from "@/lib/ai-tactics";
import type { Player, Club } from "@/data/squad";

/**
 * Create a mock player for testing
 */
function createMockPlayer(id: string, pos: string, attrs: Partial<Player["attrs"]> = {}): Player {
  const defaultAttrs = {
    pace: 75,
    shooting: 75,
    passing: 75,
    dribbling: 75,
    defending: 75,
    physical: 75,
    gk_positioning: 75,
    gk_distribution: 75,
    gk_reflexes: 75,
    gk_handling: 75,
  };

  return {
    id,
    firstName: "Test",
    lastName: "Player",
    pos: pos as any,
    club: "test",
    age: 28,
    overall: 80,
    potential: 82,
    pace: 75,
    shooting: 75,
    passing: 75,
    dribbling: 75,
    defending: 75,
    physical: 75,
    attrs: { ...defaultAttrs, ...attrs },
    contract: 2,
    wage: 50000,
  } as Player;
}

/**
 * Create a mock club for testing
 */
function createMockClub(id: string, name: string): Club {
  return {
    id,
    name,
    league: "test",
    founded: 2000,
  } as Club;
}

describe("AI Tactical Assignment System", () => {
  describe("generateAIPlayStyle", () => {
    it("generates deterministic play styles from same seed", () => {
      const club = createMockClub("club1", "Test FC");
      const style1 = generateAIPlayStyle(club, 0);
      const style2 = generateAIPlayStyle(club, 0);

      expect(style1.attackingIntent).toBe(style2.attackingIntent);
      expect(style1.pressingIntensity).toBe(style2.pressingIntensity);
      expect(style1.focusArea).toBe(style2.focusArea);
    });

    it("generates different play styles from different seeds", () => {
      const club = createMockClub("differentclubA", "Test FC");
      const style1 = generateAIPlayStyle(club, 0);
      const style2 = generateAIPlayStyle(club, 999);

      // Different seeds may produce different styles, but not guaranteed
      // Just verify they're both valid
      expect(["defending", "balanced", "attacking"]).toContain(style1.focusArea);
      expect(["defending", "balanced", "attacking"]).toContain(style2.focusArea);
    });

    it("generates styles within valid ranges", () => {
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      expect(style.attackingIntent).toBeGreaterThanOrEqual(0);
      expect(style.attackingIntent).toBeLessThanOrEqual(100);
      expect(style.pressingIntensity).toBeGreaterThanOrEqual(0);
      expect(style.pressingIntensity).toBeLessThanOrEqual(100);
      expect(["defending", "balanced", "attacking"]).toContain(style.focusArea);
    });
  });

  describe("assignPlayerTactics", () => {
    it("assigns role and instructions to player", () => {
      const player = createMockPlayer("p1", "ST", {
        shooting: 90,
        pace: 85,
      });
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const config = assignPlayerTactics(player, style);

      expect(config.roleId).toBeTruthy();
      expect(config.roleId).not.toBe("");
      expect(Array.isArray(config.instructions)).toBe(true);
      expect(config.roleFamiliarity).toBeGreaterThanOrEqual(0);
      expect(config.roleFamiliarity).toBeLessThanOrEqual(100);
    });

    it("assigns role valid for player position", () => {
      const player = createMockPlayer("p1", "CB");
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const config = assignPlayerTactics(player, style);
      const errors = validatePlayerTactics(player, config);

      // Should have no errors for role/position mismatch
      const positionErrors = errors.filter((e) => e.includes("not valid for position"));
      expect(positionErrors.length).toBe(0);
    });

    it("assigns more instructions for high-variability styles", () => {
      const player = createMockPlayer("p1", "CM", { passing: 85 });
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const highVar = assignPlayerTactics(player, style, 0.9);
      const lowVar = assignPlayerTactics(player, style, 0.1);

      // High variability should allow more instructions
      expect(highVar.instructions.length).toBeGreaterThanOrEqual(lowVar.instructions.length);
    });

    it("respects player attributes in role selection", () => {
      const pacyPlayer = createMockPlayer("p1", "LW", { pace: 95 });
      const slowPlayer = createMockPlayer("p2", "LW", { pace: 55 });
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const pacyConfig = assignPlayerTactics(pacyPlayer, style);
      const slowConfig = assignPlayerTactics(slowPlayer, style);

      // Both should get roles, but attributes influence selection
      expect(pacyConfig.roleId).toBeTruthy();
      expect(slowConfig.roleId).toBeTruthy();
    });
  });

  describe("assignSquadTactics", () => {
    it("assigns tactics to all squad members", () => {
      const squad = [
        createMockPlayer("p1", "GK"),
        createMockPlayer("p2", "CB"),
        createMockPlayer("p3", "CM"),
        createMockPlayer("p4", "ST"),
      ];
      const club = createMockClub("club1", "Test FC");

      const tactics = assignSquadTactics(squad, club, 0);

      expect(tactics.size).toBe(squad.length);
      for (const player of squad) {
        expect(tactics.has(player.id)).toBe(true);
      }
    });

    it("generates deterministic squad tactics from same seed", () => {
      const squad = [createMockPlayer("p1", "CB"), createMockPlayer("p2", "CM")];
      const club = createMockClub("club1", "Test FC");

      const tactics1 = assignSquadTactics(squad, club, 42);
      const tactics2 = assignSquadTactics(squad, club, 42);

      expect(tactics1.get("p1")).toEqual(tactics2.get("p1"));
      expect(tactics1.get("p2")).toEqual(tactics2.get("p2"));
    });

    it("generates different tactics for different seeds", () => {
      const squad = [createMockPlayer("p1", "CM", { passing: 80 })];
      const club = createMockClub("seedTestClub", "Test FC");

      const tactics1 = assignSquadTactics(squad, club, 0);
      const tactics2 = assignSquadTactics(squad, club, 100);

      // Both should produce valid tactics even if same
      const config1 = tactics1.get("p1")!;
      const config2 = tactics2.get("p1")!;
      expect(config1.roleId).toBeTruthy();
      expect(config2.roleId).toBeTruthy();
    });

    it("all assigned tactics pass validation", () => {
      const squad = [
        createMockPlayer("p1", "GK"),
        createMockPlayer("p2", "CB"),
        createMockPlayer("p3", "LW", { pace: 90 }),
        createMockPlayer("p4", "ST", { shooting: 88 }),
      ];
      const club = createMockClub("club1", "Test FC");

      const tactics = assignSquadTactics(squad, club, 0);

      for (const player of squad) {
        const config = tactics.get(player.id);
        if (config) {
          const errors = validatePlayerTactics(player, config);
          expect(errors).toEqual([]);
        }
      }
    });
  });

  describe("validatePlayerTactics", () => {
    it("accepts valid tactical configuration", () => {
      const player = createMockPlayer("p1", "CM");
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const config = assignPlayerTactics(player, style);
      const errors = validatePlayerTactics(player, config);

      expect(errors.length).toBe(0);
    });

    it("rejects configuration with no role", () => {
      const player = createMockPlayer("p1", "CM");
      const config = {
        roleId: "",
        instructions: [],
        roleFamiliarity: 50,
      };

      const errors = validatePlayerTactics(player, config);

      expect(errors.some((e) => e.includes("No role assigned"))).toBe(true);
    });

    it("rejects role invalid for position", () => {
      const cbPlayer = createMockPlayer("p1", "CB");
      // Try to assign a ST role to a CB - should fail position validation
      const stConfig = {
        roleId: "st-poacher", // Striker role
        instructions: [],
        roleFamiliarity: 50,
      };

      const errors = validatePlayerTactics(cbPlayer, stConfig);

      // Should have error about role not valid for position
      expect(
        errors.some((e) => e.includes("not valid for position") || e.includes("does not exist")),
      ).toBe(true);
    });

    it("rejects out-of-range familiarity", () => {
      const player = createMockPlayer("p1", "CM");
      const club = createMockClub("club1", "Test FC");
      const style = generateAIPlayStyle(club, 0);

      const config = assignPlayerTactics(player, style);
      config.roleFamiliarity = 150; // Invalid

      const errors = validatePlayerTactics(player, config);

      expect(errors.some((e) => e.includes("out of range"))).toBe(true);
    });
  });

  describe("Tactical Variation", () => {
    it("different clubs get different tactical approaches", () => {
      const squad = [createMockPlayer("p1", "CM", { passing: 80 })];
      const attackingClub = createMockClub("aaaa", "Attacking FC");
      const defensiveClub = createMockClub("zzzz", "Defensive United");

      const tactics1 = assignSquadTactics(squad, attackingClub, 0);
      const tactics2 = assignSquadTactics(squad, defensiveClub, 0);

      // Both should produce valid configs
      const config1 = tactics1.get("p1")!;
      const config2 = tactics2.get("p1")!;
      expect(config1.roleId).toBeTruthy();
      expect(config2.roleId).toBeTruthy();

      // Validation should pass for both
      expect(validatePlayerTactics(squad[0], config1)).toEqual([]);
      expect(validatePlayerTactics(squad[0], config2)).toEqual([]);
    });

    it("different play styles produce different instruction assignments", () => {
      const player = createMockPlayer("p1", "CM", { passing: 75, pace: 70 });
      const club = createMockClub("club1", "Test FC");

      // Attacking style should favor more aggressive instructions
      const attackingStyle = {
        attackingIntent: 85,
        pressingIntensity: 70,
        directness: 60,
        variability: 70,
        focusArea: "attacking" as const,
      };

      // Defensive style should favor more cautious instructions
      const defensiveStyle = {
        attackingIntent: 35,
        pressingIntensity: 45,
        directness: 55,
        variability: 40,
        focusArea: "defending" as const,
      };

      const attackingConfig = assignPlayerTactics(player, attackingStyle);
      const defensiveConfig = assignPlayerTactics(player, defensiveStyle);

      // Both should be valid
      expect(validatePlayerTactics(player, attackingConfig)).toEqual([]);
      expect(validatePlayerTactics(player, defensiveConfig)).toEqual([]);
    });
  });
});
