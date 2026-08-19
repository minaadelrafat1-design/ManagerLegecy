/* =============================================================================
 * Phase B3.1A — AI fixture simulator smoke tests
 * =============================================================================
 * Same convention as scripts/test-calendar.ts / scripts/test-standings.ts:
 * a standalone script (run with `npx tsx scripts/test-ai-fixtures.ts`) since
 * no test runner is wired into this project yet. Deliberately avoids
 * importing `state/store.tsx` (React) — everything exercised here is the
 * pure state/lib layer, same as the other two scripts' calendar/standings
 * checks.
 * ---------------------------------------------------------------------------*/

import { buildInitialState } from "../src/state/seed.ts";
import { gameReducer } from "../src/state/reducer.ts";
import type { Fixture } from "../src/state/types.ts";
import {
  calculateClubStrength,
  isAiFixture,
  seedFromFixtureId,
  simulateAiFixture,
  simulateScheduledAiFixtures,
  toRecordMatchResultAction,
} from "../src/lib/ai-fixture-sim.ts";

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
const HOME_CLUB_ID = seeded.currentClub.id; // "northfield-united"
const AWAY_CLUB_ID = "westport-united";
const RIVAL_A = "ravenport";
const RIVAL_B = "kingsmere";

// ---- 1. team strength -----------------------------------------------------------

const homeStrength = calculateClubStrength(seeded.clubs[HOME_CLUB_ID]!, seeded.players);
const awayStrength = calculateClubStrength(seeded.clubs[AWAY_CLUB_ID]!, seeded.players);
const rivalStrength = calculateClubStrength(seeded.clubs[RIVAL_A]!, seeded.players);

console.log(
  `\nStrength — Northfield (managed): ${homeStrength}, Westport: ${awayStrength}, Ravenport (minimal rival): ${rivalStrength}\n`,
);

checkTrue(
  "strength: managed club (rep 64, full roster) rates strongest",
  homeStrength > awayStrength && homeStrength > rivalStrength,
  `home=${homeStrength} away=${awayStrength} rival=${rivalStrength}`,
);
checkTrue(
  "strength: Westport (rep 55, simRoster) rates above a minimal rival (rep 50, no roster)",
  awayStrength > rivalStrength,
  `away=${awayStrength} rival=${rivalStrength}`,
);
checkTrue(
  "strength: every value stays in 0-100",
  [homeStrength, awayStrength, rivalStrength].every((s) => s >= 0 && s <= 100),
);

// A minimal club has no roster and flat-50 facilities, so its strength should
// equal its reputation exactly (roster falls back to reputation, facilities
// is flat 50 — see calculateClubStrength's doc comment).
check(
  "strength: minimal club with reputation 50 and flat-50 facilities scores exactly 50",
  rivalStrength,
  50,
);

// ---- 2. isAiFixture --------------------------------------------------------------

const nextManagedFixture = seeded.fixtures.find((f) => f.id === "fx-14")!;
checkTrue(
  "isAiFixture: false for a fixture the managed club is in",
  isAiFixture(nextManagedFixture, HOME_CLUB_ID) === false,
);
const syntheticAiFixture: Fixture = {
  id: "test-ai-fx-1",
  competitionId: nextManagedFixture.competitionId,
  season: seeded.time.season,
  homeClubId: RIVAL_A,
  awayClubId: RIVAL_B,
  date: "Sat 13 Dec",
  matchday: 15,
  venue: "H",
  status: "scheduled",
  result: null,
};
checkTrue(
  "isAiFixture: true for a fixture neither side of which is the managed club",
  isAiFixture(syntheticAiFixture, HOME_CLUB_ID) === true,
);

// ---- 3. single simulation is well-formed -----------------------------------------

const single = simulateAiFixture(syntheticAiFixture, seeded.clubs, seeded.players);
checkTrue(
  "simulate: scores are non-negative integers",
  Number.isInteger(single.scoreHome) &&
    Number.isInteger(single.scoreAway) &&
    single.scoreHome >= 0 &&
    single.scoreAway >= 0,
);
checkTrue(
  "simulate: scoreline agrees with the stored outcome",
  (single.outcome === "H" && single.scoreHome > single.scoreAway) ||
    (single.outcome === "A" && single.scoreAway > single.scoreHome) ||
    (single.outcome === "D" && single.scoreHome === single.scoreAway),
  `outcome=${single.outcome} score=${single.scoreHome}-${single.scoreAway}`,
);

// ---- 4. determinism ---------------------------------------------------------------

const repeat = simulateAiFixture(syntheticAiFixture, seeded.clubs, seeded.players);
check("determinism: same fixture+seed reproduces the same result", repeat, single);
check(
  "determinism: seedFromFixtureId is stable for the same id",
  seedFromFixtureId("test-ai-fx-1"),
  seedFromFixtureId("test-ai-fx-1"),
);
checkTrue(
  "determinism: different fixture ids generally hash to different seeds",
  seedFromFixtureId("test-ai-fx-1") !== seedFromFixtureId("test-ai-fx-2"),
);

// ---- 5. controlled randomness: strong side wins more, but not always -------------
// A big, fixed strength gap (reputation 90 vs 20) simulated across many
// different fixture ids (so many different seeds), tallying outcomes.

const strongClub = { ...seeded.clubs[RIVAL_A]!, id: "strong-club", reputation: 90 };
const weakClub = { ...seeded.clubs[RIVAL_B]!, id: "weak-club", reputation: 20 };
const clubsForRun = { ...seeded.clubs, "strong-club": strongClub, "weak-club": weakClub };

const RUNS = 400;
let strongWins = 0;
let weakWins = 0;
let draws = 0;
for (let i = 0; i < RUNS; i++) {
  const fx: Fixture = {
    ...syntheticAiFixture,
    id: `mismatch-${i}`,
    homeClubId: "strong-club",
    awayClubId: "weak-club",
  };
  const r = simulateAiFixture(fx, clubsForRun, seeded.players);
  if (r.outcome === "H") strongWins++;
  else if (r.outcome === "A") weakWins++;
  else draws++;
}
console.log(
  `\nMismatch (rep 90 vs rep 20) over ${RUNS} runs — strong club won ${strongWins}, draws ${draws}, weak club won ${weakWins}\n`,
);
checkTrue(
  "randomness: the stronger side wins clearly more often than the weaker side",
  strongWins > weakWins * 3,
  `strong=${strongWins} weak=${weakWins}`,
);
checkTrue("randomness: the weaker side still wins sometimes", weakWins > 0);
checkTrue("randomness: draws happen sometimes", draws > 0);
checkTrue(
  "randomness: not every match is the same scoreline (i.e. not fake-random-but-fixed)",
  new Set(
    Array.from({ length: RUNS }, (_, i) => {
      const fx: Fixture = {
        ...syntheticAiFixture,
        id: `mismatch-${i}`,
        homeClubId: "strong-club",
        awayClubId: "weak-club",
      };
      const r = simulateAiFixture(fx, clubsForRun, seeded.players);
      return `${r.scoreHome}-${r.scoreAway}`;
    }),
  ).size > 1,
);

// An even matchup, same treatment: neither side should dominate.
const evenA = { ...seeded.clubs[RIVAL_A]!, id: "even-a", reputation: 60 };
const evenB = { ...seeded.clubs[RIVAL_B]!, id: "even-b", reputation: 60 };
const clubsForEvenRun = { ...seeded.clubs, "even-a": evenA, "even-b": evenB };
let evenAWins = 0;
let evenBWins = 0;
for (let i = 0; i < RUNS; i++) {
  const fx: Fixture = {
    ...syntheticAiFixture,
    id: `even-${i}`,
    homeClubId: "even-a",
    awayClubId: "even-b",
  };
  const r = simulateAiFixture(fx, clubsForEvenRun, seeded.players);
  if (r.outcome === "H") evenAWins++;
  else if (r.outcome === "A") evenBWins++;
}
console.log(
  `Even matchup (rep 60 vs rep 60) over ${RUNS} runs — home ${evenAWins}, away ${evenBWins}\n`,
);
checkTrue(
  "randomness: an even matchup doesn't lopsidedly favour either side",
  evenAWins < evenBWins * 2 && evenBWins < evenAWins * 2,
  `home=${evenAWins} away=${evenBWins}`,
);

// ---- 6. storing the result against the fixture (reuses RECORD_MATCH_RESULT) -----

const stateWithAiFixture = { ...seeded, fixtures: [...seeded.fixtures, syntheticAiFixture] };
const action = toRecordMatchResultAction(single, "2026-12-13");
check("toRecordMatchResultAction: action type", action.type, "RECORD_MATCH_RESULT");

const afterStore = gameReducer(stateWithAiFixture, action);
const storedFixture = afterStore.fixtures.find((f) => f.id === syntheticAiFixture.id);
checkTrue("store: fixture found after dispatch", storedFixture !== undefined);
if (storedFixture) {
  check("store: fixture status becomes played", storedFixture.status, "played");
  check("store: scoreHome stored on the fixture", storedFixture.scoreHome, single.scoreHome);
  check("store: scoreAway stored on the fixture", storedFixture.scoreAway, single.scoreAway);
  checkTrue(
    "store: result matches the simulated outcome (H/D/A -> W/D/L from the home side)",
    (single.outcome === "H" && storedFixture.result === "W") ||
      (single.outcome === "A" && storedFixture.result === "L") ||
      (single.outcome === "D" && storedFixture.result === "D"),
  );
}
checkTrue(
  "store: the managed club's own fixture (fx-14) is untouched",
  afterStore.fixtures.find((f) => f.id === "fx-14")?.status === "scheduled",
);
checkTrue(
  "store: a MatchRecord was appended, same as a real match would produce",
  afterStore.matches.length === stateWithAiFixture.matches.length + 1,
);

// ---- 7. simulateScheduledAiFixtures over real seeded state -----------------------
// The seed currently has no *scheduled* fixture that excludes the managed
// club (matchdays 1-9 are already played by generateRoundRobinFixtures;
// matchdays 10-14 only include the managed club's own fixtures — see
// state/seed.ts's MANAGED_CLUB_FIXTURES comment) — so this should
// legitimately come back empty against the untouched seed, and pick up the
// synthetic fixture once one exists.

const scheduledAiNow = simulateScheduledAiFixtures(seeded);
check(
  "simulateScheduledAiFixtures: none in the untouched seed (no AI-only fixture is currently scheduled)",
  scheduledAiNow.length,
  0,
);
const scheduledAiWithSynthetic = simulateScheduledAiFixtures(stateWithAiFixture);
check(
  "simulateScheduledAiFixtures: picks up a scheduled AI-only fixture once one exists",
  scheduledAiWithSynthetic.map((r) => r.fixtureId),
  [syntheticAiFixture.id],
);

// ---- 8. modularity: swapping in a stronger roster changes the result ------------
// Confirms the roster term actually moves the needle, not just reputation —
// important since Phase B3.1A explicitly asks for this to be improvable
// later (e.g. once every rival club has a real roster).

const boostedRoster = seeded.clubs[RIVAL_A]!.simRoster; // undefined for a minimal club; sanity only
checkTrue(
  "modularity: a minimal rival club has no roster today (roster term currently falls back to reputation)",
  boostedRoster === undefined,
);
const withRosterA = {
  ...seeded.clubs[RIVAL_A]!,
  simRoster: { xi: seeded.clubs[AWAY_CLUB_ID]!.simRoster!.xi, bench: [] },
};
const strengthBefore = calculateClubStrength(seeded.clubs[RIVAL_A]!, seeded.players);
const strengthAfter = calculateClubStrength(withRosterA, seeded.players);
checkTrue(
  "modularity: giving a minimal club Westport's roster changes its strength",
  strengthAfter !== strengthBefore,
  `before=${strengthBefore} after=${strengthAfter}`,
);

// ---- summary -----------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
