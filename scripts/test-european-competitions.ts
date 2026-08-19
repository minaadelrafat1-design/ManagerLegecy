/* eslint-disable @typescript-eslint/no-explicit-any */
/* Standalone test script for European competition behavior
   Run with: npx tsx scripts/test-european-competitions.ts
*/

import { buildInitialState } from "../src/state/seed.ts";
import { runEuropeanCompetitions } from "../src/state/european.ts";
import {
  applyAiFixtureResults,
  AiFixtureResult,
  toRecordMatchResultAction,
} from "../src/lib/ai-fixture-sim.ts";
import { gameReducer } from "../src/state/reducer.ts";

function check(label: string, cond: boolean, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${ok || !detail ? "" : ` (${detail})`}`);
  return ok;
}

async function main() {
  let failures = 0;
  const state = buildInitialState();
  const clubIds = Object.keys(state.clubs).slice(0, 4);
  if (clubIds.length < 4) {
    console.error("Not enough clubs in seeded state to run test");
    process.exit(2);
  }

  const competitionConfig: any = {
    id: "test-eu",
    name: "Test EU",
    type: "continental",
    format: {
      groupStage: {
        numGroups: 2,
        teamsPerGroup: 2,
        homeAndAway: false,
        advancePerGroup: 1,
        drawSeed: "seeded",
        pots: [
          [clubIds[0], clubIds[2]],
          [clubIds[1], clubIds[3]],
        ],
      },
      knockoutStage: {
        rounds: [{ id: "semi", name: "Semi", teams: 2, twoLegged: true }],
        extraTime: true,
        penalties: true,
      },
    },
  };

  // inject world config competition
  state.meta = state.meta || {};
  state.meta.worldConfig = state.meta.worldConfig || { countries: [], competitions: [] };
  state.meta.worldConfig.competitions = [
    ...(state.meta.worldConfig.competitions || []),
    competitionConfig,
  ];

  // register qualifiers explicitly
  state.meta.europeanQualifications = [
    ...(state.meta.europeanQualifications || []),
    ...clubIds.map((id) => ({
      competitionId: competitionConfig.id,
      clubId: id,
      reason: "test",
      registeredAt: state.time.date,
      stage: "qualification",
    })),
  ];

  // Run scheduler: should create group fixtures
  const afterGroup = runEuropeanCompetitions(state as any);
  const groupFixtures = afterGroup.fixtures.filter(
    (f) => f.competitionId === "test-eu" && f.groupId,
  );
  const groups = new Map<string, Set<string>>();
  for (const f of groupFixtures) {
    const g = f.groupId!;
    const set = groups.get(g) ?? new Set<string>();
    set.add(f.homeClubId);
    set.add(f.awayClubId);
    groups.set(g, set);
  }

  console.log(`Detected groups: ${[...groups.keys()].join(", ")}`);

  // Check: each pot member landed in different groups (pots were 2 pots of 2 teams)
  const potA = competitionConfig.format.groupStage.pots[0] as string[];
  const potB = competitionConfig.format.groupStage.pots[1] as string[];

  function groupOf(clubId: string) {
    for (const [k, set] of groups.entries()) if (set.has(clubId)) return k;
    return null;
  }

  const cond1 = groupOf(potA[0]) !== groupOf(potA[1]);
  const ok1 = check(
    "Pots: potA members placed in different groups",
    cond1,
    `${potA[0]} vs ${potA[1]}`,
  );
  if (!ok1) failures++;

  const cond2 = groupOf(potB[0]) !== groupOf(potB[1]);
  const ok2 = check(
    "Pots: potB members placed in different groups",
    cond2,
    `${potB[0]} vs ${potB[1]}`,
  );
  if (!ok2) failures++;

  // Now mark group fixtures as played with deterministic winners (first club in group wins)
  const results: AiFixtureResult[] = [];
  for (const [g, set] of groups.entries()) {
    const teams = [...set];
    const winner = teams[0];

    for (const fx of groupFixtures.filter((f) => f.groupId === g)) {
      let scoreHome = 1;
      let scoreAway = 1;
      if (fx.homeClubId === winner) {
        scoreHome = 2;
        scoreAway = 0;
      } else if (fx.awayClubId === winner) {
        scoreHome = 0;
        scoreAway = 2;
      }
      const outcome = scoreHome > scoreAway ? "H" : scoreHome < scoreAway ? "A" : "D";
      results.push({
        fixtureId: fx.id,
        homeClubId: fx.homeClubId,
        awayClubId: fx.awayClubId,
        homeStrength: 50,
        awayStrength: 50,
        outcome: outcome as any,
        scoreHome,
        scoreAway,
        seed: 1,
      });
    }
  }

  // Apply results one-by-one using the reducer so we can log what's happening
  let afterGroupPlayed = afterGroup as any;
  for (const res of results) {
    const fx = afterGroupPlayed.fixtures.find((f: any) => f.id === res.fixtureId);
    console.log(
      `Applying result for ${res.fixtureId} — fixture found=${!!fx} status=${fx?.status}`,
    );
    const action = toRecordMatchResultAction(res as any, afterGroupPlayed.time.date);
    afterGroupPlayed = gameReducer(afterGroupPlayed, action as any);
  }

  // Debug: show group fixture statuses and computed tables
  const playedGroupFixtures = afterGroupPlayed.fixtures.filter(
    (f) => f.competitionId === "test-eu" && f.groupId,
  );
  console.log("\nGroup fixtures after applying results:");
  for (const f of playedGroupFixtures) {
    console.log(
      `- ${f.id}: ${f.homeClubId} ${f.scoreHome}-${f.scoreAway} ${f.awayClubId} (status=${f.status})`,
    );
  }

  // Run scheduler again to schedule knockout
  const afterKnock = runEuropeanCompetitions(afterGroupPlayed as any);
  const knockoutFixtures = afterKnock.fixtures.filter(
    (f) => f.competitionId === "test-eu" && f.round === "Semi",
  );

  const hasTwoLegs =
    knockoutFixtures.some((f) => f.leg === 1) && knockoutFixtures.some((f) => f.leg === 2);
  const ok3 = check(
    "Knockout: two-legged tie scheduled (leg1 & leg2)",
    hasTwoLegs,
    `${knockoutFixtures.length} fixtures`,
  );
  if (!ok3) failures++;

  // Validate that for each pair there is a matching reversed leg
  const pairs = new Map<string, string[]>();
  for (const f of knockoutFixtures) {
    const key = [f.homeClubId, f.awayClubId].sort().join("|");
    pairs.set(key, (pairs.get(key) || []).concat([`${f.leg}:${f.homeClubId}->${f.awayClubId}`]));
  }
  let pairIssues = 0;
  for (const [k, arr] of pairs.entries()) {
    if (arr.length < 2) pairIssues++;
  }
  const ok4 = check(
    "Knockout: each tie has two legs (pairing check)",
    pairIssues === 0,
    `${pairIssues} missing pairs`,
  );
  if (!ok4) failures++;

  console.log("\nTest summary:");
  if (failures === 0) console.log("All checks passed.");
  else console.log(`${failures} checks failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
