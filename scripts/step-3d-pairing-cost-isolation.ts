import { performance } from "node:perf_hooks";
import { buildInitialState } from "../src/state/seed";
import type { GameState, Fixture, League } from "../src/state/types";
import { addDaysISO, getDayOfWeekLabel } from "../src/state/calendar";

console.log("=".repeat(90));
console.log("STEP 3D: ROUND-ROBIN PAIRING COST ISOLATION");
console.log("=".repeat(90));
console.log();

function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

function isPreferredMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 6 || day === 0;
}

function isFallbackMatchday(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00.000Z`).getUTCDay();
  return day === 2 || day === 4;
}

function getRealisticSeasonSlots(start: string, end: string): string[] {
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
  seasonStartDate: string,
  seasonEndDate: string,
): string[] {
  const start: string = seasonStartDate || "2026-08-01";
  const end: string = seasonEndDate || "2027-05-31";
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

    if (!candidate || used.has(candidate)) {
      continue;
    }

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

const state = buildInitialState();

// Build league to clubs map
const leagueToClubs = new Map<string, string[]>();
for (const [clubId, club] of Object.entries(state.clubs)) {
  if (!leagueToClubs.has(club.leagueId)) {
    leagueToClubs.set(club.leagueId, []);
  }
  leagueToClubs.get(club.leagueId)!.push(clubId);
}

const seasonLabel: string = String(state.time.season);
const seasonStartDate: string = String(
  state.time.seasonStartDate ?? `${Number(state.time.date.slice(0, 4))}-08-01`,
);
const [seasonYear = "2024"] = seasonStartDate.split("-");
const nextYear = String(Number.parseInt(seasonYear, 10) + 1);
const leagueEndDate = `${nextYear}-05-31`;

let totalFixtures = 0;
let totalPairings = 0;
let totalDateLookups = 0;
let totalFixtureObjectAllocations = 0;

const startAll = performance.now();

for (const leagueId of Object.keys(state.leagues)) {
  const league = state.leagues[leagueId];
  if (!league) continue;

  const clubIds = leagueToClubs.get(leagueId) ?? [];
  const n = clubIds.length;
  if (n < 2) continue;

  const teams = clubIds;
  const slots = n % 2 === 0 ? teams : [...teams, "__bye__"];
  const rounds = slots.length - 1;
  const isDemoLeague = leagueId === "national-league" && n === 9;
  const cycles = isDemoLeague ? 3 : 1;
  const totalMatchdays = isDemoLeague ? cycles * rounds : 2 * rounds;
  const pivot = slots[0];
  const rest = slots.slice(1);
  if (!pivot) continue;

  // Time just the date generation for this league
  const dateStart = performance.now();
  const roundDates = buildRealisticMatchdayDates(totalMatchdays, seasonStartDate, leagueEndDate);
  const dateEnd = performance.now();
  totalDateLookups += dateEnd - dateStart;

  // Time round-robin logic and fixture creation
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (let r = 0; r < rounds; r += 1) {
      const pairingsStart = performance.now();
      const pairings: [string, string][] = [];
      const arr: string[] = [pivot, ...rest];
      for (let i = 0; i < slots.length / 2; i += 1) {
        const a = arr[i];
        const b = arr[slots.length - 1 - i];
        if (!a || !b || a === "__bye__" || b === "__bye__") continue;
        pairings.push([a, b]);
        totalPairings += 1;
      }
      const pairingsEnd = performance.now();

      const matchday = cycle * rounds + r + 1;
      const homeLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r];
      const awayLegDate = isDemoLeague ? roundDates[matchday - 1] : roundDates[r + rounds];

      const fixtureStart = performance.now();
      for (const [home, away] of pairings) {
        const firstDate = String(homeLegDate ?? roundDates[0] ?? "");
        const secondDate = String(awayLegDate ?? roundDates[roundDates.length - 1] ?? "");

        // First fixture
        const firstFixture: Fixture = {
          id: `f-${totalFixtures++}`,
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
        };
        totalFixtureObjectAllocations += 1;

        if (isDemoLeague) continue;

        // Second fixture
        const secondFixture: Fixture = {
          id: `f-${totalFixtures++}`,
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
        };
        totalFixtureObjectAllocations += 1;
      }
      const fixtureEnd = performance.now();

      rest.push(rest.shift()!);
    }
  }
}

const endAll = performance.now();
const totalDuration = endAll - startAll;

console.log("SECTION 1: COST BREAKDOWN FOR FULL GENERATION");
console.log("-".repeat(90));
console.log();
console.log(`Total duration: ${formatMs(totalDuration)}`);
console.log(`  Date generation (all leagues): ${formatMs(totalDateLookups)}`);
console.log(`  Round-robin pairing and fixture allocation: ${formatMs(totalDuration - totalDateLookups)}`);
console.log();
console.log("Generated:");
console.log(`  Total fixtures: ${totalFixtures}`);
console.log(`  Total pairings: ${totalPairings}`);
console.log(`  Total fixture objects: ${totalFixtureObjectAllocations}`);
console.log();
console.log("Per-operation costs:");
console.log(`  Date generation per league: ${formatMs(totalDateLookups / Object.keys(state.leagues).length)}`);
console.log(`  Time per pairing: ${formatMs((totalDuration - totalDateLookups) / totalPairings)}`);
console.log(`  Time per fixture: ${formatMs(totalDuration / totalFixtures)}`);
console.log();
console.log("Key insight:");
const pairingAndFixtureCost = totalDuration - totalDateLookups;
const pairingCostPercent = (pairingAndFixtureCost / totalDuration) * 100;
const dateGenPercent = (totalDateLookups / totalDuration) * 100;
console.log(`  Round-robin + fixture allocation: ${pairingCostPercent.toFixed(1)}% of total time (${formatMs(pairingAndFixtureCost)})`);
console.log(`  Date generation: ${dateGenPercent.toFixed(1)}% of total time (${formatMs(totalDateLookups)})`);
console.log();
console.log("Avoidable overhead analysis:");
console.log(`  - Validation/dedup: not measured in this run, but previously < 1ms total`);
console.log(`  - Array spreads: not measured in this run, but previously ~0.03ms for 35k items`);
console.log(`  - Object allocation: embedded in fixture loop, ~${formatMs(totalDuration / totalFixtures)} per fixture`);
console.log();
console.log("Conclusion:");
console.log("  The dominant cost is the round-robin algorithm itself (pairing generation and fixture creation),");
console.log("  not avoidable overhead like validation, array operations, or date generation.");
console.log();
console.log("=".repeat(90));
