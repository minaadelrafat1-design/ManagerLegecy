import { simulateAiFixture, seedFromFixtureId } from "../src/lib/ai-fixture-sim";
import { simulateAiFixtureViaEngine } from "../src/lib/ai-match-adapter";

function makeClub(id: string, reputation = 55) {
  return {
    id,
    name: id,
    abbr: id.slice(0, 3).toUpperCase(),
    formation: "4-3-3",
    reputation,
    facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
    playerIds: [],
  } as any;
}

async function run() {
  const home = makeClub("home", 60);
  const away = makeClub("away", 50);
  const players: Record<string, any> = {};
  const fixtures = [];
  for (let i = 0; i < 500; i++)
    fixtures.push({ id: `f-${i + 1}`, homeClubId: home.id, awayClubId: away.id });

  const statsLegacy = { homeWins: 0, awayWins: 0, draws: 0, goals: 0 };
  const statsEngine = { homeWins: 0, awayWins: 0, draws: 0, goals: 0 };

  for (const f of fixtures) {
    const seed = seedFromFixtureId(f.id);
    const l = simulateAiFixture(f as any, { home, away } as any, players, seed);
    const e = simulateAiFixtureViaEngine(
      f as any,
      { [home.id]: home, [away.id]: away } as any,
      players,
      seed,
    );
    statsLegacy.homeWins += l.outcome === "H" ? 1 : 0;
    statsLegacy.awayWins += l.outcome === "A" ? 1 : 0;
    statsLegacy.draws += l.outcome === "D" ? 1 : 0;
    statsLegacy.goals += l.scoreHome + l.scoreAway;

    statsEngine.homeWins += e.outcome === "H" ? 1 : 0;
    statsEngine.awayWins += e.outcome === "A" ? 1 : 0;
    statsEngine.draws += e.outcome === "D" ? 1 : 0;
    statsEngine.goals += e.scoreHome + e.scoreAway;
  }

  const n = fixtures.length;
  console.log("Legacy estimator:", {
    homePct: (statsLegacy.homeWins / n).toFixed(3),
    drawPct: (statsLegacy.draws / n).toFixed(3),
    avgGoals: (statsLegacy.goals / n).toFixed(3),
  });
  console.log("Engine:", {
    homePct: (statsEngine.homeWins / n).toFixed(3),
    drawPct: (statsEngine.draws / n).toFixed(3),
    avgGoals: (statsEngine.goals / n).toFixed(3),
  });

  // simple divergence check
  const diffGoals = Math.abs(statsLegacy.goals / n - statsEngine.goals / n);
  const diffHome = Math.abs(statsLegacy.homeWins / n - statsEngine.homeWins / n);
  console.log(`Divergence: goals=${diffGoals.toFixed(3)}, homePct=${diffHome.toFixed(3)}`);
  if (diffGoals > 0.6 || diffHome > 0.12) {
    console.warn(
      "Significant divergence detected between estimator and engine — consider tuning constants or deprecating the lightweight estimator for production.",
    );
  } else {
    console.log("Estimator and engine are reasonably aligned.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
