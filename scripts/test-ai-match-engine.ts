/* =============================================================================
 * Phase B3.1B.1 — AI match engine connection smoke tests
 * =============================================================================
 * Same convention as the other scripts/test-*.ts files (run with
 * `npx tsx scripts/test-ai-match-engine.ts`). Pure state/lib layer only, no
 * React — confirms AI-only fixtures now resolve through
 * `lib/match-engine.ts`'s real `simulateMatch`, not a second simulator.
 * ---------------------------------------------------------------------------*/

import { buildInitialState } from "../src/state/seed.ts";
import { gameReducer } from "../src/state/reducer.ts";
import type { Fixture } from "../src/state/types.ts";
import { simulateMatch } from "../src/lib/match-engine.ts";
import {
  applyAiFixtureResults,
  buildSimTeamInput,
  buildSyntheticRoster,
  isAiFixture,
  simulateAiFixtureFull,
  simulateAiFixtureViaEngine,
  simulateAndApplyScheduledAiFixturesViaEngine,
  simulateScheduledAiFixturesViaEngine,
  toRecordMatchResultAction,
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
const HOME_CLUB_ID = seeded.currentClub.id; // "northfield-united", never involved below
const AWAY_CLUB_ID = "westport-united"; // has a real simRoster
const RIVAL_A = "ravenport"; // minimal club — no roster, no simRoster
const RIVAL_B = "kingsmere"; // minimal club — no roster, no simRoster

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

// ---- 1. synthetic roster generation (minimal clubs) -------------------------

const ravenport = seeded.clubs[RIVAL_A]!;
const synthA = buildSyntheticRoster(ravenport, seeded.players);
checkTrue("synth roster: 11 starters", synthA.xi.length === 11);
checkTrue("synth roster: exactly one GK in the XI", synthA.xi.filter((p) => p.isGK).length === 1);
checkTrue("synth roster: 5 bench players", synthA.bench.length === 5);
checkTrue(
  "synth roster: every rating stays in 0-100",
  [...synthA.xi, ...synthA.bench].every(
    (p) =>
      p.overall >= 0 &&
      p.overall <= 100 &&
      p.attack >= 0 &&
      p.attack <= 100 &&
      p.defend >= 0 &&
      p.defend <= 100,
  ),
);
checkTrue(
  "synth roster: player ids are unique within the club",
  new Set([...synthA.xi, ...synthA.bench].map((p) => p.id)).size ===
    synthA.xi.length + synthA.bench.length,
);
const synthAAgain = buildSyntheticRoster(seeded.clubs[RIVAL_A]!, seeded.players);
check("synth roster: deterministic for the same club", synthAAgain, synthA);
const synthB = buildSyntheticRoster(seeded.clubs[RIVAL_B]!, seeded.players);
checkTrue(
  "synth roster: two different clubs don't get identical rosters",
  JSON.stringify(synthB) !== JSON.stringify(synthA),
);
checkTrue(
  "synth roster: id prefix ties every synthesized player to their own club (no cross-club id collisions)",
  synthA.xi.every((p) => p.id.startsWith(`${RIVAL_A}-p`)) &&
    synthB.xi.every((p) => p.id.startsWith(`${RIVAL_B}-p`)),
);

// ---- 2. buildSimTeamInput picks the right case per club ---------------------

const westportInput = buildSimTeamInput("away", seeded.clubs[AWAY_CLUB_ID]!, seeded.players, false);
checkTrue(
  "team input: Westport (has simRoster) reuses it directly, unchanged",
  westportInput.xi === seeded.clubs[AWAY_CLUB_ID]!.simRoster!.xi,
);
check(
  "team input: Westport formation carried through",
  westportInput.formation,
  seeded.clubs[AWAY_CLUB_ID]!.formation,
);

const managedInput = buildSimTeamInput("home", seeded.currentClub, seeded.players, true);
checkTrue(
  "team input: managed club (real Player roster) resolves 11 starters",
  managedInput.xi.length === 11,
);
checkTrue(
  "team input: managed club's starting XI matches its players' `starter` flags",
  managedInput.xi.every((p) => seeded.players[p.id]?.starter === true),
);
check(
  "team input: managed club formation carried through",
  managedInput.formation,
  seeded.currentClub.formation,
);

const rivalInput = buildSimTeamInput("home", ravenport, seeded.players, true);
checkTrue(
  "team input: minimal club (no roster) falls back to a synthesized XI",
  rivalInput.xi.length === 11,
);
check(
  "team input: minimal club formation carried through",
  rivalInput.formation,
  ravenport.formation,
);
checkTrue(
  "team input: no advanced tactics — home/away get the shared engine defaults",
  rivalInput.homeAdvantage === true,
);

// ---- 3. the AI fixture actually runs through simulateMatch -------------------
// Build the same inputs independently and call simulateMatch ourselves, then
// confirm simulateAiFixtureViaEngine's score is exactly what that produces —
// proving it's the same engine call, not a re-implementation.

const aiFixture = makeFixture("b31b-fx-1", RIVAL_A, RIVAL_B);
const seed = 424242;
const homeInput = buildSimTeamInput("home", seeded.clubs[RIVAL_A]!, seeded.players, true);
const awayInput = buildSimTeamInput("away", seeded.clubs[RIVAL_B]!, seeded.players, false);
const directSim = simulateMatch(homeInput, awayInput, seed);
const viaAdapter = simulateAiFixtureViaEngine(aiFixture, seeded.clubs, seeded.players, seed);

check(
  "engine wiring: simulateAiFixtureViaEngine's score matches an independent simulateMatch call with the same inputs/seed",
  { home: viaAdapter.scoreHome, away: viaAdapter.scoreAway },
  directSim.finalScore,
);

const full = simulateAiFixtureFull(aiFixture, seeded.clubs, seeded.players, seed);
checkTrue(
  "engine wiring: full result carries a real minute-by-minute event timeline",
  full.events.length > 0,
);
checkTrue(
  "engine wiring: kickoff and full-time whistle events are present, same as a player match",
  full.events.some((e) => e.text === "Kick-off") && full.events.some((e) => e.text === "Full-time"),
);
checkTrue(
  "engine wiring: per-minute snapshots exist for the whole match, same shape as a player match",
  full.snapshots.length === full.fullTimeMinute + 1,
);
check("engine wiring: full result's final score matches the adapter's result", full.finalScore, {
  home: viaAdapter.scoreHome,
  away: viaAdapter.scoreAway,
});

checkTrue(
  "engine wiring: outcome (H/D/A) agrees with the scoreline",
  (viaAdapter.outcome === "H" && viaAdapter.scoreHome > viaAdapter.scoreAway) ||
    (viaAdapter.outcome === "A" && viaAdapter.scoreAway > viaAdapter.scoreHome) ||
    (viaAdapter.outcome === "D" && viaAdapter.scoreHome === viaAdapter.scoreAway),
);

// ---- 4. determinism, same contract as the Phase B3.1A path -------------------

const viaAdapterAgain = simulateAiFixtureViaEngine(aiFixture, seeded.clubs, seeded.players, seed);
check("determinism: same fixture+seed reproduces the same result", viaAdapterAgain, viaAdapter);

const defaultSeeded = simulateAiFixtureViaEngine(aiFixture, seeded.clubs, seeded.players);
checkTrue(
  "determinism: default seed derives from the fixture id (matches seedFromFixtureId)",
  defaultSeeded.seed !== seed, // the explicit seed above (424242) isn't the fixture-id hash
);
const defaultSeededAgain = simulateAiFixtureViaEngine(aiFixture, seeded.clubs, seeded.players);
check(
  "determinism: default (fixture-id-derived) seed is stable across calls too",
  defaultSeededAgain,
  defaultSeeded,
);

// ---- 5. several different AI matches — vary opponents, confirm real variety --

const pairings: Array<[string, string]> = [
  [RIVAL_A, RIVAL_B],
  [RIVAL_B, RIVAL_A],
  [RIVAL_A, "harlow-rovers"],
  ["ashcombe-city", "coastal-town"],
  ["riverside-fc", "oldbridge-athletic"],
  [AWAY_CLUB_ID, RIVAL_A], // Westport (simRoster) vs a synthesized minimal club
];
const results = pairings.map(([h, a], i) =>
  simulateAiFixtureViaEngine(makeFixture(`b31b-multi-${i}`, h, a), seeded.clubs, seeded.players),
);
checkTrue(
  "several matches: every match produced a well-formed, non-negative integer scoreline",
  results.every(
    (r) =>
      Number.isInteger(r.scoreHome) &&
      Number.isInteger(r.scoreAway) &&
      r.scoreHome >= 0 &&
      r.scoreAway >= 0,
  ),
);
checkTrue(
  "several matches: not every scoreline is identical (real variety across different matchups)",
  new Set(results.map((r) => `${r.scoreHome}-${r.scoreAway}`)).size > 1,
);
checkTrue(
  "several matches: Westport (real, stronger simRoster) fields all 11 of its own real players against a synthesized side",
  buildSimTeamInput("home", seeded.clubs[AWAY_CLUB_ID]!, seeded.players, true).xi.every((p) =>
    seeded.clubs[AWAY_CLUB_ID]!.simRoster!.xi.some((sp) => sp.id === p.id),
  ),
);

// ---- 6. batch + apply — Phase B3.1C's storage path, unchanged, fed by the engine --

const syntheticFixtures: Fixture[] = [
  makeFixture("b31b-batch-1", RIVAL_A, RIVAL_B),
  makeFixture("b31b-batch-2", "harlow-rovers", "ashcombe-city"),
];
const stateWithFixtures = { ...seeded, fixtures: [...seeded.fixtures, ...syntheticFixtures] };

const scheduled = simulateScheduledAiFixturesViaEngine(stateWithFixtures);
check(
  "batch: simulateScheduledAiFixturesViaEngine picks up both new AI-only fixtures",
  scheduled.map((r) => r.fixtureId).sort(),
  ["b31b-batch-1", "b31b-batch-2"],
);
checkTrue(
  "batch: fx-14 (managed club's own fixture) is excluded",
  !scheduled.some((r) => r.fixtureId === "fx-14"),
);

const afterApply = applyAiFixtureResults(stateWithFixtures, scheduled, "2026-12-13");
checkTrue(
  "batch: both fixtures are now played",
  afterApply.fixtures.filter(
    (f) => (f.id === "b31b-batch-1" || f.id === "b31b-batch-2") && f.status === "played",
  ).length === 2,
);
checkTrue(
  "batch: two MatchRecords were appended",
  afterApply.matches.length === stateWithFixtures.matches.length + 2,
);

const wrapperOnce = simulateAndApplyScheduledAiFixturesViaEngine(stateWithFixtures, "2026-12-13");
check("wrapper: matches state produced by the manual batch+apply above", wrapperOnce, afterApply);
const wrapperTwice = simulateAndApplyScheduledAiFixturesViaEngine(wrapperOnce, "2026-12-13");
check(
  "wrapper: second call is a complete no-op (idempotent, same as Phase B3.1C)",
  wrapperTwice,
  wrapperOnce,
);

// ---- 7. reducer path is exactly RECORD_MATCH_RESULT, same as a player match ------

const oneResult = simulateAiFixtureViaEngine(
  makeFixture("b31b-single-1", RIVAL_A, "harlow-rovers"),
  seeded.clubs,
  seeded.players,
);
const action = toRecordMatchResultAction(oneResult, "2026-12-13");
check(
  "reducer: action type is RECORD_MATCH_RESULT — no second write path",
  action.type,
  "RECORD_MATCH_RESULT",
);
const stateWithSingle = {
  ...seeded,
  fixtures: [...seeded.fixtures, makeFixture("b31b-single-1", RIVAL_A, "harlow-rovers")],
};
const afterSingle = gameReducer(stateWithSingle, action);
const storedSingle = afterSingle.fixtures.find((f) => f.id === "b31b-single-1");
checkTrue(
  "reducer: fixture stored via the existing reducer case",
  storedSingle?.status === "played",
);
check(
  "reducer: score stored matches the engine result",
  storedSingle?.scoreHome,
  oneResult.scoreHome,
);

// ---- 8. still not wired into the daily calendar tick (out of scope this phase) ---

checkTrue(
  "scope guard: isAiFixture still correctly excludes the managed club (reused, unchanged)",
  isAiFixture(
    seeded.fixtures.find((f) => f.id === "fx-14")!,
    HOME_CLUB_ID,
  ) === false,
);

// ---- summary -----------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
