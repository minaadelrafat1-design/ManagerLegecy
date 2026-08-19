import { describe, expect, it } from "vitest";
import "./training";
import { buildInitialState } from "./seed";
import { runDailyTick } from "./calendar";
import { sanitizeLoadedGameState } from "./store";
import {
  getTrainingGroundCategoryMultiplier,
  getTrainingGroundRecoveryMultiplier,
} from "./training-ground";
import { gameReducer } from "./reducer";

function stateForDrill(drillId: string, assetId: "shooting" | "technical" | "strength" | "cardio" | "goalkeeping" | "analysisTech") {
  const base = buildInitialState();
  const playerId = base.currentClub.playerIds[0]!;
  const player = base.players[playerId]!;
  const trainingGround = structuredClone(base.currentClub.trainingGround);
  const asset = trainingGround.equipment[assetId];
  asset.level = 5;
  asset.condition = 100;
  const currentClub = { ...base.currentClub, trainingGround };
  return {
    ...base,
    currentClub,
    clubs: { ...base.clubs, [currentClub.id]: currentClub },
    players: {
      [playerId]: { ...player, trainingProgress: 40, fatigue: 20 },
    },
    training: [{ id: "plan-test", name: "Test", focus: drillId, intensity: "medium" as const, assignedPlayerIds: [playerId], drillIds: [drillId] }],
    selectedTrainingPlanId: "plan-test",
  };
}

function advanceTraining(state: ReturnType<typeof stateForDrill>) {
  let next = state;
  for (let day = 1; day <= 5; day += 1) {
    const nextDate = `2026-11-${String(11 + day).padStart(2, "0")}`;
    next = runDailyTick(next, { ...next.time, date: nextDate, day: next.time.day + 1 });
  }
  return next;
}

describe("Training Ground real pipeline integration", () => {
  it.each([
    ["drill_finishing", "shooting" as const],
    ["drill_shortpass", "technical" as const],
    ["drill_strength", "physical" as const],
    ["drill_tackling", "analysis" as const],
  ])("gives upgraded relevant equipment a measurable %s benefit", (drillId, category) => {
    const baseline = stateForDrill(drillId, category === "shooting" ? "shooting" : category === "technical" ? "technical" : category === "physical" ? "strength" : "analysisTech");
    const upgraded = advanceTraining(baseline);
    const baselineGround = structuredClone(baseline);
    baselineGround.currentClub.trainingGround = undefined;
    baselineGround.clubs[baselineGround.currentClub.id] = baselineGround.currentClub;
    const normal = advanceTraining(baselineGround);
    const playerId = baseline.currentClub.playerIds[0]!;
    expect(upgraded.players[playerId]!.trainingProgress).toBeGreaterThan(normal.players[playerId]!.trainingProgress);
    expect(getTrainingGroundCategoryMultiplier(baseline.currentClub, category)).toBeGreaterThan(1);
  });

  it("supports goalkeeper equipment and keeps poor condition below a fully maintained upgrade", () => {
    const upgraded = stateForDrill("drill_positioning", "goalkeeping");
    const poor = structuredClone(upgraded);
    poor.currentClub.trainingGround.equipment.goalkeeping.condition = 30;
    const upgradedMultiplier = getTrainingGroundCategoryMultiplier(upgraded.currentClub, "goalkeeping");
    const poorMultiplier = getTrainingGroundCategoryMultiplier(poor.currentClub, "goalkeeping");
    expect(upgradedMultiplier).toBeGreaterThan(poorMultiplier);
    expect(poorMultiplier).toBeGreaterThanOrEqual(1);
  });

  it("uses recovery facilities for readiness without a direct attribute bonus", () => {
    const base = buildInitialState();
    const ground = structuredClone(base.currentClub.trainingGround);
    const upgraded = { ...base.currentClub, trainingGround: ground };
    upgraded.trainingGround.facilities.recovery.level = 5;
    upgraded.trainingGround.facilities.recovery.condition = 100;
    upgraded.trainingGround.equipment.recovery.level = 5;
    upgraded.trainingGround.equipment.recovery.condition = 100;
    expect(getTrainingGroundRecoveryMultiplier(upgraded)).toBeGreaterThan(1);
    expect(getTrainingGroundRecoveryMultiplier(base.currentClub)).toBe(1);
  });

  it("applies existing presets into the same drill-aware plan pipeline and preserves it through save/load", () => {
    const state = buildInitialState();
    const presetId = state.trainPresets![0]!.id;
    const playerIds = [state.currentClub.playerIds[0]!];
    const configured = gameReducer(state, {
      type: "UPDATE_TRAINING_PRESET",
      presetId,
      patch: { drills: ["drill_finishing"], selectedPlayerIds: playerIds },
    });
    const applied = gameReducer(configured, { type: "APPLY_TRAINING_PRESET", presetId });
    const plan = applied.training.find((item) => item.id === applied.selectedTrainingPlanId);
    expect(plan?.drillIds).toEqual(["drill_finishing"]);
    expect(sanitizeLoadedGameState(JSON.parse(JSON.stringify(applied)))?.training).toContainEqual(plan);
  });
});
