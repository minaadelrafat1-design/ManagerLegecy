import { simulateSeason, generateLeagueFixtures } from "../src/state/season";
import { computeLeagueTable } from "../src/state/standings";

function makeMinimalWorld(clubCount = 6) {
  const clubs: Record<string, any> = {};
  const leagues: Record<string, any> = {
    L1: { id: "L1", name: "League 1", competitionId: "c-L1" },
  };
  const competitions = [{ id: "c-L1", name: "League 1" }];
  for (let i = 0; i < clubCount; i++) {
    const id = `club-${i + 1}`;
    clubs[id] = {
      id,
      name: `Club ${i + 1}`,
      leagueId: "L1",
      reputation: 50 + (i % 5) * 3,
      facilities: { training: 50, medical: 50, youth: 50, stadium: 50 },
      playerIds: [],
    };
  }
  const state: any = {
    time: { date: new Date().toISOString(), week: 1, season: 2026 },
    clubs,
    leagues,
    competitions,
    fixtures: [],
    players: {},
    matches: [],
    transfers: [],
    staff: [],
    finances: { balance: "€0", loans: [], income: {}, expenses: {} },
    currentClub: undefined,
    events: [],
    meta: {},
  };
  return state;
}

function checkNoDuplicatePositions(table: any[]) {
  const positions = new Set();
  for (const row of table) {
    if (positions.has(row.position)) return false;
    positions.add(row.position);
  }
  return true;
}

async function run() {
  const state = makeMinimalWorld(8);
  let next = generateLeagueFixtures(state);
  // simulate a full season (uses engine to resolve fixtures)
  next = simulateSeason(next);
  const table = computeLeagueTable(next, "L1");
  console.log(
    "League table:",
    table.map((r) => ({ id: r.clubId, pos: r.position, pts: r.points })),
  );
  const noDup = checkNoDuplicatePositions(table);
  if (!noDup) {
    console.error("Invariant failed: duplicate positions in table");
    process.exit(2);
  }

  // Points / goals consistency: recompute from fixtures
  const playedFixtures = (next.fixtures ?? []).filter((f) => f.status === "played");
  const stats: Record<
    string,
    {
      played: number;
      wins: number;
      draws: number;
      losses: number;
      gf: number;
      ga: number;
      points: number;
    }
  > = {};
  for (const c of Object.keys(next.clubs))
    stats[c] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 };
  for (const f of playedFixtures) {
    const h = f.homeClubId;
    const a = f.awayClubId;
    const sh = f.scoreHome ?? 0;
    const sa = f.scoreAway ?? 0;
    stats[h].played++;
    stats[a].played++;
    stats[h].gf += sh;
    stats[h].ga += sa;
    stats[a].gf += sa;
    stats[a].ga += sh;
    if (sh > sa) {
      stats[h].wins++;
      stats[a].losses++;
      stats[h].points += 3;
    } else if (sh < sa) {
      stats[a].wins++;
      stats[h].losses++;
      stats[a].points += 3;
    } else {
      stats[h].draws++;
      stats[a].draws++;
      stats[h].points += 1;
      stats[a].points += 1;
    }
  }

  // compare against computed table
  let failed = false;
  for (const row of table) {
    const s = stats[row.clubId];
    if (!s) {
      console.error(`Invariant failed: table contains unknown club ${row.clubId}`);
      failed = true;
      continue;
    }
    if (
      row.played !== s.played ||
      row.wins !== s.wins ||
      row.draws !== s.draws ||
      row.losses !== s.losses ||
      row.goalsFor !== s.gf ||
      row.goalsAgainst !== s.ga ||
      row.points !== s.points
    ) {
      console.error("Invariant mismatch for club", row.clubId, { table: row, recomputed: s });
      failed = true;
    }
  }
  if (failed) {
    console.error("Competition invariants FAILED.");
    process.exit(2);
  }

  // ensure season finished: no scheduled fixtures remain
  const remaining = (next.fixtures ?? []).filter((f) => f.status === "scheduled");
  if (remaining.length > 0) {
    console.error("Invariant failed: scheduled fixtures remain after season end", remaining.length);
    process.exit(2);
  }

  console.log("Competition invariants passed for sample league.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
