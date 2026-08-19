import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { gameReducer } from "./reducer";
import {
  SCOUT_TIER_DEFINITIONS,
  getAvailableScoutingTargets,
  isValidScoutingTarget,
  deployScoutingAssignment,
  hireScout,
  advanceScoutingAssignments,
} from "./scouting-network";
import { parseMoney } from "./finance";
import { saveToStorage, loadFromStorage } from "./persistence";

describe("Scouting Network Foundation", () => {
  it("exposes scout tiers with balanced capability data", () => {
    expect(SCOUT_TIER_DEFINITIONS.length).toBeGreaterThanOrEqual(3);
    expect(SCOUT_TIER_DEFINITIONS[0]).toMatchObject({
      cost: expect.any(Number),
      reportSpeedDays: expect.any(Number),
      scoutingAccuracy: expect.any(Number),
      discoveryQuality: expect.any(Number),
      geographicReach: expect.any(Array),
    });
    expect(SCOUT_TIER_DEFINITIONS[0].cost).toBeGreaterThan(0);
    expect(SCOUT_TIER_DEFINITIONS[0].reportSpeedDays).toBeGreaterThan(0);
  });

  it("deducts the real scouting cost on deployment", () => {
    const state = buildInitialState();
    const scout = hireScout(state, "regional-scout", "Marta Ruiz");
    const before = parseMoney(scout.finances.balance);
    const deployed = deployScoutingAssignment(scout, {
      scoutId: scout.scoutingNetwork.scouts[0].id,
      targetCountryId: "england",
      durationDays: 30,
      assignmentLabel: "England",
    });
    const after = parseMoney(deployed.finances.balance);

    expect(after).toBeLessThan(before);
    expect(deployed.financialTransactions.some((txn) => txn.type === "scouting")).toBe(true);
    expect(deployed.scoutingNetwork.assignments).toHaveLength(1);
  });

  it("creates an active scouting assignment with valid metadata", () => {
    const state = buildInitialState();
    const hired = hireScout(state, "continental-scout", "Noah Bell");
    const deployed = deployScoutingAssignment(hired, {
      scoutId: hired.scoutingNetwork.scouts[0].id,
      targetCountryId: "england",
      durationDays: 45,
      assignmentLabel: "England",
    });

    expect(deployed.scoutingNetwork.assignments[0].status).toBe("active");
    expect(deployed.scoutingNetwork.assignments[0].targetCountryId).toBe("england");
    expect(deployed.scoutingNetwork.assignments[0].progressDays).toBe(0);
  });

  it("accepts valid region and country targets from the world config", () => {
    const state = buildInitialState();
    const targets = getAvailableScoutingTargets(state);

    expect(targets.some((target) => target.id === "england")).toBe(true);
    expect(isValidScoutingTarget(state, "england")).toBe(true);
    expect(isValidScoutingTarget(state, "invalid-region")).toBe(false);
  });

  it("tracks progress over in-game days without double-processing", () => {
    const state = buildInitialState();
    const hired = hireScout(state, "regional-scout", "Luca Moretti");
    const deployed = deployScoutingAssignment(hired, {
      scoutId: hired.scoutingNetwork.scouts[0].id,
      targetCountryId: "norland",
      durationDays: 14,
      assignmentLabel: "Norland",
    });

    const advanced = advanceScoutingAssignments(deployed, deployed.time.date);
    const progressedAgain = advanceScoutingAssignments(advanced, advanced.time.date);

    expect(progressedAgain.scoutingNetwork.assignments[0].progressDays).toBe(
      advanced.scoutingNetwork.assignments[0].progressDays,
    );
    expect(progressedAgain.scoutingNetwork.assignments[0].lastProcessedDate).toBe(
      advanced.scoutingNetwork.assignments[0].lastProcessedDate,
    );
  });

  it("persists scouts and assignments through save/load", () => {
    const state = buildInitialState();
    const hired = hireScout(state, "global-scout", "Ana Costa");
    const deployed = deployScoutingAssignment(hired, {
      scoutId: hired.scoutingNetwork.scouts[0].id,
      targetCountryId: "norland",
      durationDays: 21,
      assignmentLabel: "Norland",
    });

    const key = "ml_game_state_test";
    saveToStorage(key, 10, deployed);
    const roundTripped = loadFromStorage<typeof deployed>(key, 10, {});

    expect(roundTripped.status).toBe("ok");
    expect(roundTripped.data.scoutingNetwork.scouts).toHaveLength(1);
    expect(roundTripped.data.scoutingNetwork.assignments).toHaveLength(1);
  });

  it("prevents duplicate invalid assignments and insufficient funds", () => {
    const state = buildInitialState();
    const scout = hireScout(state, "local-scout", "Kira Dorsey");
    const first = deployScoutingAssignment(scout, {
      scoutId: scout.scoutingNetwork.scouts[0].id,
      targetCountryId: "england",
      durationDays: 30,
      assignmentLabel: "England",
    });

    const duped = deployScoutingAssignment(first, {
      scoutId: first.scoutingNetwork.scouts[0].id,
      targetCountryId: "england",
      durationDays: 30,
      assignmentLabel: "England",
    });

    expect(duped.scoutingNetwork.assignments).toHaveLength(1);

    const unaffordable = gameReducer(
      { ...first, finances: { ...first.finances, balance: "€0" } },
      {
        type: "DEPLOY_SCOUTING_ASSIGNMENT",
        scoutId: first.scoutingNetwork.scouts[0].id,
        targetCountryId: "rivendell",
        durationDays: 30,
      },
    );

    expect(unaffordable.scoutingNetwork.assignments).toHaveLength(1);
  });

  it("supports hiring and deploying scouts through reducer actions", () => {
    const state = buildInitialState();
    const hired = gameReducer(state, {
      type: "HIRE_SCOUT",
      tierId: "regional-scout",
      name: "Marta Ruiz",
    });

    expect(hired.scoutingNetwork?.scouts).toHaveLength(1);
    expect(hired.scoutingNetwork?.scouts[0].name).toBe("Marta Ruiz");

    const scoutId = hired.scoutingNetwork!.scouts[0].id;
    const deployed = gameReducer(hired, {
      type: "DEPLOY_SCOUTING_ASSIGNMENT",
      scoutId,
      targetCountryId: "england",
      durationDays: 30,
      assignmentLabel: "England",
    });

    expect(deployed.scoutingNetwork?.assignments).toHaveLength(1);
    expect(deployed.scoutingNetwork?.assignments[0].targetCountryId).toBe("england");
  });
});
