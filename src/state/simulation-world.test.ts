import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import {
  SimulationWorld,
  createSimulationWorld,
  buildSimulationWorld,
} from "./simulation-world";
import {
  SimulationScheduler,
  createSimulationScheduler,
  buildSimulationScheduler,
} from "./simulation-scheduler";

describe("simulation world seam", () => {
  it("rebuilds deterministic indexes without mutating game state", () => {
    const state = buildInitialState("simulation-world-seam");
    const world = SimulationWorld.fromGameState(state);

    expect(world.toGameState()).toBe(state);
    expect(world.gameState).toBe(state);
    expect(Object.keys(world.fixturesByDate).length).toBeGreaterThan(0);
    expect(Object.keys(world.fixturesByClub).length).toBeGreaterThan(0);
    expect(Object.keys(world.playersByClub).length).toBeGreaterThan(0);
    expect(Object.keys(world.eventsByDueDate).length).toBeGreaterThanOrEqual(0);
    expect(Object.keys(world.negotiationsByPlayer).length).toBeGreaterThanOrEqual(0);

    const firstFixture = state.fixtures[0];
    expect(world.fixturesByDate[firstFixture.calendarDate]).toContainEqual(firstFixture);
    expect(world.fixturesByClub[firstFixture.homeClubId]).toContainEqual(firstFixture);

    const rebuilt = buildSimulationWorld(state);
    expect(rebuilt.toGameState()).toBe(state);
    expect(Object.keys(rebuilt.fixturesByDate)).toEqual(Object.keys(world.fixturesByDate));
    expect(Object.keys(rebuilt.playersByClub)).toEqual(Object.keys(world.playersByClub));
    expect(rebuilt.playersByClub[firstFixture.homeClubId]?.length).toBeGreaterThan(0);
  });

  it("exposes deterministic date and club fixture accessors used by the daily pipeline", () => {
    const state = buildInitialState("simulation-world-accessors");
    const world = createSimulationWorld(state);
    const fixture = state.fixtures[0];

    expect(world.getFixtureById(fixture.id)).toEqual(fixture);
    expect(world.getFixturesForDate(fixture.calendarDate)).toEqual(world.fixturesByDate[fixture.calendarDate]);
    expect(world.getFixturesForClub(fixture.homeClubId)).toEqual(world.fixturesByClub[fixture.homeClubId]);
    expect(world.getScheduledFixtures()).toEqual(state.fixtures.filter((entry) => entry.status === "scheduled"));
  });

  it("creates a deterministic scheduler from the derived world", () => {
    const state = buildInitialState("simulation-scheduler-seam");
    const world = createSimulationWorld(state);
    const scheduler = new SimulationScheduler(world);
    const queued = scheduler.getDueQueue();

    expect(Array.isArray(queued)).toBe(true);
    expect(queued).toEqual(scheduler.getDueQueue());
    expect(queued.every((item) => item.priority > 0)).toBe(true);

    const altScheduler = buildSimulationScheduler(state);
    expect(altScheduler.getDueQueue()).toEqual(queued);
    expect(createSimulationScheduler(state).getDueQueue()).toEqual(queued);
  });
});
