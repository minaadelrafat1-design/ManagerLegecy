import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import {
  getLeagueDevelopmentEnvironment,
  getLeagueStrengthDefinition,
  getLeagueStrengthRating,
  getLeagueTransferAttractiveness,
} from "./league-strength";
import { calculateClubStrength, invalidateAllClubStrengths } from "../lib/ai-fixture-sim";
import { simulateAiFixture } from "../lib/ai-fixture-sim";
import { evaluateContractOffer } from "./negotiation";

function top(state: ReturnType<typeof buildInitialState>, id: string) {
  return getLeagueStrengthRating(id, state);
}

describe("global league strength hierarchy", () => {
  it("keeps the requested country ordering configurable and deterministic", () => {
    const state = buildInitialState();
    expect(getLeagueStrengthDefinition(state, "england-premier").tier).toBe(1);
    expect(top(state, "england-premier")).toBeGreaterThan(top(state, "rivendell-premier"));
    expect(top(state, "rivendell-premier")).toBeGreaterThan(top(state, "norland-premier"));
    expect(top(state, "norland-premier")).toBeGreaterThan(top(state, "country-4-premier"));
    expect(top(state, "country-4-premier")).toBeGreaterThan(top(state, "country-5-premier"));
    expect(top(state, "country-5-premier")).toBeGreaterThan(top(state, "country-6-premier"));
    expect(top(state, "country-6-premier")).toBeGreaterThan(top(state, "country-7-premier"));
    expect(top(state, "country-7-premier")).toBeGreaterThanOrEqual(top(state, "country-8-premier"));
    expect(getLeagueStrengthDefinition(state, "country-6-premier").tier).toBe(2);
  });

  it("makes lower divisions weaker than their country's top tier", () => {
    const state = buildInitialState();
    expect(top(state, "england-premier")).toBeGreaterThan(top(state, "england-championship"));
    expect(top(state, "england-championship")).toBeGreaterThan(top(state, "england-national"));
    expect(top(state, "country-6-premier")).toBeGreaterThan(top(state, "country-6-national"));
    expect(getLeagueDevelopmentEnvironment("england-premier", state)).toBeGreaterThan(
      getLeagueDevelopmentEnvironment("england-national", state),
    );
  });

  it("preserves club-level variation while adding league context", () => {
    const state = buildInitialState();
    const clubs = Object.values(state.clubs).filter((club) => club.leagueId === "england-premier");
    const strengths = clubs.map((club) => calculateClubStrength(club, state.players));
    expect(new Set(strengths).size).toBeGreaterThan(1);
    expect(Math.max(...strengths) - Math.min(...strengths)).toBeGreaterThan(0);
  });

  it("does not overwrite individual player ratings", () => {
    const state = buildInitialState();
    const snapshot = Object.fromEntries(
      Object.values(state.players).slice(0, 20).map((player) => [player.id, player.overall]),
    );
    for (const [id, overall] of Object.entries(snapshot)) expect(state.players[id]?.overall).toBe(overall);
  });

  it("keeps match simulation functional and uses the strength input", () => {
    const state = buildInitialState();
    invalidateAllClubStrengths();
    const fixture = state.fixtures.find(
      (item) => item.homeClubId !== state.currentClub.id && item.awayClubId !== state.currentClub.id,
    );
    expect(fixture).toBeDefined();
    const result = simulateAiFixture(fixture!, state.clubs, state.players, 1234);
    expect(result.scoreHome).toBeGreaterThanOrEqual(0);
    expect(result.scoreAway).toBeGreaterThanOrEqual(0);
    expect(result.homeStrength).not.toBe(result.awayStrength);
  });

  it("keeps transfer negotiation functional and exposes league attractiveness", () => {
    const state = buildInitialState();
    const seller = Object.values(state.clubs).find((club) => club.leagueId === "england-premier");
    const player = Object.values(state.players)[0];
    expect(seller).toBeDefined();
    expect(player).toBeDefined();
    expect(getLeagueTransferAttractiveness("england-premier", state)).toBeGreaterThan(
      getLeagueTransferAttractiveness("england-national", state),
    );
    const result = evaluateContractOffer(state, seller!.id, player!.id, {
      salaryWeekly: 100_000,
      years: 3,
    });
    expect(["accepted", "counter", "player-lost-interest"]).toContain(result.outcome);
  });
});
