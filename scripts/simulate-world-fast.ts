/* Fast long-term world simulation harness
   Run with: npx tsx scripts/simulate-world-fast.ts
   This harness avoids the full React/store startup path and imports only
   the state modules needed to register the life-cycle hooks that drive
   long-term player, youth, and season behaviour.
*/

import "../src/state/ai-evolution";
import "../src/state/training";
import "../src/state/events-engine";
import "../src/state/board";
import "../src/state/world-tick";
import { buildInitialState } from "../src/state/seed";
import { advanceGameDays, addDaysISO } from "../src/state/calendar";

function parseMoney(display: any) {
  if (typeof display === "number") return display;
  if (!display) return 0;
  const s = String(display).replace(/[^0-9.-]/g, "");
  return Math.round(Number(s) || 0);
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function collectStats(state: any, initialPlayersSet: Set<string>) {
  const players = Object.values(state.players || {});
  const numPlayers = players.length;
  const ages = players.map((p: any) => p.age ?? 0).filter(Boolean);
  const avgAge = avg(ages);
  const retired = players.filter((p: any) => p.status === "retired").length;
  const newPlayers = players.filter((p: any) => !initialPlayersSet.has(p.id));
  const youthGenerated = newPlayers.filter((p: any) => (p.age ?? 99) <= 18).length;
  const avgOvr = avg(players.map((p: any) => p.overall ?? 0));
  const avgPot = avg(players.map((p: any) => p.potential ?? p.overall ?? 0));
  const clubReps = Object.values(state.clubs).map((c: any) => c.reputation ?? 0);
  const leagueStrength = avg(
    Object.values(state.clubs).map((c: any) => {
      const overalls = (c.playerIds ?? []).map((id: string) => state.players[id]?.overall ?? 50);
      return avg(overalls.length ? overalls : [50]);
    }),
  );

  const transfers = (state.events ?? []).filter(
    (e: any) => (e.meta?.action ?? "").includes("transfer") || e.type === "transfer",
  );
  const promotions = (state.events ?? []).filter(
    (e: any) =>
      String(e.description).toLowerCase().includes("promot") ||
      String(e.description).toLowerCase().includes("promoted"),
  );
  const relegations = (state.events ?? []).filter((e: any) =>
    String(e.description).toLowerCase().includes("relegat"),
  );

  const finances = Object.values(state.clubs).map((c: any) =>
    parseMoney(state.finances?.balance ?? 0),
  );
  const avgClubBalance = avg(finances);

  const played = (state.fixtures ?? []).filter((f: any) => f.status === "played");
  const matches = played.length;
  const goals = played.reduce(
    (s: number, f: any) => s + (f.scoreHome ?? 0) + (f.scoreAway ?? 0),
    0,
  );
  const goalsPerMatch = matches ? goals / matches : 0;

  const mgrChanges = (state.events ?? []).filter((e: any) =>
    /replaced manager/i.test(e.description),
  ).length;

  return {
    numPlayers,
    avgAge,
    retired,
    youthGenerated,
    avgOvr,
    avgPot,
    clubReps,
    leagueStrength,
    transfers: transfers.length,
    promotions: promotions.length,
    relegations: relegations.length,
    avgClubBalance,
    matches,
    goals,
    goalsPerMatch,
    mgrChanges,
  };
}

function invariantChecks(state: any) {
  const issues: string[] = [];
  const ids = Object.keys(state.players || {});
  const uniq = new Set(ids);
  if (uniq.size !== ids.length) issues.push("duplicate player ids");

  const clubBalances = Object.values(state.clubs).map((c: any) =>
    parseMoney(state.finances?.balance ?? 0),
  );
  if (clubBalances.some((b) => b < -1_000_000)) issues.push("club with very negative balance");

  for (const p of Object.values(state.players || {})) {
    if (p.salary && parseMoney(p.salary) < 0) issues.push(`negative salary ${p.id}`);
    if (p.contractYears < 0) issues.push(`negative contractYears ${p.id}`);
  }

  const someNeverRetire = Object.values(state.players || {}).every((p: any) => p.age < 70);
  if (!someNeverRetire) issues.push("some players have age >= 70 suspicious");

  return issues;
}

async function main() {
  const yearsToRun = [3];
  const seeds = [0];
  const results: any[] = [];

  for (const years of yearsToRun) {
    for (const seed of seeds) {
      console.log(`Running ${years} year(s) seed=${seed}...`);
      let state = buildInitialState();
      state = {
        ...state,
        time: {
          ...state.time,
          date: addDaysISO(state.time.date, seed),
          seasonStartDate: addDaysISO(state.time.seasonStartDate, seed),
        },
      };
      const initialPlayers = new Set(Object.keys(state.players || {}));
      const days = Math.floor(years * 365.25);
      state = advanceGameDays(state, days) as any;

      const stats = collectStats(state, initialPlayers);
      const issues = invariantChecks(state);
      const summary = { years, seed, stats, issues };
      results.push(summary);
      console.log(JSON.stringify(summary, null, 2));
    }
  }

  const report = { runs: results.length, results };
  console.log("\n=== AGGREGATE REPORT ===\n", JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
