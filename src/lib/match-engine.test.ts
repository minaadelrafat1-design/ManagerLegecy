import {
  simulateMatch,
  DEFAULT_HOME_TACTICS,
  DEFAULT_AWAY_TACTICS,
  type SimTeamInput,
} from "@/lib/match-engine";
import { buildInitialState } from "@/state/seed";
import { describe, it, expect } from "vitest";

describe("Goal rate analysis", () => {
  it("measure average goals per match across different seeds", () => {
    const state = buildInitialState("0");
    const homeClub = state.clubs[state.currentClub?.id ?? ""];
    const awayClubs = Object.values(state.clubs ?? {}).filter(
      (c: any) => c.id !== state.currentClub?.id,
    );
    const awayClub = awayClubs[0];

    if (!homeClub || !awayClub) {
      console.log("Skipping: Could not find clubs");
      return;
    }

    const homePlayers = Object.values(state.players ?? {})
      .filter((p: any) => p.clubId === homeClub.id && p.status !== "retired")
      .slice(0, 23);
    const awayPlayers = Object.values(state.players ?? {})
      .filter((p: any) => p.clubId === awayClub.id && p.status !== "retired")
      .slice(0, 23);

    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      console.log("Skipping: Not enough players");
      return;
    }

    const simPlayers = (players: any[]) =>
      players.map((p) => ({
        id: p.id,
        shortName: p.shortName,
        number: p.number,
        pos: p.pos,
        role: p.role,
        x: p.x ?? 50,
        y: p.y ?? 50,
        baseFitness: p.fitness ?? 80,
        overall: p.overall ?? 50,
        attack: (p.attrs?.shooting ?? 50) * 0.38 + (p.attrs?.dribbling ?? 50) * 0.24,
        defend: (p.attrs?.defending ?? 50) * 0.46 + (p.attrs?.physical ?? 50) * 0.24,
        playmaking: (p.attrs?.passing ?? 50) * 0.52 + (p.attrs?.dribbling ?? 50) * 0.28,
        discipline: p.professionalism ?? 50,
        isGK: p.pos === "GK",
      }));

    const homeTeam: SimTeamInput = {
      id: "home",
      name: homeClub.name,
      xi: simPlayers(homePlayers.slice(0, 11)),
      bench: simPlayers(homePlayers.slice(11)),
      tactics: DEFAULT_HOME_TACTICS,
      homeAdvantage: true,
      formation: "4-3-3",
    };

    const awayTeam: SimTeamInput = {
      id: "away",
      name: awayClub.name,
      xi: simPlayers(awayPlayers.slice(0, 11)),
      bench: simPlayers(awayPlayers.slice(11)),
      tactics: DEFAULT_AWAY_TACTICS,
      homeAdvantage: false,
      formation: "4-2-3-1",
    };

    const results: { seed: number; homeGoals: number; awayGoals: number; total: number }[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const match = simulateMatch(homeTeam, awayTeam, seed);
      results.push({
        seed,
        homeGoals: match.finalScore.home,
        awayGoals: match.finalScore.away,
        total: match.finalScore.home + match.finalScore.away,
      });
    }

    const avgTotal = results.reduce((s, r) => s + r.total, 0) / results.length;
    const avgHome = results.reduce((s, r) => s + r.homeGoals, 0) / results.length;
    const avgAway = results.reduce((s, r) => s + r.awayGoals, 0) / results.length;
    const maxTotal = Math.max(...results.map((r) => r.total));
    const minTotal = Math.min(...results.map((r) => r.total));

    console.log("\n=== GOAL RATE ANALYSIS ===");
    console.log(`Matches analyzed: ${results.length}`);
    console.log(`Average total goals: ${avgTotal.toFixed(2)}`);
    console.log(`Average home goals: ${avgHome.toFixed(2)}`);
    console.log(`Average away goals: ${avgAway.toFixed(2)}`);
    console.log(`Goal range: ${minTotal}-${maxTotal}`);
    console.log(`\nSample results:`);
    for (const r of results.slice(0, 10)) {
      console.log(`  Seed ${r.seed}: ${r.homeGoals}-${r.awayGoals} (${r.total} total)`);
    }

    // Normal football is ~2.5-3.0 goals per match
    // If we're seeing 4.0-5.9, something is wrong
    expect(avgTotal).toBeLessThan(4.0, "Goal rate is excessively high");
  });

  it("trace shot generation in a single match", () => {
    const state = buildInitialState("0");
    const homeClub = state.clubs[state.currentClub?.id ?? ""];
    const awayClubs = Object.values(state.clubs ?? {}).filter(
      (c: any) => c.id !== state.currentClub?.id,
    );
    const awayClub = awayClubs[0];

    if (!homeClub || !awayClub) {
      console.log("Skipping: Could not find clubs");
      return;
    }

    const homePlayers = Object.values(state.players ?? {})
      .filter((p: any) => p.clubId === homeClub.id && p.status !== "retired")
      .slice(0, 23);
    const awayPlayers = Object.values(state.players ?? {})
      .filter((p: any) => p.clubId === awayClub.id && p.status !== "retired")
      .slice(0, 23);

    const simPlayers = (players: any[]) =>
      players.map((p) => ({
        id: p.id,
        shortName: p.shortName,
        number: p.number,
        pos: p.pos,
        role: p.role,
        x: p.x ?? 50,
        y: p.y ?? 50,
        baseFitness: p.fitness ?? 80,
        overall: p.overall ?? 50,
        attack: (p.attrs?.shooting ?? 50) * 0.38 + (p.attrs?.dribbling ?? 50) * 0.24,
        defend: (p.attrs?.defending ?? 50) * 0.46 + (p.attrs?.physical ?? 50) * 0.24,
        playmaking: (p.attrs?.passing ?? 50) * 0.52 + (p.attrs?.dribbling ?? 50) * 0.28,
        discipline: p.professionalism ?? 50,
        isGK: p.pos === "GK",
      }));

    const homeTeam: SimTeamInput = {
      id: "home",
      name: homeClub.name,
      xi: simPlayers(homePlayers.slice(0, 11)),
      bench: simPlayers(homePlayers.slice(11)),
      tactics: DEFAULT_HOME_TACTICS,
      homeAdvantage: true,
      formation: "4-3-3",
    };

    const awayTeam: SimTeamInput = {
      id: "away",
      name: awayClub.name,
      xi: simPlayers(awayPlayers.slice(0, 11)),
      bench: simPlayers(awayPlayers.slice(11)),
      tactics: DEFAULT_AWAY_TACTICS,
      homeAdvantage: false,
      formation: "4-2-3-1",
    };

    const match = simulateMatch(homeTeam, awayTeam, 42);

    console.log("\n=== SHOT EVENT BREAKDOWN ===");
    const goals = match.events.filter((e) => e.type === "goal");
    const shots = match.events.filter((e) => e.type === "shot");
    const shotsOnTarget = match.events.filter(
      (e) => e.type === "shot" || e.type === "goal" || e.type === "save",
    );
    const chances = match.events.filter((e) => e.type === "chance");
    const corners = match.events.filter((e) => e.type === "corner");

    console.log(`Final score: ${match.finalScore.home}-${match.finalScore.away}`);
    console.log(`Total goals: ${goals.length}`);
    console.log(`Total shots: ${shots.length}`);
    console.log(`Shots on target (shots/goals/saves): ${shotsOnTarget.length}`);
    console.log(`Chances: ${chances.length}`);
    console.log(`Corners: ${corners.length}`);
    console.log(`Full-time minute: ${match.fullTimeMinute}`);

    const eventChance = 0.36 + (72 + 54 - 110) / 900; // DEFAULT_HOME_TACTICS.tempo + DEFAULT_AWAY_TACTICS.tempo
    const expectedEvents = match.fullTimeMinute * eventChance;
    console.log(`\nExpected notable events: ${expectedEvents.toFixed(1)}`);
    console.log(
      `Actual events generated: ${match.events.filter((e) => !["whistle", "info"].includes(e.type)).length}`,
    );

    // List all goals
    if (goals.length > 0) {
      console.log(`\nGoals:`);
      for (const g of goals) {
        console.log(`  Min ${g.minute}: ${g.text}`);
      }
    }
  });
});
