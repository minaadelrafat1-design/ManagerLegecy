/* Simple test harness to compare AI personality groups at seed time.
   Run with: npx tsx scripts/test-ai-personalities.ts
*/
import "../src/state/store";
import { buildInitialState } from "../src/state/seed";
import runWorldTick from "../src/state/world-tick";
import { addDaysISO } from "../src/state/calendar";

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function parseMoney(display: any) {
  if (typeof display === "number") return display;
  if (!display) return 0;
  const s = String(display).replace(/[^0-9.-]/g, "");
  return Math.round(Number(s) || 0);
}

function collect(state: any) {
  const byPersonality: Record<string, any[]> = {};
  for (const club of Object.values(state.clubs || {})) {
    const pid =
      (club.aiManager && (club.aiManager.personality?.id ?? club.aiManager.personality?.label)) ||
      "player-club";
    const players = (club.playerIds || []).map((id: string) => state.players[id]).filter(Boolean);
    const youthUsage = players.length
      ? players.filter((p: any) => p.age <= 23).length / players.length
      : 0;
    const ledger = (state.meta?.aiLedgers || {})[club.id];
    const transferBudget = ledger ? ledger.transferBudget : 0;
    const transfersOut = (state.transfers || []).filter(
      (t: any) => t.sellerClubId === club.id,
    ).length;
    byPersonality[pid] = byPersonality[pid] || [];
    byPersonality[pid].push({ youthUsage, transferBudget, transfersOut });
  }
  const summary: Record<string, any> = {};
  for (const k of Object.keys(byPersonality)) {
    const list = byPersonality[k];
    summary[k] = {
      clubs: list.length,
      avgYouthUsage: Number((avg(list.map((x) => x.youthUsage)) * 100).toFixed(1)),
      avgTransferBudget: Math.round(avg(list.map((x) => x.transferBudget || 0))),
      transfersOut: list.reduce((s, x) => s + x.transfersOut, 0),
    };
  }
  return summary;
}

function pickTwo(groups: string[]) {
  if (groups.length < 2) return null;
  // prefer distinct known personalities
  const preferred = ["wealthy-aggressive", "youth-focused", "conservative", "selling-development"];
  for (const a of preferred) {
    for (const b of preferred) {
      if (a === b) continue;
      if (groups.includes(a) && groups.includes(b)) return [a, b];
    }
  }
  return [groups[0], groups[1]];
}

async function main() {
  // Run a deterministic 5-year simulation so behavioural differences emerge
  let state = buildInitialState();
  // small deterministic perturbation
  state = {
    ...state,
    time: {
      ...state.time,
      date: addDaysISO(state.time.date, 0),
      seasonStartDate: addDaysISO(state.time.seasonStartDate, 0),
    },
  } as any;
  const days = Math.floor(5 * 365.25);
  state = runWorldTick(state as any, days) as any;
  const summary = collect(state as any);
  console.log("Personality summary (5yr sim):", JSON.stringify(summary, null, 2));
  const groups = Object.keys(summary).filter((k) => k !== "player-club");
  const pair = pickTwo(groups);
  if (!pair) {
    console.log("Not enough distinct AI personality groups to compare. Test skipped.");
    process.exit(0);
  }
  const [a, b] = pair;
  const ma = summary[a];
  const mb = summary[b];
  const diffs = [] as string[];
  if (Math.abs(ma.avgYouthUsage - mb.avgYouthUsage) >= 5)
    diffs.push(`youthUsage ${a}=${ma.avgYouthUsage}% vs ${b}=${mb.avgYouthUsage}%`);
  if (Math.abs(ma.avgTransferBudget - mb.avgTransferBudget) >= 1_000_000)
    diffs.push(`transferBudget ${a}=${ma.avgTransferBudget} vs ${b}=${mb.avgTransferBudget}`);
  if (Math.abs(ma.transfersOut - mb.transfersOut) >= 2)
    diffs.push(`transfersOut ${a}=${ma.transfersOut} vs ${b}=${mb.transfersOut}`);

  if (diffs.length === 0) {
    console.error("Test failed: personality groups are not meaningfully different in seed state");
    process.exit(2);
  }
  console.log("Test passed — differences found:", diffs.join("; "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
