import { describe, expect, it } from "vitest";

import { buildInitialState } from "./seed";
import {
  checkAllInvariants,
  countCompletedTransfers,
  detectAgeDrift,
  detectDuplicateRetirementEvents,
  detectInvalidYouthGeneration,
  detectRetiredPlayerInSquad,
} from "./event-invariants";
import { buildYouthPlayerId } from "./academy";

describe("player lifecycle invariants", () => {
  it("flags age drift when a player age no longer matches DOB", () => {
    const state = buildInitialState();
    const playerId = Object.keys(state.players)[0];
    const player = state.players[playerId];

    const nextState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          age: 99,
        },
      },
    };

    const violations = detectAgeDrift(nextState);
    expect(violations.some((v) => v.type === "PLAYER_AGE_DRIFT")).toBe(true);
  });

  it("flags a retired player still present in an active squad", () => {
    const state = buildInitialState();
    const playerId = Object.keys(state.players)[0];
    const clubId = state.players[playerId].clubId ?? Object.keys(state.clubs)[0];

    const nextState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...state.players[playerId],
          status: "retired",
        },
      },
      clubs: {
        ...state.clubs,
        [clubId]: {
          ...state.clubs[clubId],
          playerIds: [...state.clubs[clubId].playerIds, playerId],
        },
      },
    };

    const violations = detectRetiredPlayerInSquad(nextState);
    expect(violations.some((v) => v.type === "RETIRED_PLAYER_IN_SQUAD")).toBe(true);
  });

  it("flags duplicate retirement events for the same player", () => {
    const state = buildInitialState();
    const playerId = Object.keys(state.players)[0];
    const nextState = {
      ...state,
      events: [
        ...state.events,
        {
          id: "ret-1",
          date: state.time.date,
          type: "PLAYER_RETIRED",
          meta: { playerId },
        },
        {
          id: "ret-2",
          date: state.time.date,
          type: "PLAYER_RETIRED",
          meta: { playerId },
        },
      ],
    };

    const violations = detectDuplicateRetirementEvents(nextState);
    expect(violations.some((v) => v.type === "DUPLICATE_RETIREMENT_EVENT")).toBe(true);
  });

  it("flags youth generation events that do not create valid players", () => {
    const state = buildInitialState();
    const playerId = "youth-fake";
    const nextState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...Object.values(state.players)[0],
          id: playerId,
          name: "Fake Youth",
          age: 22,
          dateOfBirth: "2003-08-01",
          status: "available",
        },
      },
      events: [
        ...state.events,
        {
          id: "youth-1",
          date: state.time.date,
          type: "YOUTH_GENERATED",
          meta: { playerId },
        },
      ],
    };

    const violations = detectInvalidYouthGeneration(nextState);
    expect(violations.some((v) => v.type === "YOUTH_GENERATED_INVALID")).toBe(true);
  });

  it("countCompletedTransfers ignores non-completion transfer activity", () => {
    const state = buildInitialState();

    const nextState = {
      ...state,
      events: [
        ...state.events,
        {
          id: "neg-1",
          date: state.time.date,
          type: "transfer",
          description: "Negotiation started: buyer -> seller",
          meta: { action: "negotiation_start" },
        },
      ],
    };

    expect(countCompletedTransfers(nextState)).toBe(0);
  });

  it("creates distinct youth IDs even when club slugs share the same suffix", () => {
    const clubSeedA = "country-8-championship-club-3:2027-08-01:0";
    const clubSeedB = "norland-championship-club-3:2027-08-01:0";
    const clubSeedC = "country-8-championship-club-3:2027-08-01:1";

    const idA = buildYouthPlayerId(clubSeedA, "Mendes", 18);
    const idB = buildYouthPlayerId(clubSeedB, "Mendes", 18);
    const idC = buildYouthPlayerId(clubSeedC, "Mendes", 18);

    expect(idA).not.toBe(idB);
    expect(idA).not.toBe(idC);
    expect(new Set([idA, idB, idC]).size).toBe(3);
  });

  it("includes lifecycle invariant checks in the aggregate report", () => {
    const state = buildInitialState();
    const playerId = Object.keys(state.players)[0];
    const clubId = state.players[playerId].clubId ?? Object.keys(state.clubs)[0];

    const badState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...state.players[playerId],
          age: 99,
          status: "retired",
        },
      },
      clubs: {
        ...state.clubs,
        [clubId]: {
          ...state.clubs[clubId],
          playerIds: [...state.clubs[clubId].playerIds, playerId],
        },
      },
      events: [
        ...state.events,
        {
          id: "ret-1",
          date: state.time.date,
          type: "PLAYER_RETIRED",
          meta: { playerId },
        },
        {
          id: "ret-2",
          date: state.time.date,
          type: "PLAYER_RETIRED",
          meta: { playerId },
        },
        {
          id: "youth-1",
          date: state.time.date,
          type: "YOUTH_GENERATED",
          meta: { playerId },
        },
      ],
    };

    const violations = checkAllInvariants(badState);
    expect(violations.length).toBeGreaterThan(0);
  });
});
