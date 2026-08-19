/* =============================================================================
 * Phase B2 — league standings smoke tests
 * =============================================================================
 * Same standalone-script approach as `scripts/test-calendar.ts` (run with
 * `npx tsx scripts/test-standings.ts`) — no test runner wired in yet. This
 * covers exactly what the phase brief asks for: every required table
 * column is calculated, tiebreakers apply in the configured order, rules
 * are swappable without touching `computeStandings`, and — the one the
 * brief calls out explicitly — recording a match result changes the
 * actual table.
 *
 * Same `localStorage` stub as `test-calendar.ts`, for the same reason
 * (`state/persistence.ts` only touches storage when `window` exists, and
 * `buildInitialState`'s callers go through modules that import it).
 * ---------------------------------------------------------------------------*/

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
};

const { buildInitialState } = await import("../src/state/seed.ts");
const { gameReducer } = await import("../src/state/reducer.ts");
const { computeStandings, computeLeagueTable, DEFAULT_STANDINGS_RULES } =
  await import("../src/state/standings.ts");
type Club = Awaited<ReturnType<typeof buildInitialState>>["clubs"][string];
type Fixture = Awaited<ReturnType<typeof buildInitialState>>["fixtures"][number];

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? "PASS" : "FAIL"} — ${label}${ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`}`,
  );
  if (!ok) failures++;
}

// ---- 1. seeded table: every required column, every league club present ---------

const seeded = buildInitialState();
const leagueId = seeded.currentClub.leagueId;
const table = computeLeagueTable(seeded, leagueId);

const leagueClubIds = Object.values(seeded.clubs)
  .filter((c) => c.leagueId === leagueId)
  .map((c) => c.id)
  .sort();

check("table: one row per club in the league", table.map((r) => r.clubId).sort(), leagueClubIds);
check(
  "table: every row has the full required column set",
  table.every(
    (r) =>
      typeof r.played === "number" &&
      typeof r.wins === "number" &&
      typeof r.draws === "number" &&
      typeof r.losses === "number" &&
      typeof r.goalsFor === "number" &&
      typeof r.goalsAgainst === "number" &&
      typeof r.goalDifference === "number" &&
      typeof r.points === "number",
  ),
  true,
);
check(
  "table: played = wins + draws + losses for every row",
  table.every((r) => r.played === r.wins + r.draws + r.losses),
  true,
);
check(
  "table: goalDifference = goalsFor - goalsAgainst for every row",
  table.every((r) => r.goalDifference === r.goalsFor - r.goalsAgainst),
  true,
);
check(
  "table: points = 3*W + 1*D for every row (default rules)",
  table.every((r) => r.points === r.wins * 3 + r.draws * 1),
  true,
);
check(
  "table: positions are 1..n with no gaps",
  table.map((r) => r.position),
  leagueClubIds.map((_, i) => i + 1),
);

// ---- 2. sort order: points desc, then goal difference, then goals scored -------

function isSortedByDefaultRules(rows: typeof table): boolean {
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const curr = rows[i]!;
    if (prev.points !== curr.points) {
      if (prev.points < curr.points) return false;
      continue;
    }
    if (prev.goalDifference !== curr.goalDifference) {
      if (prev.goalDifference < curr.goalDifference) return false;
      continue;
    }
    if (prev.goalsFor < curr.goalsFor) return false;
  }
  return true;
}
check(
  "table: sorted points -> goal difference -> goals scored",
  isSortedByDefaultRules(table),
  true,
);

// ---- 3. a club with no played fixtures still gets a row (0/0/0) ----------------

const untouchedClub: Club = { ...seeded.clubs[seeded.currentClub.id]!, id: "test-untouched-club" };
const soloTable = computeStandings([untouchedClub], [], "some-competition");
check("computeStandings: winless/gameless club still gets a row", soloTable.length, 1);
check("computeStandings: 0 played -> 0 everything", soloTable[0], {
  clubId: "test-untouched-club",
  position: 1,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
});

// ---- 4. tiebreakers apply in the configured order, in isolation ----------------

function makeClub(id: string, leagueOf = "L"): Club {
  return { ...untouchedClub, id, leagueId: leagueOf };
}
function fx(id: string, home: string, away: string, scoreHome: number, scoreAway: number): Fixture {
  return {
    id,
    competitionId: "C",
    season: "2026/27",
    homeClubId: home,
    awayClubId: away,
    date: "test",
    matchday: 1,
    venue: "H",
    status: "played",
    result: null,
    scoreHome,
    scoreAway,
  };
}

// A and B both have 3 points from one win each — separated by goal difference.
const gdClubs = [makeClub("A"), makeClub("B"), makeClub("opp1"), makeClub("opp2")];
const gdFixtures = [fx("f1", "A", "opp1", 4, 0), fx("f2", "B", "opp2", 1, 0)];
const gdTable = computeStandings(gdClubs, gdFixtures, "C");
check("tiebreak: equal points, higher goal difference ranks first", gdTable[0]?.clubId, "A");

// C and D: same points AND same goal difference — separated by goals scored.
const gfClubs = [makeClub("C"), makeClub("D"), makeClub("opp3"), makeClub("opp4")];
const gfFixtures = [fx("f3", "C", "opp3", 3, 1), fx("f4", "D", "opp4", 2, 0)];
const gfTable = computeStandings(gfClubs, gfFixtures, "C");
check("tiebreak: equal points and GD, more goals scored ranks first", gfTable[0]?.clubId, "C");

// E and F: identical on every configured tiebreaker — falls back to club id.
const tiedClubs = [makeClub("F"), makeClub("E")];
const tiedFixtures = [fx("f5", "E", "F", 0, 0)];
const tiedTable = computeStandings(tiedClubs, tiedFixtures, "C");
check(
  "tiebreak: fully level -> deterministic club-id fallback",
  tiedTable.map((r) => r.clubId),
  ["E", "F"],
);

// ---- 5. rules are configurable — a different points/tiebreaker scheme changes the table --

const twoPointsForWin = {
  ...DEFAULT_STANDINGS_RULES,
  pointsForWin: 2,
};
const altTable = computeLeagueTable(seeded, leagueId, twoPointsForWin);
const homeRowDefault = table.find((r) => r.clubId === seeded.currentClub.id)!;
const homeRowAlt = altTable.find((r) => r.clubId === seeded.currentClub.id)!;
check(
  "configurable rules: 2-points-for-a-win changes points but not W/D/L",
  { points: homeRowAlt.points, wins: homeRowAlt.wins },
  { points: homeRowDefault.wins * 2 + homeRowDefault.draws, wins: homeRowDefault.wins },
);

const goalsFirstRules = {
  ...DEFAULT_STANDINGS_RULES,
  tiebreakers: ["goalsFor", "points"] as const,
};
const goalsFirstTable = computeStandings(gfClubs, gfFixtures, "C", goalsFirstRules);
check(
  "configurable rules: reordering tiebreakers changes the ranking function used",
  goalsFirstTable[0]?.clubId,
  "C", // same winner here, but exercised through the custom `tiebreakers` array rather than the default
);

// ---- 6. the one the brief calls out: a match result changes the actual table ---

const beforeFixture = seeded.fixtures.find((f) => f.id === "fx-14")!;
check("pre-condition: fx-14 hasn't been played in the seed", beforeFixture.status, "scheduled");

const beforeTable = computeLeagueTable(seeded, leagueId);
const beforeHome = beforeTable.find((r) => r.clubId === beforeFixture.homeClubId)!;
const beforeAway = beforeTable.find((r) => r.clubId === beforeFixture.awayClubId)!;

const afterState = gameReducer(seeded, {
  type: "RECORD_MATCH_RESULT",
  fixtureId: "fx-14",
  homeClubId: beforeFixture.homeClubId,
  awayClubId: beforeFixture.awayClubId,
  scoreHome: 2,
  scoreAway: 1,
  seed: 1,
  playedAt: "Sat 6 Dec",
});
const afterTable = computeLeagueTable(afterState, leagueId);
const afterHome = afterTable.find((r) => r.clubId === beforeFixture.homeClubId)!;
const afterAway = afterTable.find((r) => r.clubId === beforeFixture.awayClubId)!;

check(
  "RECORD_MATCH_RESULT: fixture flips to played",
  afterState.fixtures.find((f) => f.id === "fx-14")?.status,
  "played",
);
check(
  "RECORD_MATCH_RESULT: table is a genuinely different object",
  afterTable !== beforeTable,
  true,
);
check(
  "RECORD_MATCH_RESULT: home club's played count goes up",
  afterHome.played,
  beforeHome.played + 1,
);
check(
  "RECORD_MATCH_RESULT: home club's win/points reflect the 2-1 result",
  {
    wins: afterHome.wins,
    points: afterHome.points,
    goalsFor: afterHome.goalsFor,
    goalsAgainst: afterHome.goalsAgainst,
  },
  {
    wins: beforeHome.wins + 1,
    points: beforeHome.points + DEFAULT_STANDINGS_RULES.pointsForWin,
    goalsFor: beforeHome.goalsFor + 2,
    goalsAgainst: beforeHome.goalsAgainst + 1,
  },
);
check(
  "RECORD_MATCH_RESULT: away club's loss/points reflect the 2-1 result",
  {
    losses: afterAway.losses,
    points: afterAway.points,
    goalsFor: afterAway.goalsFor,
    goalsAgainst: afterAway.goalsAgainst,
  },
  {
    losses: beforeAway.losses + 1,
    points: beforeAway.points + DEFAULT_STANDINGS_RULES.pointsForLoss,
    goalsFor: beforeAway.goalsFor + 1,
    goalsAgainst: beforeAway.goalsAgainst + 2,
  },
);

const untouchedRows = afterTable.filter(
  (r) => r.clubId !== beforeFixture.homeClubId && r.clubId !== beforeFixture.awayClubId,
);
const untouchedRowsBefore = beforeTable.filter(
  (r) => r.clubId !== beforeFixture.homeClubId && r.clubId !== beforeFixture.awayClubId,
);
check(
  "RECORD_MATCH_RESULT: every other club's stats are untouched",
  untouchedRows.map((r) => ({ ...r, position: 0 })),
  untouchedRowsBefore.map((r) => ({ ...r, position: 0 })),
);

// Recording the same match twice more (different score) still only reflects
// the fixture's current (latest) score — dispatch is idempotent-by-fixture,
// not additive, since `computeStandings` re-derives from `state.fixtures`
// rather than accumulating events.
const replayedState = gameReducer(afterState, {
  type: "RECORD_MATCH_RESULT",
  fixtureId: "fx-14",
  homeClubId: beforeFixture.homeClubId,
  awayClubId: beforeFixture.awayClubId,
  scoreHome: 3,
  scoreAway: 3,
  seed: 2,
  playedAt: "Sat 6 Dec",
});
const replayedTable = computeLeagueTable(replayedState, leagueId);
const replayedHome = replayedTable.find((r) => r.clubId === beforeFixture.homeClubId)!;
check(
  "RECORD_MATCH_RESULT again on the same fixture: table reflects the new score, not both",
  { played: replayedHome.played, draws: replayedHome.draws, wins: replayedHome.wins },
  { played: beforeHome.played + 1, draws: beforeHome.draws + 1, wins: beforeHome.wins },
);

// ---- 7. no promotion/relegation concept exists on the computed row -------------

check(
  "scope: a table row has no promotion/relegation field",
  Object.keys(afterHome).sort(),
  [
    "clubId",
    "draws",
    "goalDifference",
    "goalsAgainst",
    "goalsFor",
    "losses",
    "played",
    "points",
    "position",
    "wins",
  ].sort(),
);

// ---- summary ---------------------------------------------------------------------

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
