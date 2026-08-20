import { describe, expect, it } from "vitest";
import { applyEuropeanQualificationRegistrations } from "./qualification";
import { buildInitialState } from "./seed";
import type { EuropeanQualificationRegistration, GameState } from "./types";

function registrationKeys(state: GameState): string[] {
  return (state.meta?.europeanQualifications ?? []).map(
    (entry) => `${entry.season}:${entry.competitionId}:${entry.clubId}`,
  );
}

function withRegistrations(
  state: GameState,
  registrations: EuropeanQualificationRegistration[],
): GameState {
  return {
    ...state,
    meta: {
      ...(state.meta ?? {}),
      europeanQualifications: registrations,
    },
  };
}

describe("European qualification registration persistence", () => {
  it("creates the expected first-season entries", () => {
    const state = buildInitialState("qualification-first-registration");
    const next = applyEuropeanQualificationRegistrations(state);
    const registrations = next.meta?.europeanQualifications ?? [];

    expect(registrations).toHaveLength(5);
    expect(new Set(registrationKeys(next)).size).toBe(registrations.length);
    expect(registrations.every((entry) => entry.season === String(state.time.season))).toBe(true);
  });

  it("is idempotent when applied twice to the same state", () => {
    const state = buildInitialState("qualification-idempotency");
    const once = applyEuropeanQualificationRegistrations(state);
    const twice = applyEuropeanQualificationRegistrations(once);

    expect(twice.meta?.europeanQualifications).toEqual(once.meta?.europeanQualifications);
    expect(new Set(registrationKeys(twice)).size).toBe(
      twice.meta?.europeanQualifications?.length,
    );
  });

  it("preserves valid registrations from another competition", () => {
    const state = buildInitialState("qualification-other-competition");
    const worldCompetitions = state.meta?.worldConfig?.competitions ?? [];
    const continentalIds = worldCompetitions
      .filter((competition) => competition.type === "continental")
      .map((competition) => competition.id);
    const existing: EuropeanQualificationRegistration = {
      season: String(state.time.season),
      competitionId: continentalIds[1]!,
      clubId: Object.keys(state.clubs)[0]!,
      reason: "Existing registration",
      registeredAt: state.time.date,
      stage: "qualification",
    };
    const next = applyEuropeanQualificationRegistrations(withRegistrations(state, [existing]));

    expect(next.meta?.europeanQualifications).toContainEqual(existing);
  });

  it("preserves valid registrations from another season", () => {
    const state = buildInitialState("qualification-other-season");
    const competitionId = state.meta?.worldConfig?.competitions.find(
      (competition) => competition.type === "continental",
    )?.id;
    const existing: EuropeanQualificationRegistration = {
      season: "2025/26",
      competitionId: competitionId!,
      clubId: Object.keys(state.clubs)[0]!,
      reason: "Historical registration",
      registeredAt: "2025-08-01",
      stage: "qualification",
    };
    const next = applyEuropeanQualificationRegistrations(withRegistrations(state, [existing]));

    expect(next.meta?.europeanQualifications).toContainEqual(existing);
  });

  it("produces deterministic registration output for the same input state", () => {
    const first = buildInitialState("qualification-determinism");
    const second = buildInitialState("qualification-determinism");

    const firstResult = applyEuropeanQualificationRegistrations(first);
    const secondResult = applyEuropeanQualificationRegistrations(second);

    expect(firstResult.meta?.europeanQualifications).toEqual(
      secondResult.meta?.europeanQualifications,
    );
  });

  it("keeps registrations limited to valid clubs and continental competitions", () => {
    const state = buildInitialState("qualification-valid-references");
    const next = applyEuropeanQualificationRegistrations(state);
    const validCompetitionIds = new Set(
      (state.meta?.worldConfig?.competitions ?? [])
        .filter((competition) => competition.type === "continental")
        .map((competition) => competition.id),
    );

    for (const entry of next.meta?.europeanQualifications ?? []) {
      expect(state.clubs[entry.clubId]).toBeDefined();
      expect(validCompetitionIds.has(entry.competitionId)).toBe(true);
      expect(entry.season).toBe(String(state.time.season));
    }
  });
});
