/* eslint-disable @typescript-eslint/no-explicit-any */
// Run with: npx tsx scripts/simulate-ai-personalities.ts

import "../src/state/store"; // register hooks
import { buildInitialState } from "../src/state/seed";
import runWorldTick from "../src/state/world-tick";
import { addDaysISO } from "../src/state/calendar";
import type { GameState } from "../src/state/types";

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

function collectPerPersonality(state: any) {
  const byPersonality: Record<string, any[]> = {};
  for (const club of Object.values(state.clubs || {})) {
    const pid =
      (club.aiManager && (club.aiManager.personality?.id ?? club.aiManager.personality?.label)) ||
      "player-club";
    const players = (club.playerIds || []).map((id: string) => state.players[id]).filter(Boolean);
    const ages = players.map((p: any) => p.age ?? 0).filter(Boolean);
    const avgAge = ages.length ? Math.round(avg(ages)) : 0;
    const youthUsage = players.length
      ? players.filter((p: any) => p.age <= 23).length / players.length
      : 0;
    const transfersOut = (state.transfers || []).filter(
      (t: any) => t.sellerClubId === club.id,
    ).length;
    const events = state.events || [];
    const mgrReplacements = events.filter(
      (e: any) =>
        /replaced manager/i.test(e.description) && String(e.description).includes(club.name),
    ).length;
    const ledger = (state.meta?.aiLedgers || {})[club.id];
    const transferBudget = ledger ? ledger.transferBudget : 0;
    const balance = parseMoney(state.finances?.balance ?? 0);
    const rep = club.reputation ?? 0;
    const standing = (() => {
      try {
        // computeClubStanding exists but to avoid heavy imports we use league position placeholder
        return club.leaguePosition ?? null;
      } catch (e) {
        return null;
      }
    })();

    byPersonality[pid] = byPersonality[pid] || [];
    byPersonality[pid].push({
      avgAge,
      youthUsage,
      transfersOut,
      mgrReplacements,
      transferBudget,
      balance,
      rep,
      standing,
    });
  }
  // aggregate
  const summary: Record<string, any> = {};
  for (const k of Object.keys(byPersonality)) {
    const list = byPersonality[k];
    summary[k] = {
      clubs: list.length,
      avgAge: Math.round(avg(list.map((x) => x.avgAge))),
      avgYouthUsage: Number((avg(list.map((x) => x.youthUsage)) * 100).toFixed(1)),
      transfersOut: list.reduce((s, x) => s + x.transfersOut, 0),
      mgrReplacements: list.reduce((s, x) => s + x.mgrReplacements, 0),
      avgTransferBudget: Math.round(avg(list.map((x) => x.transferBudget || 0))),
      avgReputation: Math.round(avg(list.map((x) => x.rep || 0))),
    };
  }
  return summary;
}

async function main() {
  const yearsToRun = [5, 30];
  const seeds = [0, 1];

  for (const years of yearsToRun) {
    for (const seed of seeds) {
      console.log(`Running ${years}-year simulation (seed=${seed})...`);
      let state: GameState = buildInitialState();
      state = {
        ...state,
        time: {
          ...state.time,
          date: addDaysISO(state.time.date, seed),
          seasonStartDate: addDaysISO(state.time.seasonStartDate, seed),
        },
      } as any;
      const days = Math.floor(years * 365.25);
      state = runWorldTick(state, days) as any;
      const report = collectPerPersonality(state);
      console.log(JSON.stringify({ years, seed, report }, null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
