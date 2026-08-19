import { describe, expect, it } from "vitest";
import "./stadium";
import "./training-ground";
import { buildInitialState } from "./seed";
import { createStadiumDefaults } from "./stadium";
import { advanceGameDays } from "./calendar";
import { applyTrainingGroundMaintenance } from "./training-ground";
import { parseMoney } from "./finance";

describe("stadium and training ground maintenance cadence", () => {
  it("charges and degrades at the weekly boundary over ten consecutive days", () => {
    let state = buildInitialState();
    const stadium = createStadiumDefaults(state.currentClub);
    const currentClub = { ...state.currentClub, stadium };
    state = {
      ...state,
      currentClub,
      clubs: { ...state.clubs, [currentClub.id]: currentClub },
      finances: { ...state.finances, balance: "€500M" },
      financialTransactions: [],
    };

    const stadiumCharges: number[] = [];
    const trainingCharges: number[] = [];
    const stadiumConditions: number[] = [];
    const trainingConditions: number[] = [];

    for (let day = 0; day < 10; day += 1) {
      const beforeTransactions = new Set((state.financialTransactions ?? []).map((item) => item.id));
      const beforeStadiumCondition = state.currentClub.stadium?.condition ?? 0;
      const beforeTrainingCondition = state.currentClub.trainingGround?.condition ?? 0;
      state = advanceGameDays(state, 1);
      const newTransactions = (state.financialTransactions ?? []).filter(
        (item) => !beforeTransactions.has(item.id),
      );
      stadiumCharges.push(
        newTransactions
          .filter((item) => item.description.includes("stadium maintenance"))
          .reduce((sum, item) => sum + Math.abs(item.amount), 0),
      );
      trainingCharges.push(
        newTransactions
          .filter((item) => item.description.includes("training ground maintenance"))
          .reduce((sum, item) => sum + Math.abs(item.amount), 0),
      );
      stadiumConditions.push(beforeStadiumCondition - (state.currentClub.stadium?.condition ?? 0));
      trainingConditions.push(beforeTrainingCondition - (state.currentClub.trainingGround?.condition ?? 0));
    }

    // One initial pass establishes lastMaintenanceDate, followed by the
    // weekly boundary passes within the ten-day window.
    expect(stadiumCharges.filter((amount) => amount > 0).length).toBe(3);
    expect(trainingCharges.filter((amount) => amount > 0).length).toBe(3);
    expect(stadiumConditions.filter((amount) => amount > 0).length).toBe(3);
    expect(trainingConditions.filter((amount) => amount > 0).length).toBe(3);
    expect(state.currentClub.stadium?.lastMaintenanceDate).toBeDefined();
    expect(state.currentClub.trainingGround?.lastMaintenanceDate).toBeDefined();
  });

  it("does not charge the same training-ground maintenance period after save/load", () => {
    const state = buildInitialState();
    state.finances.balance = "€500M";
    const first = applyTrainingGroundMaintenance(state);
    const reloaded = JSON.parse(JSON.stringify(first));
    const repeated = applyTrainingGroundMaintenance(reloaded);
    expect(parseMoney(repeated.finances.balance)).toBe(parseMoney(first.finances.balance));
    expect(
      (repeated.financialTransactions ?? []).filter((item) =>
        item.description.includes("training ground maintenance"),
      ),
    ).toHaveLength(1);
  });
});
