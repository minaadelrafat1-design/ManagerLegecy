import { buildInitialState } from "../src/state/seed";
import { simulateSeason } from "../src/state/season";
import { applyWorldSeasonProgression } from "../src/state/world";

function summarizeMoves(before: Record<string, string>, after: Record<string, string>) {
  const moves: Array<{ clubId: string; from: string; to: string }> = [];
  for (const [clubId, fromLeague] of Object.entries(before)) {
    const toLeague = after[clubId];
    if (!toLeague) continue;
    if (fromLeague !== toLeague) moves.push({ clubId, from: fromLeague, to: toLeague });
  }
  return moves;
}

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
  const years = parseInt(process.argv[2] || "10", 10);
  let state = buildInitialState();
  const report: any[] = [];
  for (let i = 0; i < years; i++) {
    const before: Record<string, string> = Object.fromEntries(
      Object.entries(state.clubs).map(([id, c]: any) => [id, c.leagueId]),
    );
    state = simulateSeason(state as any) as any;
    const after: Record<string, string> = Object.fromEntries(
      Object.entries(state.clubs).map(([id, c]: any) => [id, c.leagueId]),
    );
    const moves = summarizeMoves(before, after);
    const s = summarize(state);
    report.push({ seasonIndex: i + 1, summary: s, moves });
    state = applyWorldSeasonProgression(state as any) as any;
  }
  console.log(JSON.stringify({ years: report.length, report }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
