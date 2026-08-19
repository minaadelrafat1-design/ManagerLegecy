/* eslint-disable @typescript-eslint/no-explicit-any */
/* Player lifecycle & development statistical tests
   Run with: npx tsx scripts/test-player-lifecycle.ts
*/

import { buildInitialState } from "../src/state/seed";
import {
  runMonthlyPlayerDevelopment,
  runSeasonalPlayerLifecycle,
} from "../src/state/player-development";
import { promoteProspectToSenior, runSeasonalYouthGeneration } from "../src/state/academy";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL —", msg);
    process.exit(1);
  }
  console.log("PASS —", msg);
}

function clone(s: any) {
  return JSON.parse(JSON.stringify(s));
}

function advanceMonth(state: any, year: number, month: number, day = 1) {
  const m = String(month).padStart(2, "0");
  state.time = {
    ...state.time,
    date: `${year}-${m}-${String(day).padStart(2, "0")}`,
    season: state.time.season,
  };
  return state;
}

async function main() {
  // Base
  const base = buildInitialState();

  // Test 1: young player development vs older — young should grow more
  let s1 = clone(base);
  // create two players identical except age and potential
  const pYoung = { ...s1.players[Object.keys(s1.players)[0]] } as any;
  pYoung.id = "tpyoung";
  pYoung.age = 17;
  pYoung.overall = 55;
  pYoung.potential = 80;
  pYoung.playingTime = { appearancesThisSeason: 20, startsThisSeason: 18, minutesThisSeason: 1500 };
  pYoung.injury = null;
  s1.players[pYoung.id] = pYoung;
  s1.clubs[s1.currentClub.id].playerIds.push(pYoung.id);

  const pOld = { ...pYoung, id: "tpold", age: 26, overall: 65, potential: 75 } as any;
  s1.players[pOld.id] = pOld;
  s1.clubs[s1.currentClub.id].playerIds.push(pOld.id);

  // run 6 months
  for (let i = 0; i < 6; i++) {
    advanceMonth(s1, 2026, i + 1);
    s1 = runMonthlyPlayerDevelopment(s1 as any) as any;
  }

  const growthYoung = (s1.players[pYoung.id].overall ?? 0) - 55;
  const growthOld = (s1.players[pOld.id].overall ?? 0) - 65;
  assert(growthYoung >= growthOld, `Young growth (${growthYoung}) >= Old growth (${growthOld})`);

  // Test 2: professionalism influence — higher professionalism should yield more growth
  let s2 = clone(base);
  const pa = { ...s2.players[Object.keys(s2.players)[1]] } as any;
  pa.id = "tpA";
  pa.age = 19;
  pa.overall = 50;
  pa.potential = 75;
  pa.professionalism = 85;
  s2.players[pa.id] = pa;
  s2.clubs[s2.currentClub.id].playerIds.push(pa.id);

  const pb = { ...pa, id: "tpB", professionalism: 40 } as any;
  s2.players[pb.id] = pb;
  s2.clubs[s2.currentClub.id].playerIds.push(pb.id);

  for (let i = 0; i < 6; i++) {
    advanceMonth(s2, 2026, i + 1);
    s2 = runMonthlyPlayerDevelopment(s2 as any) as any;
  }
  const growA = s2.players[pa.id].overall - 50;
  const growB = s2.players[pb.id].overall - 50;
  assert(growA >= growB, `High professionalism growth (${growA}) >= low (${growB})`);

  // Test 3: playing time matters — starter gets more growth
  let s3 = clone(base);
  const pStarter = { ...s3.players[Object.keys(s3.players)[2]] } as any;
  pStarter.id = "tpStart";
  pStarter.age = 20;
  pStarter.overall = 52;
  pStarter.potential = 78;
  pStarter.playingTime = {
    appearancesThisSeason: 25,
    startsThisSeason: 24,
    minutesThisSeason: 2100,
  };
  s3.players[pStarter.id] = pStarter;
  s3.clubs[s3.currentClub.id].playerIds.push(pStarter.id);

  const pBench = {
    ...pStarter,
    id: "tpBench",
    playingTime: { appearancesThisSeason: 6, startsThisSeason: 2, minutesThisSeason: 240 },
  } as any;
  s3.players[pBench.id] = pBench;
  s3.clubs[s3.currentClub.id].playerIds.push(pBench.id);

  for (let i = 0; i < 6; i++) {
    advanceMonth(s3, 2026, i + 1);
    s3 = runMonthlyPlayerDevelopment(s3 as any) as any;
  }
  const gStart = s3.players[pStarter.id].overall - 52;
  const gBench = s3.players[pBench.id].overall - 52;
  assert(gStart >= gBench, `Starter growth (${gStart}) >= Bench (${gBench})`);

  // Test 4: training intensity effect — high intensity training yields more development (but watch injuries)
  let s4 = clone(base);
  // create two fresh players with identical starting state
  const pidHigh = "tp_high_new";
  const pidLow = "tp_low_new";
  const template = s4.players[Object.keys(s4.players)[3]] as any;
  const newHigh = {
    ...template,
    id: pidHigh,
    age: 19,
    overall: 50,
    potential: 80,
    fatigue: 20,
    injury: null,
  } as any;
  const newLow = {
    ...template,
    id: pidLow,
    age: 19,
    overall: 50,
    potential: 80,
    fatigue: 20,
    injury: null,
  } as any;
  s4.players[pidHigh] = newHigh;
  s4.players[pidLow] = newLow;
  s4.clubs[s4.currentClub.id].playerIds.push(pidHigh, pidLow);
  // assign training plans: high vs low
  s4.training = [
    {
      id: `tp-high`,
      name: "high",
      focus: "Development",
      intensity: "high",
      assignedPlayerIds: [pidHigh],
    },
    {
      id: `tp-low`,
      name: "low",
      focus: "Development",
      intensity: "low",
      assignedPlayerIds: [pidLow],
    },
  ];

  for (let i = 0; i < 6; i++) {
    advanceMonth(s4, 2026, i + 1);
    // simulate daily fatigue/injury hooks conservatively by running monthly development only
    s4 = runMonthlyPlayerDevelopment(s4 as any) as any;
  }
  const gh = s4.players[pidHigh].overall - 50;
  const gl = s4.players[pidLow].overall - 50;
  assert(gh >= gl, `High-intensity growth (${gh}) >= low (${gl})`);

  // Test 5: injuries interrupt development — set a severe injury and ensure no growth
  let s5 = clone(base);
  const pidInj = Object.keys(s5.players)[5];
  s5.players[pidInj].age = 20;
  s5.players[pidInj].overall = 60;
  s5.players[pidInj].potential = 75;
  s5.players[pidInj].injury = {
    type: "severe",
    severity: "severe",
    returnDate: "2099-01-01",
  } as any;
  for (let i = 0; i < 3; i++) {
    advanceMonth(s5, 2026, i + 1);
    s5 = runMonthlyPlayerDevelopment(s5 as any) as any;
  }
  assert(
    s5.players[pidInj].overall === 60,
    `Injured player no development (still ${s5.players[pidInj].overall})`,
  );

  // Test 6: aging and retirement
  let s6 = clone(base);
  const pidOld = "test-retire-1";
  s6.players[pidOld] = {
    id: pidOld,
    name: "Retiree",
    pos: "ST",
    age: 38,
    overall: 50,
    potential: 50,
    fitness: 60,
    morale: 50,
    form: 50,
    formTrend: "flat",
    attrs: { pace: 40, shooting: 50, passing: 40, dribbling: 40, defending: 30, physical: 50 },
    professionalism: 50,
    personality: "Composed",
    value: "€0",
    salary: "€0",
    contractUntil: "Jun 2026",
    contractYears: 0,
    trainingFocus: "",
    trainingProgress: 0,
    status: "available",
    starter: false,
    consistency: 50,
    injuryProneness: 50,
    fatigue: 20,
    injury: null,
    marketValue: 0,
    development: { trainingEfficiency: 50, growthRate: 0 },
    playingTime: { appearancesThisSeason: 0, startsThisSeason: 0, minutesThisSeason: 0 },
    relationships: [],
    tacticalFamiliarity: {},
    reputation: 40,
    lastMatchRating: 5,
    matchRatingHistory: [],
    clubId: s6.currentClub.id,
  } as any;
  s6.clubs[s6.currentClub.id].playerIds.push(pidOld);
  // simulate new year -> retire check
  advanceMonth(s6, 2026, 1);
  s6 = runSeasonalPlayerLifecycle(s6 as any) as any;
  // retirement may be probabilistic; ensure age increment occurred or status set to retired
  assert(
    s6.players[pidOld].age === 39 || s6.players[pidOld].status === "retired",
    "Aging or retirement applied",
  );

  // Test 7: a retiring player should be replaced by an academy prospect in the senior squad
  let s7 = clone(base);
  const retireClubId = s7.currentClub.id;
  const retiredId = "retire-replacement-test";
  const prospectId = "prospect-replacement-test";
  s7.players[retiredId] = {
    ...s7.players[Object.keys(s7.players)[0]],
    id: retiredId,
    name: "Retiring Veteran",
    age: 45,
    overall: 68,
    potential: 68,
    fitness: 50,
    status: "available",
    clubId: retireClubId,
  } as any;
  s7.clubs[retireClubId].playerIds.push(retiredId);
  s7.players[prospectId] = {
    ...s7.players[Object.keys(s7.players)[1]],
    id: prospectId,
    name: "Academy Prospect",
    age: 17,
    overall: 62,
    potential: 80,
    status: "available",
    clubId: retireClubId,
  } as any;
  s7.clubs[retireClubId].academy = {
    ...s7.clubs[retireClubId].academy,
    prospectIds: [prospectId],
  };
  advanceMonth(s7, 2026, 1);
  s7 = runSeasonalPlayerLifecycle(s7 as any) as any;
  assert(s7.players[retiredId]?.status === "retired", "Retiring veteran should be flagged retired");
  assert(
    s7.clubs[retireClubId].playerIds.includes(prospectId),
    "An academy prospect should slot into the senior squad when a player retires",
  );

  // Test 8: potential distribution sanity (generate youth prospects and check ranges)
  const s8 = clone(base);
  const generated = runSeasonalYouthGeneration(s8 as any) as any;
  const potentials = Object.values(generated.players)
    .map((p: any) => p.potential ?? 0)
    .filter((n) => n > 0);
  assert(potentials.length > 0, "Generated prospects have potentials");
  const avgPot = potentials.reduce((a: number, b: number) => a + b, 0) / potentials.length;
  assert(avgPot >= 40 && avgPot <= 90, `Average potential in expected range (${avgPot})`);

  console.log("\nAll player lifecycle tests passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
