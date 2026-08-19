import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";
import type { GameState, TrainingPreset } from "./types";
import {
  getAllDrills,
  getDrillById,
  getDrillsByCategory,
  calculateDrillWorkload,
  calculateDrillInjuryRisk,
  validatePlayerForDrills,
  getAffectedAttributes,
} from "./training-presets";

describe("Training Presets System", () => {
  let state: GameState;

  beforeEach(() => {
    state = buildInitialState();
  });

  describe("Drill Library", () => {
    it("should have all drills available", () => {
      const allDrills = getAllDrills();
      expect(allDrills.length).toBeGreaterThan(0);
      expect(allDrills.length).toBeGreaterThan(20); // Should have many drills
    });

    it("should have drills in all 6 categories", () => {
      const categories = ["shooting", "passing", "dribbling", "physical", "defending", "mental"];
      for (const category of categories) {
        const drills = getDrillsByCategory(category as any);
        expect(drills.length).toBeGreaterThan(0);
      }
    });

    it("should retrieve drill by ID", () => {
      const drill = getDrillById("drill_finishing");
      expect(drill).toBeDefined();
      expect(drill?.name).toBe("Finishing Practice");
      expect(drill?.category).toBe("shooting");
    });

    it("should return undefined for invalid drill ID", () => {
      const drill = getDrillById("invalid_drill");
      expect(drill).toBeUndefined();
    });

    it("each drill should have valid metadata", () => {
      const allDrills = getAllDrills();
      for (const drill of allDrills) {
        expect(drill.id).toBeDefined();
        expect(drill.name).toBeDefined();
        expect(drill.category).toBeDefined();
        expect(drill.attributeFocus).toBeDefined();
        expect(drill.affectedAttributes).toBeDefined();
        expect(drill.affectedAttributes.length).toBeGreaterThan(0);
        expect(drill.workloadCoefficient).toBeGreaterThan(0);
        expect(drill.injuryRiskCoefficient).toBeGreaterThan(0);
      }
    });
  });

  describe("Initial State", () => {
    it("should initialize with 3 training presets", () => {
      expect(state.trainPresets).toBeDefined();
      expect(state.trainPresets?.length).toBe(3);
    });

    it("should initialize all presets as empty", () => {
      state.trainPresets?.forEach((preset) => {
        expect(preset.selectedPlayerIds).toEqual([]);
        expect(preset.drills).toEqual([]);
        expect(preset.intensity).toBe("medium");
        expect(preset.frequencyDays).toBe(1);
      });
    });

    it("should have unique preset IDs", () => {
      const ids = state.trainPresets?.map((p) => p.id) ?? [];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have all drills in trainDrills", () => {
      expect(state.trainDrills).toBeDefined();
      const allDrills = getAllDrills();
      expect(state.trainDrills?.length).toBe(allDrills.length);
    });
  });

  describe("Drill Calculations", () => {
    it("should calculate workload from selected drills", () => {
      const drillIds = ["drill_finishing", "drill_pace"];
      const workload = calculateDrillWorkload(drillIds);
      expect(workload).toBeGreaterThan(0);
      expect(typeof workload).toBe("number");
    });

    it("should calculate higher workload for more drills", () => {
      const oneDrill = calculateDrillWorkload(["drill_finishing"]);
      const twoDrills = calculateDrillWorkload(["drill_finishing", "drill_pace"]);
      expect(twoDrills).toBeGreaterThan(oneDrill);
    });

    it("should calculate injury risk from selected drills", () => {
      const drillIds = ["drill_tackling", "drill_acceleration"];
      const risk = calculateDrillInjuryRisk(drillIds);
      expect(risk).toBeGreaterThan(0);
      expect(typeof risk).toBe("number");
    });

    it("should return 0 workload for empty drill list", () => {
      const workload = calculateDrillWorkload([]);
      expect(workload).toBe(0);
    });

    it("should return 0 injury risk for empty drill list", () => {
      const risk = calculateDrillInjuryRisk([]);
      expect(risk).toBe(0);
    });
  });

  describe("Player Validation", () => {
    it("should validate player for selected drills", () => {
      const player = state.players[Object.keys(state.players)[0]];
      const error = validatePlayerForDrills(player, ["drill_finishing"]);
      // Should pass for normal player with normal drills
      expect(error).toBeUndefined();
    });

    it("should reject young players for strength training", () => {
      const youngPlayer = {
        ...state.players[Object.keys(state.players)[0]],
        age: 17,
      };
      const error = validatePlayerForDrills(youngPlayer, ["drill_strength"]);
      expect(error).toBeDefined();
      expect(error).toContain("Young players");
    });

    it("should reject injured players for high-impact drills", () => {
      const injuredPlayer = {
        ...state.players[Object.keys(state.players)[0]],
        injured: true,
      };
      const error = validatePlayerForDrills(injuredPlayer, ["drill_tackling"]);
      expect(error).toBeDefined();
      expect(error).toContain("Injured players");
    });

    it("should allow injured players for low-impact drills", () => {
      const injuredPlayer = {
        ...state.players[Object.keys(state.players)[0]],
        injured: true,
      };
      const error = validatePlayerForDrills(injuredPlayer, ["drill_vision"]);
      expect(error).toBeUndefined();
    });
  });

  describe("Affected Attributes", () => {
    it("should identify affected attributes from drills", () => {
      const attrs = getAffectedAttributes(["drill_finishing", "drill_pace"]);
      expect(attrs).toContain("shooting");
      expect(attrs).toContain("pace");
    });

    it("should return unique attributes", () => {
      const attrs = getAffectedAttributes(["drill_finishing", "drill_shortpass"]);
      const uniqueAttrs = new Set(attrs);
      expect(uniqueAttrs.size).toBe(attrs.length);
    });

    it("should return empty array for empty drill list", () => {
      const attrs = getAffectedAttributes([]);
      expect(attrs).toEqual([]);
    });

    it("should handle drills with multiple affected attributes", () => {
      const attrs = getAffectedAttributes(["drill_acceleration"]);
      expect(attrs.length).toBeGreaterThan(0);
    });
  });

  describe("Reducer Actions - UPDATE_TRAINING_PRESET", () => {
    it("should update preset name", () => {
      const presetId = state.trainPresets![0].id;
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: { name: "Custom Preset" },
      });

      expect(newState.trainPresets![0].name).toBe("Custom Preset");
    });

    it("should update preset intensity", () => {
      const presetId = state.trainPresets![0].id;
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: { intensity: "high" },
      });

      expect(newState.trainPresets![0].intensity).toBe("high");
    });

    it("should update preset drills", () => {
      const presetId = state.trainPresets![0].id;
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: { drills: ["drill_finishing", "drill_pace"] },
      });

      expect(newState.trainPresets![0].drills).toEqual(["drill_finishing", "drill_pace"]);
    });

    it("should update preset selected players", () => {
      const presetId = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 3);
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: { selectedPlayerIds: playerIds },
      });

      expect(newState.trainPresets![0].selectedPlayerIds).toEqual(playerIds);
    });

    it("should update preset frequency", () => {
      const presetId = state.trainPresets![0].id;
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: { frequencyDays: 3 },
      });

      expect(newState.trainPresets![0].frequencyDays).toBe(3);
    });

    it("should not affect other presets when updating one", () => {
      const preset1Id = state.trainPresets![0].id;
      const preset2Id = state.trainPresets![1].id;

      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: { name: "Updated Preset 1" },
      });

      expect(newState.trainPresets![0].name).toBe("Updated Preset 1");
      expect(newState.trainPresets![1].name).toBe("Preset 2"); // Should not change
    });

    it("should ignore update for invalid preset ID", () => {
      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: "invalid-id",
        patch: { name: "Should not work" },
      });

      expect(newState).toBe(state);
    });
  });

  describe("Reducer Actions - APPLY_TRAINING_PRESET", () => {
    it("should create training plan from preset", () => {
      const presetId = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 5);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: {
          name: "Attack Drill",
          selectedPlayerIds: playerIds,
          drills: ["drill_finishing", "drill_pace"],
        },
      });

      const plansBefore = newState.training.length;

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId,
      });

      expect(newState.training.length).toBe(plansBefore + 1);
      const newPlan = newState.training[newState.training.length - 1];
      expect(newPlan.assignedPlayerIds).toEqual(playerIds);
      expect(newPlan.intensity).toBe("medium");
    });

    it("should set applied training plan as selected", () => {
      const presetId = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 3);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: {
          selectedPlayerIds: playerIds,
          drills: ["drill_finishing"],
        },
      });

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId,
      });

      expect(newState.selectedTrainingPlanId).toBeDefined();
      const appliedPlan = newState.training.find((p) => p.id === newState.selectedTrainingPlanId);
      expect(appliedPlan).toBeDefined();
    });

    it("should not apply preset with no players", () => {
      const presetId = state.trainPresets![0].id;

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: {
          selectedPlayerIds: [],
          drills: ["drill_finishing"],
        },
      });

      const plansBefore = newState.training.length;

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId,
      });

      expect(newState.training.length).toBe(plansBefore); // No change
    });

    it("should not apply preset with no drills", () => {
      const presetId = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 3);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: {
          selectedPlayerIds: playerIds,
          drills: [],
        },
      });

      const plansBefore = newState.training.length;

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId,
      });

      expect(newState.training.length).toBe(plansBefore); // No change
    });

    it("should update preset lastAppliedDate", () => {
      const presetId = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 3);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId,
        patch: {
          selectedPlayerIds: playerIds,
          drills: ["drill_finishing"],
        },
      });

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId,
      });

      expect(newState.trainPresets![0].lastAppliedDate).toBeDefined();
    });
  });

  describe("Preset Isolation", () => {
    it("should not affect preset 2 when modifying preset 1", () => {
      const preset1Id = state.trainPresets![0].id;
      const preset2Id = state.trainPresets![1].id;

      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          name: "Attacking",
          drills: ["drill_finishing", "drill_pace"],
          selectedPlayerIds: Object.keys(state.players).slice(0, 5),
        },
      });

      expect(newState.trainPresets![0].name).toBe("Attacking");
      expect(newState.trainPresets![0].drills).toContain("drill_finishing");
      expect(newState.trainPresets![1].name).toBe("Preset 2");
      expect(newState.trainPresets![1].drills).toEqual([]);
    });

    it("should not affect preset 3 when modifying preset 1", () => {
      const preset1Id = state.trainPresets![0].id;
      const preset3Id = state.trainPresets![2].id;

      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          intensity: "high",
        },
      });

      expect(newState.trainPresets![0].intensity).toBe("high");
      expect(newState.trainPresets![2].intensity).toBe("medium"); // Should remain unchanged
    });

    it("should allow independent application of presets", () => {
      const preset1Id = state.trainPresets![0].id;
      const preset2Id = state.trainPresets![1].id;
      const playerIds1 = Object.keys(state.players).slice(0, 3);
      const playerIds2 = Object.keys(state.players).slice(3, 6);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          selectedPlayerIds: playerIds1,
          drills: ["drill_finishing"],
          intensity: "low",
        },
      });

      newState = gameReducer(newState, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset2Id,
        patch: {
          selectedPlayerIds: playerIds2,
          drills: ["drill_pace", "drill_strength"],
          intensity: "high",
        },
      });

      const plansBefore = newState.training.length;

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId: preset1Id,
      });

      const plansAfterPreset1 = newState.training.length;
      expect(plansAfterPreset1).toBe(plansBefore + 1);

      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId: preset2Id,
      });

      expect(newState.training.length).toBe(plansAfterPreset1 + 1);
      const plan1 = newState.training[newState.training.length - 2];
      const plan2 = newState.training[newState.training.length - 1];

      expect(plan1.assignedPlayerIds).toEqual(playerIds1);
      expect(plan1.intensity).toBe("low");
      expect(plan2.assignedPlayerIds).toEqual(playerIds2);
      expect(plan2.intensity).toBe("high");
    });
  });

  describe("Integration - Multiple Operations", () => {
    it("should handle complex preset workflow", () => {
      const preset1Id = state.trainPresets![0].id;
      const playerIds = Object.keys(state.players).slice(0, 8);

      // Step 1: Configure preset 1
      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          name: "Balanced Development",
          intensity: "medium",
          drills: [
            "drill_finishing",
            "drill_shortpass",
            "drill_ballcontrol",
            "drill_pace",
            "drill_marking",
          ],
          selectedPlayerIds: playerIds,
          frequencyDays: 1,
        },
      });

      expect(newState.trainPresets![0].name).toBe("Balanced Development");
      expect(newState.trainPresets![0].drills.length).toBe(5);
      expect(newState.trainPresets![0].selectedPlayerIds.length).toBe(8);

      // Step 2: Apply preset
      newState = gameReducer(newState, {
        type: "APPLY_TRAINING_PRESET",
        presetId: preset1Id,
      });

      const newPlan = newState.training[newState.training.length - 1];
      expect(newPlan.name).toBe("Balanced Development");
      expect(newPlan.assignedPlayerIds).toEqual(playerIds);

      // Step 3: Modify preset (should not affect already-applied plan)
      newState = gameReducer(newState, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          name: "High Intensity Attack",
          intensity: "high",
        },
      });

      expect(newState.trainPresets![0].name).toBe("High Intensity Attack");
      expect(newPlan.name).toBe("Balanced Development"); // Original plan unchanged
    });

    it("should track affected attributes across operations", () => {
      const preset1Id = state.trainPresets![0].id;

      const newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: preset1Id,
        patch: {
          drills: ["drill_finishing", "drill_pace", "drill_tackling"],
        },
      });

      const attrs = getAffectedAttributes(newState.trainPresets![0].drills);
      expect(attrs).toContain("shooting");
      expect(attrs).toContain("pace");
      expect(attrs).toContain("defending");
    });
  });

  describe("Persistence", () => {
    it("should maintain preset state after multiple operations", () => {
      const originalPreset = { ...state.trainPresets![0] };

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: originalPreset.id,
        patch: {
          name: "Modified",
          drills: ["drill_finishing"],
        },
      });

      // Update again
      newState = gameReducer(newState, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: originalPreset.id,
        patch: {
          intensity: "high",
        },
      });

      const modifiedPreset = newState.trainPresets![0];
      expect(modifiedPreset.name).toBe("Modified");
      expect(modifiedPreset.drills).toEqual(["drill_finishing"]);
      expect(modifiedPreset.intensity).toBe("high");
    });

    it("should preserve all preset IDs through operations", () => {
      const originalIds = state.trainPresets!.map((p) => p.id);

      let newState = gameReducer(state, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: originalIds[0],
        patch: { name: "Updated" },
      });

      newState = gameReducer(newState, {
        type: "UPDATE_TRAINING_PRESET",
        presetId: originalIds[1],
        patch: { intensity: "high" },
      });

      const newIds = newState.trainPresets!.map((p) => p.id);
      expect(newIds).toEqual(originalIds);
    });
  });
});
