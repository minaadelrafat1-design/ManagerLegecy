import { describe, it, expect } from "vitest";
import { advanceGameDays } from "./calendar";
import { buildInitialState } from "./seed";
import { parseMoney } from "./finance";
import {
  applyTrainingGroundMaintenance,
  createTrainingGroundDefaults,
  getTrainingGroundDevelopmentMultiplier,
  getTrainingGroundOverview,
  queueTrainingGroundUpgrade,
} from "./training-ground";
import { gameReducer } from "./reducer";
import { runMonthlyPlayerDevelopment } from "./player-development";

describe("training ground infrastructure", () => {
  it("builds a training ground overview for the current club", () => {
    const state = buildInitialState();
    const overview = getTrainingGroundOverview(state.currentClub);

    expect(overview.facilities.length).toBeGreaterThan(3);
    expect(overview.equipment.length).toBeGreaterThan(3);
    expect(overview.totalCondition).toBeGreaterThan(0);
  });

  it("queues equipment upgrades and spends funds", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    state.finances.balance = "€120M";

    const next = queueTrainingGroundUpgrade(state, "equipment", "shooting");

    expect(next.currentClub.trainingGround?.upgrades.some((u) => u.assetId === "shooting")).toBe(true);
    expect(parseMoney(next.finances.balance)).toBeLessThan(parseMoney("€120M"));
  });

  it("queues a training ground upgrade through the reducer action", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    state.finances.balance = "€120M";

    const next = gameReducer(state, {
      type: "QUEUE_TRAINING_GROUND_UPGRADE",
      kind: "equipment",
      assetId: "shooting",
    });

    expect(next.currentClub.trainingGround?.upgrades.some((u) => u.assetId === "shooting")).toBe(true);
    expect(parseMoney(next.finances.balance)).toBeLessThan(parseMoney("€120M"));
  });

  it("blocks upgrades when funds are insufficient", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    state.finances.balance = "€200K";

    const next = queueTrainingGroundUpgrade(state, "equipment", "shooting");

    expect(next.currentClub.trainingGround?.upgrades).toHaveLength(0);
    expect(next.finances.balance).toBe("€200K");
  });

  it("completes an upgrade after the configured calendar time", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    state.finances.balance = "€200M";

    const started = queueTrainingGroundUpgrade(state, "facility", "gym");
    const upgrade = started.currentClub.trainingGround?.upgrades[0];
    expect(upgrade?.status).toBe("in_progress");

    const advanced = advanceGameDays(started, (upgrade?.durationDays ?? 0) + 1);
    const completed = advanced.currentClub.trainingGround?.upgrades[0];

    expect(completed?.status).toBe("completed");
    expect(advanced.currentClub.trainingGround?.facilities.gym.level).toBeGreaterThan(1);
  });

  it("applies maintenance costs and degrades condition", () => {
    const state = buildInitialState();
    const defaults = createTrainingGroundDefaults(state.currentClub);
    state.currentClub.trainingGround = defaults;
    state.finances.balance = "€35M";

    const next = applyTrainingGroundMaintenance(state);

    expect(parseMoney(next.finances.balance)).toBeLessThan(parseMoney(state.finances.balance));
    expect(next.currentClub.trainingGround?.facilities.gym.condition).toBeLessThanOrEqual(defaults.facilities.gym.condition);
  });

  it("boosts relevant development based on facility and equipment quality", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    state.currentClub.trainingGround.equipment.shooting.level = 3;
    state.currentClub.trainingGround.equipment.shooting.condition = 90;
    state.currentClub.trainingGround.facilities.analysisSuite.level = 3;
    state.currentClub.trainingGround.facilities.analysisSuite.condition = 90;

    const multiplier = getTrainingGroundDevelopmentMultiplier(state.currentClub, "shooting");
    expect(multiplier).toBeGreaterThan(1);
  });

  it("keeps save/load game data serializable", () => {
    const state = buildInitialState();
    state.currentClub.trainingGround = createTrainingGroundDefaults(state.currentClub);
    const clone = JSON.parse(JSON.stringify(state));

    expect(clone.currentClub.trainingGround?.facilities.gym.level).toBeGreaterThan(0);
    expect(clone.currentClub.trainingGround?.equipment.strength.level).toBeGreaterThan(0);
  });

  it("does not break monthly player development flow", () => {
    const state = buildInitialState();
    const before = runMonthlyPlayerDevelopment(state);
    expect(before.players).toBeDefined();
    expect(Object.keys(before.players).length).toBeGreaterThan(0);
  });
});
