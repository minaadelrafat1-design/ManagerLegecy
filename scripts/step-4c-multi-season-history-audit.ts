import assert from "node:assert/strict";
import { buildInitialState } from "../src/state/seed";
import { applyEuropeanQualificationRegistrations } from "../src/state/qualification";
import { runEuropeanCompetitions, getEuropeanChampion } from "../src/state/european";
import { applyPromotionRelegation } from "../src/state/promotion";
import { applyWorldSeasonProgression } from "../src/state/world";
import { computeLeagueTable } from "../src/state/standings";
import { recordSeasonChampion, recordCupWinner, recordEuropeanWinner } from "../src/state/world-history";
import { seededUnit } from "../src/state/utils";
import type { Competition, Fixture, GameState, League, WorldConfig } from "../src/state/types";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS";
interface Finding { severity: Severity; area: string; behavior: string; evidence: string; file: string; functionName: string; impact: string; recommendation: string; determinism: string; }
interface SeasonResult { season: string; leagueChampion: string; cupWinner: string; europeanWinner: string; promoted: string[]; relegated: string[]; registrations: string[]; historyCount: number; fingerprint: string; }

const findings: Finding[] = [];
function add(finding: Finding): void { findings.push(finding); console.log(`[${finding.severity}] ${finding.area}: ${finding.behavior}`); }
function pass(area: string, behavior: string, evidence: string, file: string, functionName: string): void { add({ severity: "PASS", area, behavior, evidence, file, functionName, impact: "No issue observed.", recommendation: "No change recommended.", determinism: "No determinism impact." }); }
function issue(severity: Exclude<Severity, "PASS">, area: string, behavior: string, evidence: string, file: string, functionName: string, impact: string, recommendation: string, determinism: string): void { add({ severity, area, behavior, evidence, file, functionName, impact, recommendation, determinism }); }
function keys(state: GameState): string[] { return (state.meta?.europeanQualifications ?? []).map((entry) => `${entry.season}:${entry.competitionId}:${entry.clubId}`); }
function duplicate(values: string[]): string[] { const seen = new Set<string>(); const result = new Set<string>(); for (const value of values) { if (seen.has(value)) result.add(value); seen.add(value); } return [...result]; }
function fixtureIds(state: GameState): string[] { return state.fixtures.map((fixture) => fixture.id); }
function fingerprint(state: GameState): string { return JSON.stringify({ time: state.time, clubs: Object.fromEntries(Object.entries(state.clubs).sort()), qualifications: state.meta?.europeanQualifications ?? [], history: state.history ?? null, events: state.events.filter((event) => ["PROMOTION", "RELEGATION"].includes(event.type)).map((event) => ({ type: event.type, meta: event.meta })), fixtures: state.fixtures }); }
function seasonStart(season: string): string { return `${season.split("/")[0]}-08-01`; }

function createCompactState(seed: string): GameState {
  const base = buildInitialState(seed);
  const premier = Object.values(base.clubs).filter((club) => club.leagueId === "england-premier").slice(0, 2);
  const championship = Object.values(base.clubs).filter((club) => club.leagueId === "england-championship").slice(0, 2);
  assert(premier.length === 2 && championship.length === 2, "compact source clubs unavailable");
  const selected = [...premier, ...championship];
  const clubs = Object.fromEntries(selected.map((club) => [club.id, { ...club }]));
  const topId = "audit-top";
  const bottomId = "audit-bottom";
  for (const club of Object.values(clubs)) club.leagueId = premier.some((item) => item.id === club.id) ? topId : bottomId;
  const leagues: Record<string, League> = {
    [topId]: { id: topId, name: "Audit Premier", competitionId: topId, season: String(base.time.season), matchday: 1 },
    [bottomId]: { id: bottomId, name: "Audit Championship", competitionId: bottomId, season: String(base.time.season), matchday: 1 },
  };
  const competitionEntries: Competition[] = [
    { id: topId, name: "Audit Premier", type: "league", stage: "Season", status: "active" },
    { id: bottomId, name: "Audit Championship", type: "league", stage: "Season", status: "active" },
    { id: "audit-cup", name: "Audit Cup", type: "cup", stage: "Final", status: "active" },
    { id: "audit-europe", name: "Audit Europe", type: "continental", stage: "Group stage", status: "active" },
  ];
  const worldConfig: WorldConfig = {
    countries: [{ id: "audit-country", name: "Audit Country", divisions: [
      { id: topId, name: "Audit Premier", countryId: "audit-country", level: 1, relegationTo: bottomId, relegationSpots: 1 },
      { id: bottomId, name: "Audit Championship", countryId: "audit-country", level: 2, promotionTo: topId, promotionSpots: 1 },
    ] }],
    competitions: [
      { id: topId, name: "Audit Premier", type: "league", countryId: "audit-country", divisionIds: [topId] },
      { id: bottomId, name: "Audit Championship", type: "league", countryId: "audit-country", divisionIds: [bottomId] },
      { id: "audit-cup", name: "Audit Cup", type: "cup", countryId: "audit-country" },
      { id: "audit-europe", name: "Audit Europe", type: "continental", qualificationSlots: 2, qualificationRules: [{ type: "leaguePosition", sourceCompetitionId: topId, positions: [1, 2] }], format: { groupStage: { numGroups: 1, teamsPerGroup: 2, homeAndAway: true, advancePerGroup: 2 }, knockoutStage: { rounds: [{ id: "final", name: "Final", teams: 2, twoLegged: false, isFinal: true }] } } },
    ],
  };
  return { ...base, clubs, leagues, competitions: competitionEntries, fixtures: [], meta: { ...(base.meta ?? {}), worldConfig, europeanQualifications: [] }, currentClub: clubs[selected[0]!.id]!, manager: { ...base.manager, clubId: selected[0]!.id }, gameSeed: seed };
}

function createSeasonFixtures(state: GameState, seed: string): GameState {
  const season = String(state.time.season);
  const date = state.time.date;
  const fixtures: Fixture[] = [];
  let id = 1;
  for (const leagueId of Object.keys(state.leagues)) {
    const clubs = Object.values(state.clubs).filter((club) => club.leagueId === leagueId);
    const score = seededUnit(`${seed}:${season}:${leagueId}`);
    fixtures.push({ id: `audit-${season}-${id++}`, competitionId: state.leagues[leagueId]!.competitionId, season, homeClubId: clubs[0]!.id, awayClubId: clubs[1]!.id, calendarDate: date, date, matchday: 1, venue: "H", status: "played", result: null, scoreHome: score > 0.5 ? 2 : 0, scoreAway: score > 0.5 ? 0 : 2 });
  }
  return { ...state, fixtures };
}

function runEuropeanForSeason(state: GameState): { state: GameState; winner: string } {
  let next = applyEuropeanQualificationRegistrations(state);
  const europeId = "audit-europe";
  next = runEuropeanCompetitions(next);
  assert(next.fixtures.some((fixture) => fixture.competitionId === europeId), `European group stage was not created: registrations=${JSON.stringify(next.meta?.europeanQualifications)} competitions=${JSON.stringify(next.meta?.worldConfig?.competitions)}`);
  next = { ...next, fixtures: next.fixtures.map((fixture) => fixture.competitionId === europeId && fixture.groupId ? { ...fixture, status: "played", scoreHome: 2, scoreAway: 0, result: null } : fixture) };
  next = runEuropeanCompetitions(next);
  next = { ...next, fixtures: next.fixtures.map((fixture) => fixture.competitionId === europeId && fixture.round === "final" ? { ...fixture, status: "played", scoreHome: 1, scoreAway: 0, result: null } : fixture) };
  const winner = getEuropeanChampion(next, europeId);
  assert(winner, `bounded European final did not produce a winner: ${JSON.stringify(next.fixtures.filter((fixture) => fixture.competitionId === europeId))}`);
  return { state: next, winner };
}

function runThreeSeasons(seed: string): { state: GameState; seasons: SeasonResult[] } {
  let state = createCompactState(seed);
  const seasons: SeasonResult[] = [];
  for (let index = 0; index < 3; index += 1) {
    const season = String(state.time.season);
    state = createSeasonFixtures(state, seed);
    const topTable = computeLeagueTable(state, "audit-top");
    const leagueChampion = topTable[0]!.clubId;
    const cupWinner = topTable[0]!.clubId;
    let european = runEuropeanForSeason(state);
    state = european.state;
    state = recordSeasonChampion(state, leagueChampion, "Audit Premier", season, "audit-top");
    state = recordCupWinner(state, cupWinner, "Audit Cup", season, "audit-cup");
    state = recordEuropeanWinner(state, european.winner, "Audit Europe", season, "audit-europe");
    const historyBeforeRepeat = state.history?.clubRecords.length ?? 0;
    state = recordEuropeanWinner(state, european.winner, "Audit Europe", season, "audit-europe");
    const historyAfterRepeat = state.history?.clubRecords.length ?? 0;
    if (historyBeforeRepeat !== historyAfterRepeat) issue("HIGH", "Completion contamination", "Repeating winner completion created a duplicate historical record.", `before=${historyBeforeRepeat}; after=${historyAfterRepeat}`, "src/state/world-history.ts", "recordEuropeanWinner", "Historical results can multiply across repeated processing.", "Make completion persistence idempotent by its logical key.", "Yes; duplicate history would diverge state.");
    const beforeMovement = Object.fromEntries(Object.entries(state.clubs).map(([id, club]) => [id, club.leagueId]));
    state = applyPromotionRelegation(state);
    const promoted = state.events.filter((event) => event.type === "PROMOTION" && event.meta?.season === season).map((event) => event.meta?.clubId).filter((id): id is string => Boolean(id));
    const relegated = state.events.filter((event) => event.type === "RELEGATION" && event.meta?.season === season).map((event) => event.meta?.clubId).filter((id): id is string => Boolean(id));
    const movementAgain = applyPromotionRelegation(state);
    if (movementAgain.events.length !== state.events.length) issue("HIGH", "Promotion/relegation contamination", "Repeating promotion/relegation changed the same season.", `events before=${state.events.length}; after=${movementAgain.events.length}`, "src/state/promotion.ts", "applyPromotionRelegation", "Division movement can be applied more than once.", "Strengthen the season guard with an explicit completion marker.", "Yes; repeated moves change state.");
    const registrationKeys = keys(state);
    const historyCount = state.history?.clubRecords.length ?? 0;
    seasons.push({ season, leagueChampion, cupWinner, europeanWinner: european.winner, promoted, relegated, registrations: registrationKeys, historyCount, fingerprint: fingerprint(state) });
    state = applyWorldSeasonProgression(state);
    state = { ...state, time: { ...state.time, seasonStartDate: seasonStart(state.time.season), date: seasonStart(state.time.season) }, fixtures: [], meta: { ...(state.meta ?? {}), europeanQualifications: state.meta?.europeanQualifications ?? [] } };
    const nextRegistrations = applyEuropeanQualificationRegistrations(state);
    if (duplicate(keys(nextRegistrations)).length > 0) issue("HIGH", "Registration rollover", "Next-season registration contains duplicate logical keys.", `duplicates=${duplicate(keys(nextRegistrations)).join(",")}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "Continental participation can be duplicated after rollover.", "Deduplicate registration identity by season, competition, and club.", "Yes; registration state would diverge.");
    state = nextRegistrations;
  }
  return { state, seasons };
}

function auditState(state: GameState): void {
  const registrations = state.meta?.europeanQualifications ?? [];
  const registrationDuplicates = duplicate(keys(state));
  const history = state.history?.clubRecords ?? [];
  const historyKeys = history.map((record) => record.uniqueKey ?? `${record.clubId}:${record.season}:${record.kind}:${record.title}`);
  const historyDuplicates = duplicate(historyKeys);
  const invalidClubs = history.filter((record) => !state.clubs[record.clubId]);
  const competitionIds = new Set(state.competitions.map((competition) => competition.id));
  const invalidCompetitions = history.filter((record) => record.competitionId && !competitionIds.has(record.competitionId));
  const seasonSet = new Set(["2026/27", "2027/28", "2028/29"]);
  const invalidSeasons = history.filter((record) => !seasonSet.has(record.season));
  const impossibleMembership = Object.values(state.clubs).filter((club) => !state.leagues[club.leagueId]);
  const duplicateFixtures = duplicate(fixtureIds(state));
  if (registrationDuplicates.length === 0) pass("Registration invariant", "Registration keys are unique across three seasons.", `registrations=${registrations.length}; duplicates=0`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations"); else issue("HIGH", "Registration invariant", "Duplicate registration keys remain.", registrationDuplicates.join(","), "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "State contamination across seasons.", "Deduplicate registration persistence.", "Yes.");
  if (historyDuplicates.length === 0) pass("Historical key invariant", "Historical logical keys are unique.", `records=${history.length}; duplicates=0`, "src/state/world-history.ts", "upsertUnique"); else issue("HIGH", "Historical key invariant", "Duplicate historical keys remain.", historyDuplicates.join(","), "src/state/world-history.ts", "upsertUnique", "History is not stable across repeated completion.", "Deduplicate historical persistence.", "Yes.");
  if (invalidClubs.length === 0 && invalidCompetitions.length === 0 && invalidSeasons.length === 0 && impossibleMembership.length === 0 && duplicateFixtures.length === 0) pass("State invariants", "Historical references, seasons, division membership, and fixture IDs are valid.", "invalid clubs=0; invalid competitions=0; invalid seasons=0; impossible membership=0; duplicate fixture IDs=0", "src/state/types.ts", "GameState"); else issue("CRITICAL", "State invariants", "At least one cross-season state invariant failed.", `clubs=${invalidClubs.length}; competitions=${invalidCompetitions.length}; seasons=${invalidSeasons.length}; membership=${impossibleMembership.length}; fixtures=${duplicateFixtures.length}`, "src/state/world-history.ts", "historical persistence", "Historical or competition state is corrupted.", "Repair the specific invariant before proceeding.", "Potentially.");
  const unlinkedCompetitionRecords = history.filter((record) => ["league", "cup", "european"].includes(record.kind) && !record.competitionId);
  if (unlinkedCompetitionRecords.length === 0) pass("Historical competition references", "All competition history records carry explicit competition references.", "unlinked competition records=0", "src/state/world-history.ts", "recordClubHistory"); else issue("MEDIUM", "Historical competition references", "Competition history records omit explicit competitionId, so their competition reference cannot be directly validated.", `unlinked competition records=${unlinkedCompetitionRecords.length}`, "src/state/types.ts", "HistoricalClubRecord", "Historical records rely on title/context instead of an authoritative competition identity.", "Add explicit competition IDs to competition history records with migration coverage.", "Yes; persisted record shape changes.");
}

console.log("STEP 4C: MULTI-SEASON COMPETITION & HISTORICAL PERSISTENCE AUDIT\n");
const first = runThreeSeasons("step-4c-seed");
const second = runThreeSeasons("step-4c-seed");
const different = runThreeSeasons("step-4c-different-seed");
assert(first.seasons.length === 3 && second.seasons.length === 3 && different.seasons.length === 3, "three seasons required");

auditState(first.state);
const sameSeed = JSON.stringify(first.seasons) === JSON.stringify(second.seasons) && fingerprint(first.state) === fingerprint(second.state);
const differentSeed = JSON.stringify(first.seasons) !== JSON.stringify(different.seasons) || fingerprint(first.state) !== fingerprint(different.state);
if (sameSeed) pass("Same-seed determinism", "Three-season results, registrations, winners, history, and final state fingerprint are identical for the same seed.", `final fingerprint length=${fingerprint(first.state).length}`, "scripts/step-4c-multi-season-history-audit.ts", "runThreeSeasons"); else issue("CRITICAL", "Same-seed determinism", "Same seed produced different three-season state.", "season results or final fingerprint differed", "src/state/world-history.ts", "recordClubHistory", "Reproducible saves and historical state are broken.", "Block release and isolate nondeterminism.", "Direct failure.");
if (differentSeed) pass("Different-seed divergence", "A different seed diverged in the bounded season results or final state.", `seed A final=${fingerprint(first.state).length}; seed B final=${fingerprint(different.state).length}`, "scripts/step-4c-multi-season-history-audit.ts", "runThreeSeasons"); else issue("LOW", "Different-seed divergence", "Different seed did not diverge in the bounded scenario.", "season results and final fingerprint matched", "scripts/step-4c-multi-season-history-audit.ts", "runThreeSeasons", "Seed sensitivity was not demonstrated by this scenario.", "Use a broader bounded outcome matrix before relying on this test as RNG coverage.", "No direct failure.");

console.log("\nSEASON RESULTS");
for (const result of first.seasons) console.log(`${result.season}: league=${result.leagueChampion}; cup=${result.cupWinner}; europe=${result.europeanWinner}; promoted=${result.promoted.join(",")}; relegated=${result.relegated.join(",")}; registrations=${result.registrations.length}; history=${result.historyCount}`);
console.log("\nSUMMARY");
for (const severity of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "PASS"] as Severity[]) console.log(`${severity}: ${findings.filter((finding) => finding.severity === severity).length}`);
console.log("\nFINDINGS_JSON");
console.log(JSON.stringify(findings, null, 2));
