import { describe, expect, it } from "vitest";
import { advanceGameDays } from "./calendar";
import { buildInitialState } from "./seed";
import { parseMoney } from "./finance";
import {
  applyStadiumMaintenance,
  createStadiumDefaults,
  getStadiumMaintenanceCost,
  getStadiumOverview,
  queueStadiumUpgrade,
} from "./stadium";
import type { GameState } from "./types";

describe("stadium & facilities", () => {
  it("builds a stadium overview for the current club", () => {
    const state = buildInitialState();
    const overview = getStadiumOverview(state.currentClub);

    expect(overview.capacity).toBeGreaterThan(0);
    expect(overview.components.length).toBeGreaterThan(10);
    expect(overview.components.some((entry) => entry.id === "seating")).toBe(true);
    expect(overview.operatingCost).toBeGreaterThan(0);
  });

  it("queues a stadium upgrade and spends funds", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    state.finances.balance = "€80M";

    const next = queueStadiumUpgrade(state, "seating");

    expect(next.currentClub.stadium?.upgrades.some((upgrade) => upgrade.componentId === "seating")).toBe(true);
    expect(parseMoney(next.finances.balance)).toBeLessThan(parseMoney("€80M"));
  });

  it("blocks upgrades when funds are insufficient", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    state.finances.balance = "€1M";

    const next = queueStadiumUpgrade(state, "seating");

    expect(next.currentClub.stadium?.upgrades).toHaveLength(0);
    expect(next.finances.balance).toBe("€1M");
  });

  it("completes an upgrade after the configured advance days", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    state.finances.balance = "€120M";

    const started = queueStadiumUpgrade(state, "pitch");
    const upgrade = started.currentClub.stadium?.upgrades[0];
    expect(upgrade?.status).toBe("in_progress");

    const advanced = advanceGameDays(started, upgrade!.durationDays + 1);
    const completed = advanced.currentClub.stadium?.upgrades[0];

    expect(completed?.status).toBe("completed");
    expect(advanced.currentClub.stadium?.componentLevels.pitch).toBeGreaterThan(1);
  });

  it("applies maintenance expenses and degrades condition over time", () => {
    const state = buildInitialState();
    const soccer = createStadiumDefaults(state.currentClub);
    state.currentClub.stadium = soccer;
    state.finances.balance = "€35M";

    const maintenanceCost = getStadiumMaintenanceCost(state.currentClub);
    const withMaintenance = applyStadiumMaintenance(state);

    expect(maintenanceCost).toBeGreaterThan(0);
    expect(parseMoney(withMaintenance.finances.balance)).toBeLessThan(parseMoney(state.finances.balance));
    expect(withMaintenance.currentClub.stadium?.condition).toBeLessThanOrEqual(soccer.condition);
  });

  it("keeps save/load stadium data in sync with state defaults", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    const clone = JSON.parse(JSON.stringify(state));

    expect(clone.currentClub.stadium?.capacity).toBeGreaterThan(0);
    expect(clone.currentClub.stadium?.componentLevels.seating).toBeGreaterThan(0);
  });

  it("keeps available balance and finances consistent after a stadium update", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    state.finances.balance = "€90M";

    const next = queueStadiumUpgrade(state, "security");
    const originalTotal = parseMoney(state.finances.expenses?.total ?? 0);
    const updatedTotal = parseMoney(next.finances.expenses?.total ?? 0);

    expect(updatedTotal).toBeGreaterThanOrEqual(originalTotal);
    expect(parseMoney(next.finances.balance)).toBeLessThan(parseMoney(state.finances.balance));
  });

  it("preserves day advancement with stadium updates in place", () => {
    const state = buildInitialState();
    state.currentClub.stadium = createStadiumDefaults(state.currentClub);
    const advanced = advanceGameDays(state, 3);

    expect(advanced.time.date).not.toBe(state.time.date);
    expect(advanced.currentClub.stadium?.condition).toBeGreaterThanOrEqual(0);
  });
});
