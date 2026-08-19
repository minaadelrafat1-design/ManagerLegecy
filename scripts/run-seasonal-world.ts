import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

function summarize(state: any) {
  return {
    season: state.time.season,
    date: state.time.date,
    events: (state.events ?? []).length,
    fixtures: (state.fixtures ?? []).length,
    playedMatches: (state.fixtures ?? []).filter((f: any) => f.status === "played").length,
    transfers: (state.events ?? []).filter(
      (e: any) => e.meta?.action === "transfer" || e.type === "transfer",
    ).length,
  };
}

async function main() {
  const years = parseInt(process.argv[2] || "15", 10);
  let state = buildInitialState();
  const summary: any[] = [];
  for (let i = 0; i < years; i++) {
    state = simulateSeason(state as any) as any;
    summary.push(summarize(state));
    state = applyWorldSeasonProgression(state as any);
  }
  console.log(JSON.stringify({ years, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
