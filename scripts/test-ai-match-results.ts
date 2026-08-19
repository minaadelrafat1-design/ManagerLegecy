/* =============================================================================
 * Phase B3.1C — apply AI match results smoke tests
 * =============================================================================
 * Same convention as the other scripts/test-*.ts files (run with
 * `npx tsx scripts/test-ai-match-results.ts`). Avoids `state/store.tsx`
 * (React) — pure state/lib layer only, same as test-ai-fixtures.ts.
 * ---------------------------------------------------------------------------*/

import { buildInitialState } from "../src/state/seed.ts";
import { gameReducer } from "../src/state/reducer.ts";
import {
  computeClubStanding,
  computeLeagueTable,
  computeRecentForm,
} from "../src/state/standings.ts";
import type { Fixture } from "../src/state/types.ts";
import {
  applyAiFixtureResults,
  isAiFixture,
  simulateAiFixture,
  simulateAndApplyScheduledAiFixtures,
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
const HOME_CLUB_ID = seeded.currentClub.id; // "northfield-united", never involved below
const LEAGUE_ID = Object.values(seeded.leagues)[0]!.id;
const COMPETITION_ID = seeded.leagues[LEAGUE_ID]!.competitionId;
const RIVAL_A = "ravenport";
const RIVAL_B = "kingsmere";

// ---- 1. create an AI fixture -----------------------------------------------------

const aiFixture: Fixture = {
  id: "b31c-fx-1",
  competitionId: COMPETITION_ID,
  season: seeded.time.season,
  homeClubId: RIVAL_A,
  awayClubId: RIVAL_B,
  date: "Sat 13 Dec",
  matchday: 15,
  venue: "H",
  status: "scheduled",
  result: null,
};
checkTrue("step 1: fixture created as scheduled, AI-only", isAiFixture(aiFixture, HOME_CLUB_ID));
const stateWithFixture = { ...seeded, fixtures: [...seeded.fixtures, aiFixture] };

// ---- 2. simulate it ---------------------------------------------------------------

const result = simulateAiFixture(aiFixture, stateWithFixture.clubs, stateWithFixture.players);
checkTrue(
  "step 2: simulation produced a well-formed result",
  Number.isInteger(result.scoreHome) && Number.isInteger(result.scoreAway),
);

// ---- 3. verify the result ----------------------------------------------------------

const afterFirstApply = applyAiFixtureResults(stateWithFixture, [result], "2026-12-13");
const storedFixture = afterFirstApply.fixtures.find((f) => f.id === aiFixture.id);
checkTrue("step 3: fixture now exists and is played", storedFixture?.status === "played");
check("step 3: scoreHome matches the simulated result", storedFixture?.scoreHome, result.scoreHome);
check("step 3: scoreAway matches the simulated result", storedFixture?.scoreAway, result.scoreAway);
checkTrue(
  "step 3: exactly one MatchRecord was appended",
  afterFirstApply.matches.length === stateWithFixture.matches.length + 1,
);
checkTrue(
  "step 3: exactly one news/event entry was appended",
  afterFirstApply.events.length === stateWithFixture.events.length + 1,
);

// ---- 4. verify the table changes ---------------------------------------------------

const tableBefore = computeLeagueTable(stateWithFixture, LEAGUE_ID);
const tableAfter = computeLeagueTable(afterFirstApply, LEAGUE_ID);
const rowABefore = tableBefore.find((r) => r.clubId === RIVAL_A)!;
const rowAAfter = tableAfter.find((r) => r.clubId === RIVAL_A)!;
const rowBBefore = tableBefore.find((r) => r.clubId === RIVAL_B)!;
const rowBAfter = tableAfter.find((r) => r.clubId === RIVAL_B)!;

check("step 4: Ravenport's played count went up by 1", rowAAfter.played, rowABefore.played + 1);
check("step 4: Kingsmere's played count went up by 1", rowBAfter.played, rowBBefore.played + 1);
checkTrue(
  "step 4: the table genuinely reflects the new result (points changed for at least one side, or it was a draw)",
  rowAAfter.points !== rowABefore.points ||
    rowBAfter.points !== rowBBefore.points ||
    result.outcome === "D",
);
check(
  "step 4: computeClubStanding agrees with computeLeagueTable for the same club",
  computeClubStanding(afterFirstApply, LEAGUE_ID, RIVAL_A),
  rowAAfter,
);
checkTrue(
  "step 4: managed club's own standing is untouched by an AI fixture it wasn't part of",
  JSON.stringify(tableBefore.find((r) => r.clubId === HOME_CLUB_ID)) ===
    JSON.stringify(tableAfter.find((r) => r.clubId === HOME_CLUB_ID)),
);

// ---- 5 & 6. process/reload the same fixture, verify no duplication -----------------

// 5a. Re-run the exact same batch apply (as if the "AI fixtures" pass ran twice,
// e.g. the standings screen was opened again and re-triggered processing).
const afterSecondApply = applyAiFixtureResults(afterFirstApply, [result], "2026-12-13");
check(
  "step 5/6: re-applying the same result is a byte-for-byte no-op state-wise",
  afterSecondApply,
  afterFirstApply,
);
check(
  "step 5/6: matches list length unchanged after reprocessing",
  afterSecondApply.matches.length,
  afterFirstApply.matches.length,
);
check(
  "step 5/6: events list length unchanged after reprocessing",
  afterSecondApply.events.length,
  afterFirstApply.events.length,
);
const tableAfterSecond = computeLeagueTable(afterSecondApply, LEAGUE_ID);
check(
  "step 5/6: Ravenport's points/played did NOT double-count",
  tableAfterSecond.find((r) => r.clubId === RIVAL_A),
  tableAfter.find((r) => r.clubId === RIVAL_A),
);
check(
  "step 5/6: Kingsmere's points/played did NOT double-count",
  tableAfterSecond.find((r) => r.clubId === RIVAL_B),
  tableAfter.find((r) => r.clubId === RIVAL_B),
);

// 5b. "Reload" the fixture: re-simulating it again (fresh call, same deterministic
// seed) and re-applying must land on the exact same score, not a new random one —
// this is the "must not generate the result again" requirement.
const resimulated = simulateAiFixture(aiFixture, stateWithFixture.clubs, stateWithFixture.players);
check("step 5/6: re-simulating the same fixture reproduces the same score", resimulated, result);
const afterReloadApply = applyAiFixtureResults(afterFirstApply, [resimulated], "2026-12-20");
check(
  "step 5/6: applying a freshly-resimulated result against an already-played fixture changes nothing",
  afterReloadApply,
  afterFirstApply,
);

// 5c. Bypass the pre-filter entirely and dispatch RECORD_MATCH_RESULT straight at
// the reducer a second time — the reducer's own guard (Phase B3.1C) must still
// catch it, so idempotency doesn't rely solely on applyAiFixtureResults's filter.
const directRedispatch = gameReducer(
  afterFirstApply,
  toRecordMatchResultAction(result, "2026-12-27"),
);
check(
  "step 5/6: dispatching RECORD_MATCH_RESULT directly a 2nd time is also a no-op (reducer-level guard)",
  directRedispatch,
  afterFirstApply,
);

// ---- extra: computeRecentForm reflects the single applied result -------------------

const formA = computeRecentForm(afterFirstApply.fixtures, COMPETITION_ID, RIVAL_A, 5);
checkTrue(
  "recent form: Ravenport's form includes the new fixture exactly once",
  formA.filter((e) => e.fixtureId === aiFixture.id).length === 1,
);
const formAAfterReprocess = computeRecentForm(
  afterSecondApply.fixtures,
  COMPETITION_ID,
  RIVAL_A,
  5,
);
check("recent form: unchanged after reprocessing the same fixture", formAAfterReprocess, formA);

// ---- extra: the one-call convenience wrapper is idempotent too ---------------------

const stateForWrapper = {
  ...seeded,
  fixtures: [...seeded.fixtures, { ...aiFixture, id: "b31c-fx-2" }],
};
const wrapperOnce = simulateAndApplyScheduledAiFixtures(stateForWrapper, "2026-12-13");
const wrapperTwice = simulateAndApplyScheduledAiFixtures(wrapperOnce, "2026-12-13");
checkTrue(
  "wrapper: first call resolves the scheduled AI fixture",
  wrapperOnce.fixtures.find((f) => f.id === "b31c-fx-2")?.status === "played",
);
check("wrapper: second call is a complete no-op", wrapperTwice, wrapperOnce);
check(
  "wrapper: no scheduled AI fixtures left after the first call",
  simulateScheduledAiFixtures(wrapperOnce).length,
  0,
);

// ---- scope guard: the managed club's own fixture is never touched by this path -----

checkTrue(
  "scope: fx-14 (managed club's own fixture) is excluded from every AI batch above",
  !simulateScheduledAiFixtures(stateWithFixture).some((r) => r.fixtureId === "fx-14"),
);

// ---- summary -----------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
