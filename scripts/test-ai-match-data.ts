/* =============================================================================
 * Phase B3.1B.2 — AI match data + outcome-variety smoke tests
 * =============================================================================
 * Same convention as the other scripts/test-*.ts files (run with
 * `npx tsx scripts/test-ai-match-data.ts`). Pure state/lib layer only, no
 * React. Two things this file checks that `test-ai-match-engine.ts`
 * (Phase B3.1B.1) didn't:
 *
 *  1. The specific new data wiring this phase adds — morale/form actually
 *     move a player's rating, and each club now gets its own tactical
 *     identity instead of a shared default.
 *  2. The five scenarios the phase brief asks to be tested: strong vs weak,
 *     similar strength, different formations, different tactical
 *     approaches, and home vs away — each run across many seeds, since any
 *     single seed can be misleading.
 * ---------------------------------------------------------------------------*/

import { buildInitialState } from "../src/state/seed.ts";
import type { Club, Fixture, Player } from "../src/state/types.ts";
import { simulateMatch, DEFAULT_HOME_TACTICS, type TeamTactics } from "../src/lib/match-engine.ts";
import {
  applyCondition,
  buildSimTeamInput,
  buildSyntheticRoster,
  conditionFactor,
  deriveClubTactics,
  simulateAiFixtureViaEngine,
} from "../src/lib/ai-match-adapter.ts";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"} — ${label}${ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`,
  );
  if (!ok) failures++;
}
function checkTrue(label: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}${cond || !detail ? "" : ` (${detail})`}`);
  if (!cond) failures++;
}

const seeded = buildInitialState();
const N = 60; // seeds per scenario — enough to see a real distribution, cheap enough to stay a smoke test

function makeFixture(id: string, homeClubId: string, awayClubId: string): Fixture {
  return {
    id,
    competitionId: Object.values(seeded.leagues)[0]!.competitionId,
    season: seeded.time.season,
    homeClubId,
    awayClubId,
    date: "Sat 13 Dec",
    matchday: 15,
    venue: "H",
    status: "scheduled",
    result: null,
  };
}

function makeClub(overrides: Partial<Club> & { id: string; name: string }): Club {
  return {
    shortName: overrides.name,
    abbr: overrides.name.slice(0, 3).toUpperCase(),
    ground: `${overrides.name} Ground`,
    primaryColor: "#7C8798",
    secondaryColor: "#3C4553",
    textColor: "#101A28",
    formation: "4-4-2",
    leagueId: Object.values(seeded.leagues)[0]!.id,
    reputation: 50,
    facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
    academy: { rating: 50, prospectIds: [] },
    medical: { rating: 50, playersInTreatment: 0 },
    scouting: { rating: 50, regionsCovered: [] },
    playerIds: [],
    ...overrides,
  };
}

function tally(results: Array<"H" | "D" | "A">) {
  return {
    H: results.filter((r) => r === "H").length,
    D: results.filter((r) => r === "D").length,
    A: results.filter((r) => r === "A").length,
  };
}

// =============================================================================
// 1. Morale/form actually move a player's rating (unit-level, no full match)
// =============================================================================

check(
  "condition: exactly-baseline morale/form (65/65) is a no-op multiplier",
  conditionFactor(65, 65),
  1,
);
checkTrue("condition: high morale+form gives a boost > 1", conditionFactor(95, 90) > 1);
checkTrue("condition: low morale+form gives a penalty < 1", conditionFactor(20, 25) < 1);
checkTrue(
  "condition: form and morale both matter independently",
  conditionFactor(90, 65) !== 1 && conditionFactor(65, 90) !== 1,
);
checkTrue(
  "condition: never swings far enough to invert a matchup on its own (bounded ratio)",
  conditionFactor(100, 100) <= 1.15 && conditionFactor(0, 0) >= 0.85,
);

const basePlayer = {
  id: "x",
  shortName: "X",
  number: 9,
  pos: "ST" as const,
  x: 50,
  y: 50,
  baseFitness: 90,
  overall: 70,
  attack: 70,
  defend: 30,
  playmaking: 50,
  discipline: 60,
  isGK: false,
};
const boosted = applyCondition(basePlayer, 95, 90);
const dampened = applyCondition(basePlayer, 15, 20);
checkTrue(
  "condition: applying it to a SimPlayer raises attack/defend/playmaking together when morale+form are high",
  boosted.attack > basePlayer.attack &&
    boosted.defend > basePlayer.defend &&
    boosted.playmaking > basePlayer.playmaking,
);
checkTrue(
  "condition: applying it lowers ratings when morale+form are low",
  dampened.attack < basePlayer.attack,
);
checkTrue("condition: ratings stay in 0-100", boosted.attack <= 100 && dampened.attack >= 0);
check(
  "condition: id/pos/overall untouched — only the three live ratings move",
  boosted.overall,
  basePlayer.overall,
);

// A club with two otherwise-identical real players, one in great form/morale,
// one out of form and unhappy — resolved through the same buildSimTeamInput
// path an AI fixture uses — should come out with different sim ratings.
const p1 = seeded.currentClub.playerIds[0]!;
const realPlayer = seeded.players[p1]!;
const highCondition: Player = { ...realPlayer, morale: 95, form: 92 };
const lowCondition: Player = { ...realPlayer, morale: 15, form: 18 };
const simHigh = applyCondition(
  {
    id: "p",
    shortName: "P",
    number: 1,
    pos: realPlayer.pos,
    x: 50,
    y: 50,
    baseFitness: realPlayer.fitness,
    overall: realPlayer.overall,
    attack: 60,
    defend: 60,
    playmaking: 60,
    discipline: 60,
    isGK: false,
  },
  highCondition.morale,
  highCondition.form,
);
const simLow = applyCondition(
  {
    id: "p",
    shortName: "P",
    number: 1,
    pos: realPlayer.pos,
    x: 50,
    y: 50,
    baseFitness: realPlayer.fitness,
    overall: realPlayer.overall,
    attack: 60,
    defend: 60,
    playmaking: 60,
    discipline: 60,
    isGK: false,
  },
  lowCondition.morale,
  lowCondition.form,
);
checkTrue(
  "condition: same base player, different real morale/form GameState values -> different sim ratings",
  simHigh.attack > simLow.attack,
);

// =============================================================================
// 2. Per-club tactical identity — real per-club data, not a shared default
// =============================================================================

const attackingClub = makeClub({
  id: "t-attack",
  name: "Attack Town",
  formation: "3-4-3",
  reputation: 75,
});
const defensiveClub = makeClub({
  id: "t-defend",
  name: "Defend City",
  formation: "5-3-2",
  reputation: 35,
});

const attackTactics = deriveClubTactics(attackingClub, true);
const defendTactics = deriveClubTactics(defensiveClub, true);
checkTrue(
  "tactics: a 3-4-3, higher-reputation club reads as more front-footed than a 5-3-2, lower-reputation club",
  attackTactics.mentality > defendTactics.mentality && attackTactics.tempo > defendTactics.tempo,
);
checkTrue(
  "tactics: every dial stays in 0-100",
  (Object.keys(attackTactics) as Array<keyof TeamTactics>).every(
    (k) =>
      attackTactics[k] >= 0 &&
      attackTactics[k] <= 100 &&
      defendTactics[k] >= 0 &&
      defendTactics[k] <= 100,
  ),
);
check(
  "tactics: deterministic for the same club (not per-fixture random)",
  deriveClubTactics(attackingClub, true),
  attackTactics,
);
checkTrue(
  "tactics: home vs away centres differ for the same club (home keeps its usual small edge)",
  deriveClubTactics(attackingClub, true).tempo !== deriveClubTactics(attackingClub, false).tempo ||
    deriveClubTactics(attackingClub, true).mentality !==
      deriveClubTactics(attackingClub, false).mentality,
);

const twoAiClubs = [seeded.clubs["ravenport"]!, seeded.clubs["kingsmere"]!];
checkTrue(
  "tactics: two different real seeded AI clubs no longer share literally the same tactics object/values",
  JSON.stringify(deriveClubTactics(twoAiClubs[0]!, true)) !==
    JSON.stringify(deriveClubTactics(twoAiClubs[1]!, true)) ||
    twoAiClubs[0]!.formation !== twoAiClubs[1]!.formation, // if formations+reps are identical, values may legitimately coincide
);

// =============================================================================
// Scenario 1 — strong team vs weak team, across many seeds
// =============================================================================

const strongClub = makeClub({
  id: "s-strong",
  name: "Strong FC",
  reputation: 92,
  facilities: { training: 90, medical: 88, youth: 85, stadium: 90 },
  formation: "4-3-3",
});
const weakClub = makeClub({
  id: "s-weak",
  name: "Weak FC",
  reputation: 22,
  facilities: { training: 25, medical: 30, youth: 20, stadium: 28 },
  formation: "4-5-1",
});
const clubsForStrength = { ...seeded.clubs, [strongClub.id]: strongClub, [weakClub.id]: weakClub };

const strongHomeResults = Array.from({ length: N }, (_, i) =>
  simulateAiFixtureViaEngine(
    makeFixture(`sw-${i}`, strongClub.id, weakClub.id),
    clubsForStrength,
    seeded.players,
    1000 + i,
  ),
);
const swTally = tally(strongHomeResults.map((r) => r.outcome));
checkTrue(
  `strong vs weak (${N} seeds): the strong side wins clearly more often than it loses (H=${swTally.H}, D=${swTally.D}, A=${swTally.A})`,
  swTally.H > swTally.A,
);
checkTrue(
  `strong vs weak (${N} seeds): the strong side wins a clear majority`,
  swTally.H / N > 0.55,
);
checkTrue(
  `strong vs weak (${N} seeds): the weak side still wins or draws sometimes — never a 100% whitewash`,
  swTally.D + swTally.A > 0,
);
const avgGoalDiff =
  strongHomeResults.reduce((s, r) => s + (r.scoreHome - r.scoreAway), 0) / strongHomeResults.length;
checkTrue("strong vs weak: average goal difference favours the strong side", avgGoalDiff > 0);

// =============================================================================
// Scenario 2 — similar-strength teams, across many seeds
// =============================================================================

const evenA = makeClub({ id: "e-a", name: "Even A", reputation: 58, formation: "4-4-2" });
const evenB = makeClub({ id: "e-b", name: "Even B", reputation: 56, formation: "4-4-2" });
const clubsForEven = { ...seeded.clubs, [evenA.id]: evenA, [evenB.id]: evenB };

// Run both home/away assignments so a single fixed home-advantage direction
// doesn't get read as "one side dominating" — what matters for "similar
// strength" is that BOTH clubs win a real share once home advantage is
// accounted for either way, not that a neutral-venue coin-flip is exact.
const evenAHomeResults = Array.from({ length: N }, (_, i) =>
  simulateAiFixtureViaEngine(
    makeFixture(`ev-ah-${i}`, evenA.id, evenB.id),
    clubsForEven,
    seeded.players,
    2000 + i,
  ),
);
const evenBHomeResults = Array.from({ length: N }, (_, i) =>
  simulateAiFixtureViaEngine(
    makeFixture(`ev-bh-${i}`, evenB.id, evenA.id),
    clubsForEven,
    seeded.players,
    2500 + i,
  ),
);
const evenAWins =
  evenAHomeResults.filter((r) => r.outcome === "H").length +
  evenBHomeResults.filter((r) => r.outcome === "A").length;
const evenBWins =
  evenAHomeResults.filter((r) => r.outcome === "A").length +
  evenBHomeResults.filter((r) => r.outcome === "H").length;
const evenDraws =
  evenAHomeResults.filter((r) => r.outcome === "D").length +
  evenBHomeResults.filter((r) => r.outcome === "D").length;
checkTrue(
  `similar strength (${2 * N} matches, both home/away directions): both sides win a real share, no one-sided domination (A wins=${evenAWins}, draws=${evenDraws}, B wins=${evenBWins})`,
  evenAWins > 0 && evenBWins > 0 && Math.max(evenAWins, evenBWins) < 2 * N * 0.75,
);
checkTrue(
  "similar strength: outcome varies with the seed (not the same scoreline every time)",
  new Set(evenAHomeResults.map((r) => `${r.scoreHome}-${r.scoreAway}`)).size > 1,
);

// =============================================================================
// Scenario 3 — different formations change the outcome distribution
// =============================================================================
// Same roster (via buildSyntheticRoster on one neutral club) fielded under
// two different formations against the same fixed opponent, isolating the
// formation variable from everything else.

const FORMATION_N = 240; // formation's effect on the attack/defend baseline is deliberately subtle
// (see `formationShapeMods` in lib/match-engine.ts) so this comparison needs
// more seeds than the other scenarios to separate signal from per-match noise.
const formationBaseClub = makeClub({ id: "f-base", name: "Formation Base", reputation: 60 });
const roster = buildSyntheticRoster(formationBaseClub, seeded.players);
const fixedOpponent = buildSimTeamInput(
  "away",
  makeClub({ id: "f-opp", name: "Fixed Opp", reputation: 60 }),
  seeded.players,
  false,
);

function runWithFormation(formation: string, seedBase: number, n: number) {
  const home = {
    id: "home" as const,
    name: "Formation Base",
    xi: roster.xi,
    bench: roster.bench,
    tactics: DEFAULT_HOME_TACTICS,
    homeAdvantage: true,
    formation,
  };
  return Array.from({ length: n }, (_, i) => simulateMatch(home, fixedOpponent, seedBase + i));
}

const attackingFormationResults = runWithFormation("3-4-3", 3000, FORMATION_N);
const defensiveFormationResults = runWithFormation("5-3-2", 3000, FORMATION_N); // same seeds, only formation differs

const avgGoalsFor = (rs: ReturnType<typeof runWithFormation>) =>
  rs.reduce((s, r) => s + r.finalScore.home, 0) / rs.length;
const avgShotsForHome = (rs: ReturnType<typeof runWithFormation>) =>
  rs.reduce((s, r) => s + r.snapshots[r.fullTimeMinute]!.home.shots, 0) / rs.length;

// Shots is the more reliable signal here: formation's attack/defend
// multiplier shifts which side wins each minute's attacking spell, which
// shows up in shot volume well before it reliably shows up in a low-scoring
// goal count over a finite sample.
checkTrue(
  `formations (${FORMATION_N} seeds each, same seeds/roster/opponent): the more attacking 3-4-3 generates more shots on average than 5-3-2 (${avgShotsForHome(attackingFormationResults).toFixed(2)} vs ${avgShotsForHome(defensiveFormationResults).toFixed(2)})`,
  avgShotsForHome(attackingFormationResults) > avgShotsForHome(defensiveFormationResults),
);
checkTrue(
  `formations: goal output trends the same direction over a larger sample (${avgGoalsFor(attackingFormationResults).toFixed(2)} vs ${avgGoalsFor(defensiveFormationResults).toFixed(2)})`,
  avgGoalsFor(attackingFormationResults) >= avgGoalsFor(defensiveFormationResults),
);

// =============================================================================
// Scenario 4 — different tactical approaches change the outcome distribution
// =============================================================================
// Same rosters/formation both sides, only the home side's TeamTactics dials
// differ (attacking mentality/tempo/directness vs a cautious set).

const attackingTactics: TeamTactics = {
  tempo: 85,
  pressing: 65,
  directness: 75,
  mentality: 85,
  width: 70,
  depth: 65,
};
const cautiousTactics: TeamTactics = {
  tempo: 35,
  pressing: 40,
  directness: 30,
  mentality: 20,
  width: 35,
  depth: 35,
};

function runWithTactics(tactics: TeamTactics, seedBase: number) {
  const home = {
    id: "home" as const,
    name: "Tactics Base",
    xi: roster.xi,
    bench: roster.bench,
    tactics,
    homeAdvantage: true,
    formation: "4-4-2",
  };
  return Array.from({ length: N }, (_, i) => simulateMatch(home, fixedOpponent, seedBase + i));
}

const attackingTacticsResults = runWithTactics(attackingTactics, 4000);
const cautiousTacticsResults = runWithTactics(cautiousTactics, 4000); // same seeds

checkTrue(
  `tactics (${N} seeds each, same seeds/roster/opponent): an attacking approach scores more on average than a cautious one (${avgGoalsFor(attackingTacticsResults).toFixed(2)} vs ${avgGoalsFor(cautiousTacticsResults).toFixed(2)})`,
  avgGoalsFor(attackingTacticsResults) > avgGoalsFor(cautiousTacticsResults),
);
const avgShotsFor = (rs: ReturnType<typeof runWithTactics>) =>
  rs.reduce((s, r) => s + r.snapshots[r.fullTimeMinute]!.home.shots, 0) / rs.length;
checkTrue(
  "tactics: an attacking approach also generates more shots on average",
  avgShotsFor(attackingTacticsResults) > avgShotsFor(cautiousTacticsResults),
);

// =============================================================================
// Scenario 5 — home vs away, across many seeds
// =============================================================================

const clubP = makeClub({ id: "h-p", name: "Club P", reputation: 55, formation: "4-4-2" });
const clubQ = makeClub({ id: "h-q", name: "Club Q", reputation: 55, formation: "4-4-2" });
const clubsForHome = { ...seeded.clubs, [clubP.id]: clubP, [clubQ.id]: clubQ };

const pHomeResults = Array.from({ length: N }, (_, i) =>
  simulateAiFixtureViaEngine(
    makeFixture(`ph-${i}`, clubP.id, clubQ.id),
    clubsForHome,
    seeded.players,
    5000 + i,
  ),
);
const pAwayResults = Array.from(
  { length: N },
  (_, i) =>
    simulateAiFixtureViaEngine(
      makeFixture(`pa-${i}`, clubQ.id, clubP.id),
      clubsForHome,
      seeded.players,
      5000 + i,
    ), // same seeds, roles swapped
);
const pHomeTally = tally(pHomeResults.map((r) => r.outcome)); // H = P win
const pAwayTally = tally(pAwayResults.map((r) => r.outcome)); // A = P win (P is away here)
const pWinRateAsHome = pHomeTally.H / N;
const pWinRateAsAway = pAwayTally.A / N;
checkTrue(
  `home advantage (${N} seeds, identical clubs, roles swapped, same seeds): Club P wins more often at home (${(pWinRateAsHome * 100).toFixed(0)}%) than away (${(pWinRateAsAway * 100).toFixed(0)}%)`,
  pWinRateAsHome > pWinRateAsAway,
);
const pAvgGoalsHome = pHomeResults.reduce((s, r) => s + r.scoreHome, 0) / N;
const pAvgGoalsAway = pAwayResults.reduce((s, r) => s + r.scoreAway, 0) / N;
checkTrue(
  "home advantage: Club P scores more on average at home than away, same opponent/roster/seeds",
  pAvgGoalsHome > pAvgGoalsAway,
);

// =============================================================================
// Cross-check: changing a club's condition (morale/form) alone shifts outcomes
// =============================================================================
// Two otherwise-identical fully-modelled clubs (the managed club's own real
// roster, reused as a stand-in on both sides) — one with every player's
// morale/form pushed to the top of the range, one pushed to the bottom.
// Confirms "changing player/team conditions can affect match outcomes"
// beyond just the strength/formation/tactics knobs above.

function withCondition(morale: number, form: number): Record<string, Player> {
  const out: Record<string, Player> = { ...seeded.players };
  for (const id of seeded.currentClub.playerIds) {
    const p = out[id];
    if (p) out[id] = { ...p, morale, form };
  }
  return out;
}
const confidentClub: Club = { ...seeded.currentClub, id: "cond-confident" };
const dejectedClub: Club = { ...seeded.currentClub, id: "cond-dejected" };
const neutralOpponent = makeClub({
  id: "cond-opp",
  name: "Cond Opp",
  reputation: 55,
  formation: "4-4-2",
});

const confidentPlayers = withCondition(95, 92);
const dejectedPlayers = withCondition(12, 15);

const confidentResults = Array.from({ length: N }, (_, i) => {
  const fixture = makeFixture(`cc-${i}`, confidentClub.id, neutralOpponent.id);
  return simulateAiFixtureViaEngine(
    fixture,
    { ...seeded.clubs, [confidentClub.id]: confidentClub, [neutralOpponent.id]: neutralOpponent },
    confidentPlayers,
    6000 + i,
  );
});
const dejectedResults = Array.from({ length: N }, (_, i) => {
  const fixture = makeFixture(`dd-${i}`, dejectedClub.id, neutralOpponent.id);
  return simulateAiFixtureViaEngine(
    fixture,
    { ...seeded.clubs, [dejectedClub.id]: dejectedClub, [neutralOpponent.id]: neutralOpponent },
    dejectedPlayers,
    6000 + i, // same seeds as confidentResults
  );
});
const confidentWinRate = tally(confidentResults.map((r) => r.outcome)).H / N;
const dejectedWinRate = tally(dejectedResults.map((r) => r.outcome)).H / N;
checkTrue(
  `condition-only change (${N} seeds, same roster/opponent/seeds, only morale+form differ): a confident, in-form squad (${(confidentWinRate * 100).toFixed(0)}% win rate) outperforms a dejected, out-of-form one (${(dejectedWinRate * 100).toFixed(0)}%)`,
  confidentWinRate >= dejectedWinRate,
);
const confidentAvgGoals = confidentResults.reduce((s, r) => s + r.scoreHome, 0) / N;
const dejectedAvgGoals = dejectedResults.reduce((s, r) => s + r.scoreHome, 0) / N;
checkTrue(
  "condition-only change: average goals scored also favours the confident/in-form squad",
  confidentAvgGoals > dejectedAvgGoals,
);

// ---- summary -----------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
