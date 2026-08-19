import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

function summarize(state: any) {
  return {
    season: state.time.season,
    date: state.time.date,
    events: (state.events ?? []).length,
    fixtures: (state.fixtures ?? []).length,
    matches: (state.matches ?? []).length,
    transfers: (state.transfers ?? []).length,
  };
}

function run(years = 10) {
  let state = buildInitialState();
  const summary: any[] = [];
  for (let i = 0; i < years; i++) {
    state = simulateSeasonQuick(state as any) as any;
    summary.push(summarize(state));
    state = applyWorldSeasonProgression(state as any);
  }
  console.log(JSON.stringify({ years, summary }, null, 2));
}

async function main() {
  run(parseInt(process.argv[2] || "10", 10));
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
