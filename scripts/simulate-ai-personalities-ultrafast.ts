/* Ultra-fast 5-year personality simulation.
   Advances time in monthly steps and runs only the evolution/development
   subsystems (no fixtures/match simulation) so it completes much faster.
   Run with: npx tsx scripts/simulate-ai-personalities-ultrafast.ts
*/
import "../src/state/store";
import { buildInitialState } from "../src/state/seed";
import { addDaysISO } from "../src/state/calendar";
import {
  runMonthlyPlayerDevelopment,
  runSeasonalPlayerLifecycle,
} from "../src/state/player-development";
import { runSeasonalYouthGeneration } from "../src/state/academy";
import { runSeasonalStaffLifecycle } from "../src/state/staff";
import { evaluateJobSecurity, generateJobOffers } from "../src/state/jobs";

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function collectPerPersonality(state: any) {
  const byPersonality: Record<string, any[]> = {};
  for (const club of Object.values(state.clubs || {})) {
    const pid =
      (club.aiManager && (club.aiManager.personality?.id ?? club.aiManager.personality?.label)) ||
      "player-club";
    const players = (club.playerIds || []).map((id: string) => state.players[id]).filter(Boolean);
    const ages = players.map((p: any) => p.age || 0).filter(Boolean);
    const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const youthUsage = players.length
      ? players.filter((p: any) => p.age <= 23).length / players.length
      : 0;
    const ledger = (state.meta?.aiLedgers || {})[club.id];
    const transferBudget = ledger ? ledger.transferBudget : 0;
    byPersonality[pid] = byPersonality[pid] || [];
    byPersonality[pid].push({ avgAge, youthUsage, transferBudget });
  }
  const summary: Record<string, any> = {};
  for (const k of Object.keys(byPersonality)) {
    const list = byPersonality[k];
    summary[k] = {
      clubs: list.length,
      avgAge: avg(list.map((x) => x.avgAge)),
      avgYouthUsage: Number((avg(list.map((x: any) => x.youthUsage)) * 100).toFixed(1)),
      avgTransferBudget: Math.round(avg(list.map((x: any) => x.transferBudget || 0))),
    };
  }
  return summary;
}

async function main() {
  const years = 5;
  const months = years * 12;
  console.log(`Running ultrafast ${years}yr sim (${months} months)...`);
  let state: any = buildInitialState();

  for (let m = 0; m < months; m++) {
    // advance roughly one month
    state = { ...state, time: { ...state.time, date: addDaysISO(state.time.date, 30) } };

    // monthly player development (fast path)
    state = runMonthlyPlayerDevelopment(state as any) as any;

    // seasonal life-cycle approx at Aug 1 and Jan 1
    const date = state.time.date as string;
    const isSeasonOpening = date.endsWith("-08-01");
    const isYearOpening = date.endsWith("-01-01");
    if (isSeasonOpening || isYearOpening) {
      state = runSeasonalPlayerLifecycle(state as any) as any;
      state = runSeasonalStaffLifecycle(state as any) as any;
      state = evaluateJobSecurity(state as any) as any;
      state = generateJobOffers(state as any) as any;
      if (isSeasonOpening) state = runSeasonalYouthGeneration(state as any) as any;
    }
  }

  const report = collectPerPersonality(state);
  console.log(JSON.stringify({ years, months, report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
