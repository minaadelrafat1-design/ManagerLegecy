/* eslint-disable @typescript-eslint/no-explicit-any */
/* AI differentiation smoke test
   Run with: npx tsx scripts/test-ai-differentiation.ts
*/

import { buildInitialState } from "../src/state/seed";
import { runAiActions } from "../src/state/ai-actions";
import { evaluateClubStrategy } from "../src/state/ai-strategy";

function diffSummaryForClub(s: any, clubId: string) {
  return {
    transfersListed: s.transfers.filter(
      (t: any) => t.sellerClubId === clubId || t.listingClubId === clubId,
    ).length,
    events: s.events.filter((e: any) => e.meta?.clubId === clubId).length,
    trainingPlans: (s.training ?? []).filter((t: any) => String(t.id).includes(clubId)).length,
    starters: (s.clubs[clubId]?.playerIds ?? []).filter((pid: any) => s.players[pid]?.starter)
      .length,
  };
}

function deepEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const base = buildInitialState();
  // pick two AI clubs, tweak profiles differently
  const aiClubs = Object.keys(base.clubs).filter((id) => base.clubs[id].aiManager);
  if (aiClubs.length < 2) {
    console.error("Need at least two AI clubs in seeded state");
    process.exit(2);
  }

  const a = aiClubs[0];
  const b = aiClubs[1];

  const sA = JSON.parse(JSON.stringify(base));
  sA.clubs[a].aiManager = {
    ...(sA.clubs[a].aiManager ?? {}),
    youthPreference: 95,
    financialTendency: "frugal",
    id: `test-a`,
  };
  sA.clubs[a].academy = sA.clubs[a].academy ?? { prospectIds: [] };
  sA.clubs[a].academy.prospectIds = Array.from({ length: 6 }, (_, i) => `pa${i}`);

  const sB = JSON.parse(JSON.stringify(base));
  sB.clubs[b].aiManager = {
    ...(sB.clubs[b].aiManager ?? {}),
    youthPreference: 10,
    financialTendency: "spender",
    id: `test-b`,
  };
  sB.finances = { ...(sB.finances ?? {}), transferBudget: "€80.0M" };

  const outA = runAiActions(sA as any) as any;
  const outB = runAiActions(sB as any) as any;

  const sumA = diffSummaryForClub(outA, a);
  const sumB = diffSummaryForClub(outB, b);

  console.log(`Club ${a} summary:`, sumA);
  console.log(`Club ${b} summary:`, sumB);

  // Also check strategy outputs differ for the modified clubs
  const stratA = evaluateClubStrategy(sA as any, a);
  const stratB = evaluateClubStrategy(sB as any, b);
  console.log(`Strategy A: ${stratA.strategy}`, `Strategy B: ${stratB.strategy}`);

  if (deepEqual(sumA, sumB) && stratA.strategy === stratB.strategy) {
    console.error(
      "FAIL — AI clubs produced identical per-club outcomes and strategies; differentiation missing",
    );
    process.exit(1);
  }

  console.log("PASS — AI differentiation observed");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
