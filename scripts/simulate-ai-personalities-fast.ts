/* Fast 5-year personality simulation (seed=0)
  Run with: npx tsx scripts/simulate-ai-personalities-fast.ts
*/
import "../src/state/store";
import { buildInitialState } from "../src/state/seed";
import runWorldTick from "../src/state/world-tick";
import { addDaysISO } from "../src/state/calendar";

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function collectPerPersonality(state: any) {
  const byPersonality: Record<string, any[]> = {};
  for (const club of Object.values(state.clubs || {})) {
    const pid =
      (club.aiManager && (club.aiManager.personality?.id ?? club.aiManager.personality?.label)) ||
      "player-club";
    const players = (club.playerIds || []).map((id: string) => state.players[id]).filter(Boolean);
    const ages = players.map((p: any) => p.age || 0).filter(Boolean);
    const avgAge = ages.length ? Math.round(avg(ages)) : 0;
    const youthUsage = players.length
      ? players.filter((p: any) => p.age <= 23).length / players.length
      : 0;
    const transfersOut = (state.transfers || []).filter(
      (t: any) => t.sellerClubId === club.id,
    ).length;
    const ledger = (state.meta?.aiLedgers || {})[club.id];
    const transferBudget = ledger ? ledger.transferBudget : 0;
    byPersonality[pid] = byPersonality[pid] || [];
    byPersonality[pid].push({ avgAge, youthUsage, transfersOut, transferBudget });
  }
  const summary: Record<string, any> = {};
  for (const k of Object.keys(byPersonality)) {
    const list = byPersonality[k];
    summary[k] = {
      clubs: list.length,
      avgAge: Math.round(avg(list.map((x) => x.avgAge))),
      avgYouthUsage: Number((avg(list.map((x: any) => x.youthUsage)) * 100).toFixed(1)),
      transfersOut: list.reduce((s, x) => s + x.transfersOut, 0),
      avgTransferBudget: Math.round(avg(list.map((x: any) => x.transferBudget || 0))),
    };
  }
  return summary;
}

async function main() {
  const years = 5;
  const seed = 0;
  console.log(`Running fast ${years}yr sim seed=${seed}...`);
  let state: any = buildInitialState();
  state = {
    ...state,
    time: {
      ...state.time,
      date: addDaysISO(state.time.date, seed),
      seasonStartDate: addDaysISO(state.time.seasonStartDate, seed),
    },
  };
  const days = Math.floor(years * 365.25);
  state = runWorldTick(state, days) as any;
  const report = collectPerPersonality(state);
  console.log(JSON.stringify({ years, seed, report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
