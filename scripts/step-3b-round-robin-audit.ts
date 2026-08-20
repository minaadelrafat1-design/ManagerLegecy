import { buildInitialState } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import type { GameState, Fixture } from "../src/state/types";
import { addDaysISO, getDayOfWeekLabel } from "../src/state/calendar";

const BYE = "__bye__";

function isPreferredMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 6 || day === 0;
}

function isFallbackMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 2 || day === 4;
}

function getRealisticSeasonSlots(
  seasonStartDate: string | undefined,
  seasonEndDate: string | undefined,
): string[] {
  const start = seasonStartDate || "2026-08-01";
  const end = seasonEndDate || "2027-05-31";
  const effectiveStart = addDaysISO(start, 14);
  const slots: string[] = [];
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const cursor = new Date(`${effectiveStart}T00:00:00.000Z`);

  while (cursor <= endDate) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isPreferredMatchday(iso) || isFallbackMatchday(iso)) {
      slots.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}

function buildRealisticMatchdayDates(
  totalMatchdays: number,
  seasonStartDate: string | undefined,
  seasonEndDate: string | undefined,
): string[] {
  const start = seasonStartDate || "2026-08-01";
  const end = seasonEndDate || "2027-05-31";
  if (totalMatchdays <= 0) return [];

  const slotPool = getRealisticSeasonSlots(start, end);
  const fallbackPool: string[] = [];
  const cursor = new Date(`${addDaysISO(start, 14)}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);

  while (cursor <= endDate) {
    fallbackPool.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const combinedPool =
    slotPool.length >= totalMatchdays ? slotPool : [...slotPool, ...fallbackPool];
  const chosen: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < totalMatchdays; i += 1) {
    const poolIndex =
      combinedPool.length === 1
        ? 0
        : Math.min(
            combinedPool.length - 1,
            Math.round((i / Math.max(totalMatchdays - 1, 1)) * (combinedPool.length - 1)),
          );
    let candidate: string | undefined = combinedPool[poolIndex];
    let probe = poolIndex;

    while (candidate && used.has(candidate) && probe < combinedPool.length - 1) {
      probe += 1;
      candidate = combinedPool[probe];
    }

    if (candidate && used.has(candidate)) {
      for (let fallbackIndex = 0; fallbackIndex < fallbackPool.length; fallbackIndex += 1) {
        const fallbackDate = fallbackPool[fallbackIndex];
        if (fallbackDate && !used.has(fallbackDate)) {
          candidate = fallbackDate;
          break;
        }
      }
    }

    if (!candidate || used.has(candidate)) continue;
    used.add(candidate);
    chosen.push(candidate);
  }

  return [...new Set(chosen)].sort((a, b) => a.localeCompare(b));
}

function formatDisplayDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = getDayOfWeekLabel(dateISO);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday} ${day} ${month}`;
}

function createLeagueToClubIds(state: GameState): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [clubId, club] of Object.entries(state.clubs)) {
    const list = map.get(club.leagueId) ?? [];
    list.push(clubId);
    map.set(club.leagueId, list);
  }
  return map;
}

function candidateGenerateLeagueFixtures(state: GameState): GameState {
  const next = { ...state } as GameState;
  const fixtures: Fixture[] = [];

  const existingFixtureNumbers = (state.fixtures ?? []).reduce((max, fixture) => {
    const match = /^f-(\d+)$/.exec(fixture.id);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);

  let fixtureId = existingFixtureNumbers + 1;
  const seasonLabel = String(state.time.season);
  const seasonStartDate = String(
    state.time.seasonStartDate ?? `${Number(state.time.date.slice(0, 4))}-08-01`,
  );
  const [seasonYear = "2024"] = seasonStartDate.split("-");
  const nextYear = String(Number.parseInt(seasonYear, 10) + 1);
  const leagueEndDate = `${nextYear}-05-31`;
  const leagueToClubs = createLeagueToClubIds(state);

  for (const leagueId of Object.keys(state.leagues)) {
    const league = state.leagues[leagueId];
    if (!league) continue;

    const existingLeagueFixtures = (state.fixtures ?? []).filter(
      (f) =>
        f.competitionId === league.competitionId &&
        (f.season ?? state.time.season) === state.time.season,
    );
    if (existingLeagueFixtures.length > 0) continue;

    const clubIds = leagueToClubs.get(leagueId) ?? [];
    const n = clubIds.length;
    if (n < 2) continue;

    const slots = n % 2 === 0 ? [...clubIds] : [...clubIds, BYE];
    const rounds = slots.length - 1;
    const pairingsByRound: Array<Array<[string, string]>> = [];
    let arr = [...slots];

    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const currentPairs: Array<[string, string]> = [];
      for (let i = 0; i < slots.length / 2; i += 1) {
        const a = arr[i];
        const b = arr[slots.length - 1 - i];
        if (!a || !b || a === BYE || b === BYE) continue;
        currentPairs.push([a, b]);
      }
      pairingsByRound.push(currentPairs);
      const first = arr[0];
      const last = arr[slots.length - 1];
      if (first !== undefined && last !== undefined) {
        arr = [first, last, ...arr.slice(1, slots.length - 1)];
      }
    }

    const isDemoLeague = leagueId === "national-league" && n === 9;
    const cycles = isDemoLeague ? 3 : 1;
    const totalMatchdays = isDemoLeague ? cycles * rounds : 2 * rounds;
    const roundDates = buildRealisticMatchdayDates(totalMatchdays, seasonStartDate, leagueEndDate);

    for (let cycle = 0; cycle < cycles; cycle += 1) {
      for (let r = 0; r < rounds; r += 1) {
        const pairings = pairingsByRound[r] ?? [];
        const matchday = cycle * rounds + r + 1;
        const homeLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r];
        const awayLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r + rounds];

        for (const [home, away] of pairings) {
          const firstDate = String(homeLegDate ?? roundDates[0] ?? "");
          const secondDate = String(awayLegDate ?? roundDates[roundDates.length - 1] ?? "");

          fixtures.push({
            id: `f-${fixtureId++}`,
            competitionId: league.competitionId,
            season: seasonLabel,
            matchday,
            calendarDate: firstDate,
            date: formatDisplayDate(firstDate),
            homeClubId: home,
            awayClubId: away,
            venue: "H",
            status: "scheduled",
            result: null,
          });

          if (isDemoLeague) continue;

          fixtures.push({
            id: `f-${fixtureId++}`,
            competitionId: league.competitionId,
            season: seasonLabel,
            matchday: matchday + rounds,
            calendarDate: secondDate,
            date: formatDisplayDate(secondDate),
            homeClubId: away,
            awayClubId: home,
            venue: "A",
            status: "scheduled",
            result: null,
          });
        }
      }
    }
  }

  return { ...next, fixtures: [...(next.fixtures ?? []), ...fixtures] };
}

function compareFixtureLists(a: Fixture[], b: Fixture[]): string | null {
  if (a.length !== b.length) return `length mismatch: ${a.length} vs ${b.length}`;

  for (let i = 0; i < a.length; i += 1) {
    const af = a[i];
    const bf = b[i];
    if (!af || !bf) return `missing fixture at index ${i}`;
    const fields = [
      "id",
      "competitionId",
      "season",
      "matchday",
      "calendarDate",
      "date",
      "homeClubId",
      "awayClubId",
      "status",
      "venue",
    ] as const;
    for (const field of fields) {
      if (af[field] !== bf[field]) {
        return `first difference at index ${i}: ${field} ${String(af[field])} vs ${String(bf[field])}`;
      }
    }
  }

  return null;
}

function benchmark(label: string, fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

const base = buildInitialState();
const production = generateLeagueFixtures(base);
const candidate = candidateGenerateLeagueFixtures(base);

const productionFixtures = production.fixtures ?? [];
const candidateFixtures = candidate.fixtures ?? [];
const diff = compareFixtureLists(productionFixtures, candidateFixtures);

console.log("STEP 3B: round-robin audit");
console.log("production fixtures:", productionFixtures.length);
console.log("candidate fixtures:", candidateFixtures.length);
console.log("first difference:", diff ?? "none");

const currentState = buildInitialState();
const candidateState = buildInitialState();
const productionTime = benchmark("production", () => {
  generateLeagueFixtures(currentState);
});
const candidateTime = benchmark("candidate", () => {
  candidateGenerateLeagueFixtures(candidateState);
});

console.log("production ms:", productionTime.toFixed(2));
console.log("candidate ms:", candidateTime.toFixed(2));
console.log("delta ms:", (candidateTime - productionTime).toFixed(2));
console.log("relative change:", ((candidateTime - productionTime) / productionTime * 100).toFixed(2), "%");

if (diff) {
  process.exit(1);
}
