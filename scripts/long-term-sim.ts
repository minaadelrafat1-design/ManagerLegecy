import { simulateSeasonQuick } from "../src/state/season";

function makeSeedWorld(leagues = 3, clubsPerLeague = 10) {
  const clubs: Record<string, any> = {};
  const leaguesObj: Record<string, any> = {};
  const competitions: any[] = [];
  for (let li = 0; li < leagues; li++) {
    const lid = `L${li + 1}`;
    leaguesObj[lid] = { id: lid, name: `League ${li + 1}`, competitionId: `c-${lid}` };
    competitions.push({ id: `c-${lid}`, name: `Comp ${lid}` });
    for (let ci = 0; ci < clubsPerLeague; ci++) {
      const id = `${lid}-club-${ci + 1}`;
      clubs[id] = {
        id,
        name: id,
        leagueId: lid,
        reputation: 50 + ci,
        facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
        playerIds: [],
      };
    }
  }
  return {
    time: { date: new Date().toISOString(), week: 1, season: 2026 },
    clubs,
    leagues: leaguesObj,
    competitions,
    fixtures: [],
    players: {},
    meta: {},
    events: [],
  } as any;
}

async function run() {
  const seasons = [5, 10, 20];
  for (const s of seasons) {
    const world = makeSeedWorld(2, 8);
    let next = world;
    for (let i = 0; i < s; i++) {
      next = simulateSeasonQuick(next);
    }
    console.log(
      `After ${s} seasons: clubs=${Object.keys(next.clubs).length}, events=${(next.events || []).length}`,
    );
  }
  console.log("Long-term quick simulations complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
