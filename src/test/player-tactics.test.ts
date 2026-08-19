/**
 * Test suite for individual player tactical roles and instructions
 *
 * Validates:
 * - Valid role selection per position
 * - Invalid role prevention
 * - Position-compatible instructions
 * - GameState persistence
 * - Suitability scoring
 * - Default instructions
 * - Instruction toggling
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { GameState, Player } from "@/state/types";
import type { Club } from "@/data/squad";
import { gameReducer } from "@/state/reducer";
import {
  getRolesForPosition,
  getInstructionsForPosition,
  getInstructionsForRole,
  getRoleById,
  getInstructionById,
  getDefaultRoleForPosition,
  createDefaultTacticalConfig,
} from "@/state/player-tactics";
import {
  scorePlayerRoleSuitability,
  scoreAllRolesForPlayer,
  getRoleSuitabilityFeedback,
} from "@/lib/player-suitability";

describe("player-tactics", () => {
  describe("Role retrieval", () => {
    it("should return correct roles for each position", () => {
      const gkRoles = getRolesForPosition("GK");
      expect(gkRoles.length).toBeGreaterThan(0);
      expect(gkRoles.every((r) => r.positions.includes("GK"))).toBe(true);

      const cbRoles = getRolesForPosition("CB");
      expect(cbRoles.length).toBeGreaterThan(0);
      expect(cbRoles.some((r) => r.id === "cb-defender")).toBe(true);

      const stRoles = getRolesForPosition("ST");
      expect(stRoles.length).toBeGreaterThan(0);
      expect(stRoles.some((r) => r.id === "st-poacher")).toBe(true);
    });

    it("should return default role for a position", () => {
      const defaultGK = getDefaultRoleForPosition("GK");
      expect(defaultGK).toBeDefined();
      expect(defaultGK?.positions.includes("GK")).toBe(true);

      const defaultCB = getDefaultRoleForPosition("CB");
      expect(defaultCB).toBeDefined();
      expect(defaultCB?.id).toBe("cb-defender");
    });

    it("should get role by ID", () => {
      const poacher = getRoleById("st-poacher");
      expect(poacher).toBeDefined();
      expect(poacher?.name).toBe("Poacher");
      expect(poacher?.positions.includes("ST")).toBe(true);

      const nonexistent = getRoleById("invalid-role");
      expect(nonexistent).toBeUndefined();
    });
  });

  describe("Instruction retrieval", () => {
    it("should return correct instructions for each position", () => {
      const cbInstructions = getInstructionsForPosition("CB");
      expect(cbInstructions.length).toBeGreaterThan(0);
      expect(cbInstructions.every((i) => i.positions.includes("CB"))).toBe(true);

      const stInstructions = getInstructionsForPosition("ST");
      expect(stInstructions.length).toBeGreaterThan(0);
      expect(stInstructions.some((i) => i.id === "st-press")).toBe(true);
    });

    it("should filter instructions by role context", () => {
      const cbInstructions = getInstructionsForRole("cb-stopper", "CB");
      expect(cbInstructions.length).toBeGreaterThan(0);

      // Stay Back should be available for defenders
      const stayBack = cbInstructions.find((i) => i.id === "def-stay-back");
      expect(stayBack).toBeDefined();
    });

    it("should get instruction by ID", () => {
      const stayBack = getInstructionById("def-stay-back");
      expect(stayBack).toBeDefined();
      expect(stayBack?.name).toBe("Stay Back");
      expect(stayBack?.modifier.attackingFreedom).toBeLessThan(0); // should reduce attacking

      const nonexistent = getInstructionById("invalid-instruction");
      expect(nonexistent).toBeUndefined();
    });

    it("should exclude instructions with incompatible role context", () => {
      // "Stay Back" has rolesContext: ["cb-defender", "cb-stopper", "fb-fullback"]
      // So it should not be available for cb-playmaker in role-filtered query
      const playmakInstructions = getInstructionsForRole("cb-playmaker", "CB");
      const stayBackForPlaymak = playmakInstructions.find((i) => i.id === "def-stay-back");
      // Note: def-stay-back has rolesContext so it won't appear for cb-playmaker
      expect(stayBackForPlaymak).toBeUndefined();
    });
  });

  describe("Tactical config creation", () => {
    it("should create default config for position", () => {
      const config = createDefaultTacticalConfig("ST");
      expect(config.roleId).toBeDefined();
      expect(config.roleId.length).toBeGreaterThan(0);
      expect(config.instructions).toEqual([]);
      expect(config.roleFamiliarity).toBe(65); // neutral
    });

    it("should assign correct default role per position", () => {
      const cbConfig = createDefaultTacticalConfig("CB");
      expect(cbConfig.roleId).toBe("cb-defender");

      const gwConfig = createDefaultTacticalConfig("GK");
      expect(gwConfig.roleId).toBe("gk-shot-stopper");

      const stConfig = createDefaultTacticalConfig("ST");
      expect(stConfig.roleId).toBe("st-advanced");
    });
  });

  describe("Role suitability scoring", () => {
    const mockPlayer: Player = {
      id: "p1",
      name: "Test Player",
      nationality: "England",
      number: 7,
      pos: "ST",
      age: 28,
      foot: "R",
      height: 185,
      value: "€10,000,000",
      salary: "€150,000",
      attrs: {
        pace: 90,
        shooting: 85,
        passing: 70,
        dribbling: 80,
        defense: 35,
        physical: 75,
        heading: 65,
        positioning: 80,
        crossing: 60,
        stamina: 85,
        strength: 75,
        vision: 72,
        reflexes: 25, // very low for striker
        distribution: 20, // very low for striker
        handling: 15, // very low for striker
      },
      consistency: 75,
      injuryProneness: 20,
      fatigue: 30,
      injury: null,
      marketValue: 10_000_000,
      development: { form: 75, trajectory: "stable" },
      playingTime: { lastSeasonMinutes: 2400, currentSeasonMinutes: 400 },
      relationships: [],
      tacticalFamiliarity: {},
      reputation: 72,
      lastMatchRating: 7.5,
      matchRatingHistory: [],
    };

    it("should score player suitability for roles", () => {
      const poacher = getRoleById("st-poacher");
      expect(poacher).toBeDefined();

      const score = scorePlayerRoleSuitability(mockPlayer, poacher!);
      expect(score).toBeGreaterThan(70); // high-pace, high-shooting striker should score well
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should give lower scores for unsuitable roles", () => {
      const gkRole = getRoleById("gk-shot-stopper");
      expect(gkRole).toBeDefined();

      const score = scorePlayerRoleSuitability(mockPlayer, gkRole!);
      expect(score).toBeLessThan(50); // striker with low reflexes/distribution shouldn't be good GK
    });

    it("should score all roles for a player", () => {
      const stRoles = getRolesForPosition("ST");
      const allScores = scoreAllRolesForPlayer(mockPlayer, stRoles);

      expect(allScores.length).toBeGreaterThan(0);
      expect(allScores.every((s) => s.score >= 0 && s.score <= 100)).toBe(true);
      // scores should be sorted descending
      for (let i = 0; i < allScores.length - 1; i++) {
        expect(allScores[i].score).toBeGreaterThanOrEqual(allScores[i + 1].score);
      }
    });

    it("should return suitability feedback", () => {
      expect(getRoleSuitabilityFeedback(90)).toBe("Excellent fit");
      expect(getRoleSuitabilityFeedback(75)).toBe("Good fit");
      expect(getRoleSuitabilityFeedback(60)).toBe("Moderate fit");
      expect(getRoleSuitabilityFeedback(45)).toBe("Poor fit");
      expect(getRoleSuitabilityFeedback(20)).toBe("Not suited");
    });
  });

  describe("Reducer actions", () => {
    let mockState: GameState;
    let mockClub: Club;

    beforeEach(() => {
      // Create minimal mock state
      mockClub = {
        id: "club1",
        name: "Test Club",
        aiManager: false,
        playerIds: ["p1"],
        staffIds: [],
        formation: "4-3-3",
        seasonWins: 0,
        seasonDraws: 0,
        seasonLosses: 0,
        seasonGoalsFor: 0,
        seasonGoalsAgainst: 0,
        facility: { pitchQuality: 50, stadiumCapacity: 30000 },
        reputation: 50,
      };

      const mockPlayer: Player = {
        id: "p1",
        name: "Test Player",
        nationality: "England",
        number: 7,
        pos: "ST",
        age: 28,
        foot: "R",
        height: 185,
        value: "€10,000,000",
        salary: "€150,000",
        attrs: {
          pace: 90,
          shooting: 85,
          passing: 70,
          dribbling: 80,
          defense: 35,
          physical: 75,
          heading: 65,
          positioning: 80,
          crossing: 60,
          stamina: 85,
          strength: 75,
          vision: 72,
          reflexes: 25,
          distribution: 20,
          handling: 15,
        },
        consistency: 75,
        injuryProneness: 20,
        fatigue: 30,
        injury: null,
        marketValue: 10_000_000,
        development: { form: 75, trajectory: "stable" },
        playingTime: { lastSeasonMinutes: 2400, currentSeasonMinutes: 400 },
        relationships: [],
        tacticalFamiliarity: {},
        reputation: 72,
        lastMatchRating: 7.5,
        matchRatingHistory: [],
      };

      mockState = {
        players: { p1: mockPlayer },
        clubs: { club1: mockClub },
        currentClub: mockClub,
        fixtures: [],
        time: { date: "2026-01-01", season: 1 },
        finances: {
          balance: 10_000_000,
          transferBudget: "€50,000,000",
          wageBudget: "€1,000,000",
          wageCommitmentsWeekly: 100_000,
          income: {
            matchRevenue: 500_000,
            sponsorship: 250_000,
            television: 300_000,
            other: 50_000,
          },
          expenses: {
            playerSalaries: 100_000,
            staff: 50_000,
            transfers: 0,
            facilities: 10_000,
            scouting: 5_000,
            medical: 3_000,
            operations: 2_000,
            total: 170_000,
          },
          healthTier: "healthy",
        },
        tactics: {
          mentality: 55,
          width: 68,
          depth: 55,
          tempo: 72,
          pressing: 60,
          instructions: {
            outFromBack: false,
            counterPress: false,
            workIntoBox: false,
            fullBacksWide: false,
          },
        },
        selectedTrainingPlanId: "plan1",
        training: [],
        meta: { aiLedgers: {} },
        manager: {
          id: "m1",
          name: "Test Manager",
          nationality: "England",
          reputation: 50,
          experience: 10,
          credit: 50,
          fanConfidence: 50,
        },
        news: [],
        events: [],
      };
    });

    it("should set player role", () => {
      const action = { type: "SET_PLAYER_ROLE" as const, playerId: "p1", roleId: "st-poacher" };
      const nextState = gameReducer(mockState, action);

      const player = nextState.players.p1;
      expect(player.tacticalConfig?.roleId).toBe("st-poacher");
    });

    it("should set player instructions", () => {
      const action = {
        type: "SET_PLAYER_INSTRUCTIONS" as const,
        playerId: "p1",
        instructions: ["st-get-behind", "st-press"],
      };
      const nextState = gameReducer(mockState, action);

      const player = nextState.players.p1;
      expect(player.tacticalConfig?.instructions).toEqual(["st-get-behind", "st-press"]);
    });

    it("should set player role familiarity", () => {
      const action = {
        type: "SET_PLAYER_ROLE_FAMILIARITY" as const,
        playerId: "p1",
        familiarity: 85,
      };
      const nextState = gameReducer(mockState, action);

      const player = nextState.players.p1;
      expect(player.tacticalConfig?.roleFamiliarity).toBe(85);
    });

    it("should clamp role familiarity to 0-100", () => {
      let action = {
        type: "SET_PLAYER_ROLE_FAMILIARITY" as const,
        playerId: "p1",
        familiarity: 150,
      };
      let nextState = gameReducer(mockState, action);
      expect(nextState.players.p1.tacticalConfig?.roleFamiliarity).toBe(100);

      action = { type: "SET_PLAYER_ROLE_FAMILIARITY" as const, playerId: "p1", familiarity: -20 };
      nextState = gameReducer(mockState, action);
      expect(nextState.players.p1.tacticalConfig?.roleFamiliarity).toBe(0);
    });

    it("should preserve tactical config when setting role", () => {
      // First set instructions
      let action: any = {
        type: "SET_PLAYER_INSTRUCTIONS",
        playerId: "p1",
        instructions: ["st-press"],
      };
      let nextState = gameReducer(mockState, action);

      // Then set role
      action = { type: "SET_PLAYER_ROLE", playerId: "p1", roleId: "st-poacher" };
      nextState = gameReducer(nextState, action);

      const player = nextState.players.p1;
      expect(player.tacticalConfig?.roleId).toBe("st-poacher");
      expect(player.tacticalConfig?.instructions).toEqual(["st-press"]); // preserved
    });

    it("should handle nonexistent player gracefully", () => {
      const action = {
        type: "SET_PLAYER_ROLE" as const,
        playerId: "nonexistent",
        roleId: "st-poacher",
      };
      const nextState = gameReducer(mockState, action);

      // State should be unchanged
      expect(nextState).toEqual(mockState);
    });
  });

  describe("Role behavior attributes", () => {
    it("should have realistic behavior values", () => {
      const roles = getRolesForPosition("ST");
      roles.forEach((role) => {
        Object.entries(role.behavior).forEach(([key, value]) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        });
      });
    });

    it("should differentiate roles by behavior", () => {
      const poacher = getRoleById("st-poacher")!;
      const false9 = getRoleById("st-false-nine")!;

      // Poacher should be more conservative, False 9 more playmaking
      expect(poacher.behavior.buildUpInvolvement).toBeLessThan(false9.behavior.buildUpInvolvement);
      expect(poacher.behavior.supportDistance).toBeLessThan(false9.behavior.supportDistance);
    });
  });

  describe("Instruction modifiers", () => {
    it("should have valid behavior modifiers", () => {
      const stayBack = getInstructionById("def-stay-back")!;
      expect(stayBack.modifier.attackingFreedom).toBeLessThan(0); // reduces attacking
      expect(stayBack.modifier.defensiveResponsibility).toBeGreaterThan(0); // increases defense

      const joinAttack = getInstructionById("fb-join-attack")!;
      expect(joinAttack.modifier.attackingFreedom).toBeGreaterThan(0); // increases attacking
      expect(joinAttack.modifier.tendencyForwardRuns).toBeGreaterThan(0); // more forward runs
    });
  });
});
