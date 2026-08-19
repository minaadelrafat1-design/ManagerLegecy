/* Quick one-year simulation to verify monthly/seasonal lifecycle hooks
   Run with: npx tsx scripts/simulate-one-year.ts
*/

import "../src/state/store";
import { buildInitialState } from "../src/state/seed";
import runWorldTick from "../src/state/world-tick";
import { addDaysISO } from "../src/state/calendar";

async function main() {
  const years = 1;
  const seed = 0;
  console.log(`Running quick check: ${years} year(s), seed=${seed}`);
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
  state = runWorldTick(state, days) as any;

  const players = Object.values(state.players || {});
  const retired = players.filter((p: any) => p.status === "retired").length;
  const newPlayers = players.filter((p: any) => !initialPlayers.has(p.id));
  const youthGenerated = newPlayers.filter((p: any) => (p.age ?? 99) <= 18).length;
  const promotions = (state.events ?? []).filter(
    (e: any) =>
      String(e.description).toLowerCase().includes("promot") ||
      String(e.description).toLowerCase().includes("promoted"),
  ).length;
  const relegations = (state.events ?? []).filter((e: any) =>
    String(e.description).toLowerCase().includes("relegat"),
  ).length;

  console.log({
    retired,
    youthGenerated,
    promotions,
    relegations,
    events: (state.events ?? []).length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
