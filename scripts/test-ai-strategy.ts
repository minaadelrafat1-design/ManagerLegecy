/* eslint-disable @typescript-eslint/no-explicit-any */
/* Tests for multi-season AI strategy selection
   Run with: npx tsx scripts/test-ai-strategy.ts
*/

import { buildInitialState } from "../src/state/seed";
import { evaluateClubStrategy } from "../src/state/ai-strategy";
import { addClubMemory } from "../src/state/ai-memory";

function check(label: string, cond: boolean, detail = "") {
  const ok = Boolean(cond);
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${ok || !detail ? "" : ` (${detail})`}`);
  return ok;
}

async function main() {
  let failures = 0;
  const base = buildInitialState();

  // helper: pick nth club that has players
  const clubsWithPlayers = Object.keys(base.clubs).filter(
    (id) => (base.clubs[id].playerIds?.length ?? 0) > 0,
  );
  if (clubsWithPlayers.length === 0) {
    console.error("No clubs with players in seeded state");
    process.exit(2);
  }

  // Scenario A: youth-focused, weak finances
  const sA = JSON.parse(JSON.stringify(base));
  const cA = clubsWithPlayers[0];
  sA.clubs[cA].academy.prospectIds = Array.from({ length: 8 }, (_, i) => `pA${i}`);
  sA.clubs[cA].facilities.youth = 90;
  sA.clubs[cA].aiManager = {
    ...(sA.clubs[cA].aiManager ?? {}),
    youthPreference: 90,
    financialTendency: "frugal",
    id: "am-a",
  };
  sA.clubs[cA].reputation = 40;
  // reduce finances
  sA.finances.transferBudget = "€500K";

  const stratA = evaluateClubStrategy(sA as any, cA);
  console.log("Scenario A strategy:", stratA);
  if (
    !check("Scenario A leans to rebuild-around-youth", stratA.strategy === "rebuild-around-youth")
  )
    failures++;

  // Scenario B: wealthy, ambitious club
  const sB = JSON.parse(JSON.stringify(base));
  const cB = clubsWithPlayers[1] ?? clubsWithPlayers[0];
  sB.clubs[cB].reputation = 85;
  sB.finances.transferBudget = "€80.0M";
  sB.clubs[cB].aiManager = {
    ...(sB.clubs[cB].aiManager ?? {}),
    youthPreference: 20,
    financialTendency: "spender",
    id: "am-b",
  };
  const stratB = evaluateClubStrategy(sB as any, cB);
  console.log("Scenario B strategy:", stratB);
  if (
    !check(
      "Scenario B leans to challenge-promotion or prepare-european",
      ["challenge-promotion", "prepare-european"].includes(stratB.strategy),
    )
  )
    failures++;

  // Scenario C: aging core, decent finances
  const sC = JSON.parse(JSON.stringify(base));
  const cC = clubsWithPlayers[2] ?? clubsWithPlayers[0];
  // make squad older
  for (const pid of sC.clubs[cC].playerIds) {
    const p = sC.players[pid];
    if (p) p.age = (p.age ?? 28) + 5;
  }
  sC.finances.transferBudget = "€25.0M";
  const stratC = evaluateClubStrategy(sC as any, cC);
  console.log("Scenario C strategy:", stratC);
  if (!check("Scenario C leans to replace-aging-core", stratC.strategy === "replace-aging-core"))
    failures++;

  // Scenario D: many contracts expiring and financial pressure
  const sD = JSON.parse(JSON.stringify(base));
  const cD = clubsWithPlayers[3] ?? clubsWithPlayers[0];
  for (const pid of sD.clubs[cD].playerIds) {
    const p = sD.players[pid];
    if (p) p.contractYears = 1;
  }
  sD.finances.transferBudget = "€200K";
  const stratD = evaluateClubStrategy(sD as any, cD);
  console.log("Scenario D strategy:", stratD);
  if (
    !check(
      "Scenario D leans to reduce-wage-bill or consolidate",
      ["reduce-wage-bill", "consolidate"].includes(stratD.strategy),
    )
  )
    failures++;

  // Ensure different profiles produce different strategies (diversity)
  const uniques = new Set([stratA.strategy, stratB.strategy, stratC.strategy, stratD.strategy]);
  if (
    !check(
      "Different profiles produce diverse strategies",
      uniques.size >= 3,
      `unique=${[...uniques].join(",")}`,
    )
  )
    failures++;

  console.log(`\nTest summary: ${failures} failures`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
