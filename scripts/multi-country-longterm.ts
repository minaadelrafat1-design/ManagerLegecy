import fs from "fs";
import { simulateSeasonQuick } from "../src/state/season";

function makeMultiCountryWorld(countryCount = 3, leaguesPerCountry = 2, clubsPerLeague = 8) {
  const clubs: Record<string, any> = {};
  const leagues: Record<string, any> = {};
  const competitions: any[] = [];
  for (let c = 0; c < countryCount; c++) {
    for (let l = 0; l < leaguesPerCountry; l++) {
      const lid = `C${c + 1}-L${l + 1}`;
      leagues[lid] = {
        id: lid,
        name: `Country${c + 1} League ${l + 1}`,
        competitionId: `comp-${lid}`,
      };
      competitions.push({ id: `comp-${lid}`, name: `Comp ${lid}` });
      for (let k = 0; k < clubsPerLeague; k++) {
        const id = `${lid}-club-${k + 1}`;
        clubs[id] = {
          id,
          name: id,
          leagueId: lid,
          reputation: 45 + (k % 10),
          facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
          playerIds: [],
        };
      }
    }
  }
  return {
    time: { date: new Date().toISOString(), week: 1, season: 2026 },
    clubs,
    leagues,
    competitions,
    fixtures: [],
    players: {},
    meta: {},
    events: [],
  } as any;
}

function summarizeState(state: any) {
  const clubs = Object.values(state.clubs || {});
  const avgRep =
    clubs.reduce((s: number, c: any) => s + (c.reputation ?? 50), 0) / Math.max(1, clubs.length);
  return {
    clubs: clubs.length,
    events: (state.events || []).length,
    avgReputation: +avgRep.toFixed(2),
  };
}

async function run() {
  const seeds = [5, 10, 20, 30];
  const outDir = "out";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (const seasons of seeds) {
    const world = makeMultiCountryWorld(3, 2, 8);
    let next = world;
    for (let i = 0; i < seasons; i++) next = simulateSeasonQuick(next);
    const summary = summarizeState(next);
    const path = `${outDir}/multi-country-${seasons}-seasons.json`;
    fs.writeFileSync(path, JSON.stringify({ seasons, summary }, null, 2), "utf8");
    console.log(`Wrote ${path}`);
  }
  console.log("Multi-country long-term sims complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
