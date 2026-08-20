import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import type { GameState } from "../src/state/types";

let state = buildInitialState("0");
for (let season = 0; season < 5; season++) state = simulateSeasonQuick(state);

const scheduledByDate = new Map<string, typeof state.fixtures>();
for (const fixture of state.fixtures) {
  if (fixture.status !== "scheduled") continue;
  const list = scheduledByDate.get(fixture.calendarDate) ?? [];
  list.push(fixture);
  scheduledByDate.set(fixture.calendarDate, list);
}

let sameDayMatchDays = 0;
let sameDayMatches = 0;
let overlappingClubDays = 0;
let overlappingPlayerDays = 0;
let maxMatchesPerDay = 0;
const overlapExamples: Array<Record<string, unknown>> = [];

for (const [date, fixtures] of scheduledByDate) {
  const clubs = new Map<string, string[]>();
  const players = new Map<string, string[]>();
  for (const fixture of fixtures) {
    sameDayMatches += 1;
    maxMatchesPerDay = Math.max(maxMatchesPerDay, fixtures.length);
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const entries = clubs.get(clubId) ?? [];
      entries.push(fixture.id);
      clubs.set(clubId, entries);
      for (const playerId of state.clubs[clubId]?.playerIds ?? []) {
        const playerEntries = players.get(playerId) ?? [];
        playerEntries.push(fixture.id);
        players.set(playerId, playerEntries);
      }
    }
  }
  const clubOverlaps = [...clubs.entries()].filter(([, ids]) => ids.length > 1);
  const playerOverlaps = [...players.entries()].filter(([, ids]) => ids.length > 1);
  if (fixtures.length > 1) sameDayMatchDays += 1;
  if (clubOverlaps.length > 0) overlappingClubDays += 1;
  if (playerOverlaps.length > 0) {
    overlappingPlayerDays += 1;
    if (overlapExamples.length < 5) {
      overlapExamples.push({ date, fixtures: fixtures.map((fixture) => fixture.id), playerOverlaps: playerOverlaps.slice(0, 3) });
    }
  }
}

const report = {
  matureState: { clubs: Object.keys(state.clubs).length, players: Object.keys(state.players).length, fixtures: state.fixtures.length },
  scheduledDates: scheduledByDate.size,
  sameDayMatchDays,
  sameDayMatches,
  maxMatchesPerDay,
  overlappingClubDays,
  overlappingPlayerDays,
  overlapExamples,
  nineIObserved: { matches: 2599, playerDictionaryClones: 2599, playerCloneMs: 140626.0293, playerUpdateMs: 140978.3758, fixtureHookMs: 176814.2205, dailyMs: 20318.8442 },
};
console.log(JSON.stringify(report, null, 2));
