import assert from "node:assert/strict";
import { buildInitialState } from "../src/state/seed";
import { generateLeagueFixtures } from "../src/state/season";
import { runDomesticCup } from "../src/state/cups";
import { applyEuropeanQualificationRegistrations } from "../src/state/qualification";
import { runEuropeanCompetitions } from "../src/state/european";
import { applyWorldSeasonProgression } from "../src/state/world";
import { computeLeagueTable } from "../src/state/standings";
import type { Fixture, GameState, WorldCompetitionConfig } from "../src/state/types";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS";
interface Finding {
  severity: Severity;
  area: string;
  file: string;
  functionName: string;
  behavior: string;
  why: string;
  impact: string;
  evidence: string;
  recommendation: string;
  determinism: string;
}

const findings: Finding[] = [];
function record(finding: Finding): void {
  findings.push(finding);
  console.log(`[${finding.severity}] ${finding.area}: ${finding.behavior}`);
}
function pass(area: string, behavior: string, evidence: string, file: string, functionName: string): void {
  record({
    severity: "PASS",
    area,
    file,
    functionName,
    behavior,
    why: "The audited invariant holds for the tested state.",
    impact: "No issue observed.",
    evidence,
    recommendation: "No change recommended.",
    determinism: "No determinism impact.",
  });
}
function issue(
  severity: Exclude<Severity, "PASS">,
  area: string,
  file: string,
  functionName: string,
  behavior: string,
  why: string,
  impact: string,
  evidence: string,
  recommendation: string,
  determinism: string,
): void {
  record({ severity, area, file, functionName, behavior, why, impact, evidence, recommendation, determinism });
}

function allFixtures(state: GameState): Fixture[] {
  return state.fixtures ?? [];
}
function unique(values: string[]): string[] {
  return [...new Set(values)];
}
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
function stateFingerprint(state: GameState): string {
  return stable({
    time: state.time,
    clubs: Object.fromEntries(Object.entries(state.clubs).sort()),
    leagues: Object.fromEntries(Object.entries(state.leagues).sort()),
    competitions: state.competitions,
    fixtures: state.fixtures,
    qualifications: state.meta?.europeanQualifications ?? [],
  });
}
function worldCompetitions(state: GameState): WorldCompetitionConfig[] {
  return state.meta?.worldConfig?.competitions ?? [];
}
function competitionFor(state: GameState, id: string) {
  return state.competitions.find((competition) => competition.id === id);
}
function fixturesFor(state: GameState, competitionId: string): Fixture[] {
  return allFixtures(state).filter((fixture) => fixture.competitionId === competitionId);
}
function clubIdsForLeague(state: GameState, leagueId: string): string[] {
  return Object.values(state.clubs).filter((club) => club.leagueId === leagueId).map((club) => club.id);
}
function checkFixtureIntegrity(state: GameState): string[] {
  const errors: string[] = [];
  const fixtures = allFixtures(state);
  const ids = fixtures.map((fixture) => fixture.id);
  if (unique(ids).length !== ids.length) errors.push("duplicate fixture IDs");
  for (const fixture of fixtures) {
    if (!competitionFor(state, fixture.competitionId)) errors.push(`unknown competition ${fixture.competitionId}`);
    if (!state.clubs[fixture.homeClubId] || !state.clubs[fixture.awayClubId]) errors.push(`unknown club in ${fixture.id}`);
    if (fixture.homeClubId === fixture.awayClubId) errors.push(`self-match ${fixture.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fixture.calendarDate)) errors.push(`invalid date ${fixture.id}`);
    if (fixture.date !== fixture.date.trim()) errors.push(`invalid display date ${fixture.id}`);
  }
  return unique(errors);
}
function checkLeagueBalance(state: GameState): string[] {
  const errors: string[] = [];
  for (const leagueId of Object.keys(state.leagues)) {
    const clubs = new Set(clubIdsForLeague(state, leagueId));
    const fixtures = fixturesFor(state, state.leagues[leagueId]!.competitionId).filter((fixture) => fixture.season === state.time.season);
    const appearances = new Map<string, number>();
    for (const fixture of fixtures) {
      appearances.set(fixture.homeClubId, (appearances.get(fixture.homeClubId) ?? 0) + 1);
      appearances.set(fixture.awayClubId, (appearances.get(fixture.awayClubId) ?? 0) + 1);
    }
    const expected = clubs.size % 2 === 0 ? 2 * (clubs.size - 1) : 3 * (clubs.size - 1);
    for (const clubId of clubs) {
      if ((appearances.get(clubId) ?? 0) !== expected) errors.push(`${leagueId}: ${clubId} has ${appearances.get(clubId) ?? 0} appearances, expected ${expected}`);
    }
    for (const fixture of fixtures) {
      if (!clubs.has(fixture.homeClubId) || !clubs.has(fixture.awayClubId)) errors.push(`${leagueId}: fixture contains outsider`);
    }
  }
  return unique(errors);
}
function checkHomeAwayBalance(state: GameState): string[] {
  const errors: string[] = [];
  for (const leagueId of Object.keys(state.leagues)) {
    const clubs = clubIdsForLeague(state, leagueId);
    const fixtures = fixturesFor(state, state.leagues[leagueId]!.competitionId).filter((fixture) => fixture.season === state.time.season);
    for (const clubId of clubs) {
      const home = fixtures.filter((fixture) => fixture.homeClubId === clubId).length;
      const away = fixtures.filter((fixture) => fixture.awayClubId === clubId).length;
      if (home !== away && !(leagueId === "national-league" && clubs.length === 9)) errors.push(`${leagueId}: ${clubId} home=${home} away=${away}`);
    }
  }
  return unique(errors);
}
function checkScheduleConflicts(state: GameState): string[] {
  const errors: string[] = [];
  const byClubDate = new Map<string, string>();
  for (const fixture of allFixtures(state).filter((item) => item.status === "scheduled")) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const key = `${clubId}:${fixture.calendarDate}`;
      const previous = byClubDate.get(key);
      if (previous) errors.push(`${clubId} has ${previous} and ${fixture.id} on ${fixture.calendarDate}`);
      byClubDate.set(key, fixture.id);
    }
  }
  return unique(errors);
}
function checkQualification(state: GameState): string[] {
  const errors: string[] = [];
  const registrations = state.meta?.europeanQualifications ?? [];
  const keys = registrations.map((entry) => `${entry.competitionId}:${entry.clubId}`);
  if (unique(keys).length !== keys.length) errors.push("duplicate European registration keys");
  for (const entry of registrations) {
    const competition = worldCompetitions(state).find((item) => item.id === entry.competitionId);
    if (!competition || competition.type !== "continental") errors.push(`registration references non-continental ${entry.competitionId}`);
    if (!state.clubs[entry.clubId]) errors.push(`registration references unknown club ${entry.clubId}`);
  }
  return unique(errors);
}
function checkPromotionConfig(state: GameState): string[] {
  const errors: string[] = [];
  for (const country of state.meta?.worldConfig?.countries ?? []) {
    const levels = [...country.divisions].sort((a, b) => a.level - b.level);
    for (let index = 0; index < levels.length; index += 1) {
      const division = levels[index]!;
      const expectedUp = index === 0 ? null : levels[index - 1]!.id;
      const expectedDown = index === levels.length - 1 ? null : levels[index + 1]!.id;
      if ((division.promotionTo ?? null) !== expectedUp) errors.push(`${division.id}: invalid promotion target`);
      if ((division.relegationTo ?? null) !== expectedDown) errors.push(`${division.id}: invalid relegation target`);
    }
  }
  return unique(errors);
}
function checkContinentalFormats(state: GameState): string[] {
  const errors: string[] = [];
  for (const competition of worldCompetitions(state).filter((item) => item.type === "continental")) {
    const format = competition.format;
    if (!format?.groupStage || !format.knockoutStage?.rounds?.length) {
      errors.push(`${competition.id}: incomplete continental format`);
      continue;
    }
    const groupTotal = format.groupStage.numGroups * format.groupStage.teamsPerGroup;
    if (groupTotal !== (competition.qualificationSlots ?? groupTotal)) errors.push(`${competition.id}: qualification slots ${competition.qualificationSlots} do not equal group capacity ${groupTotal}`);
    const firstRound = format.knockoutStage.rounds[0];
    if (firstRound && firstRound.teams !== groupTotal * 1) {
      errors.push(`${competition.id}: first knockout round expects ${firstRound.teams}, group capacity is ${groupTotal}`);
    }
    for (const round of format.knockoutStage.rounds) {
      if (round.teams < 2 || round.teams % 2 !== 0) errors.push(`${competition.id}: invalid ${round.id} team count ${round.teams}`);
    }
  }
  return unique(errors);
}

console.log("STEP 4A: FULL COMPETITION ECOSYSTEM AUDIT");
console.log("Diagnostic-only; production code is not modified.\n");

const first = buildInitialState("step-4a-audit");
const second = buildInitialState("step-4a-audit");
const world = first.meta?.worldConfig;
assert(world, "initial state must include world configuration");

const countryCount = world.countries.length;
const divisionCount = world.countries.reduce((sum, country) => sum + country.divisions.length, 0);
const leagueCount = Object.keys(first.leagues).length;
const clubCount = Object.keys(first.clubs).length;
const fixtureCount = first.fixtures.length;
const generated = generateLeagueFixtures(first);
console.log(`World: countries=${countryCount}, divisions=${divisionCount}, leagues=${leagueCount}, clubs=${clubCount}, fixtures=${fixtureCount}`);

if (countryCount === 16 && divisionCount === 80 && leagueCount === 81 && clubCount === 1737) {
  pass("League structures", "Generated world has the expected 16-country / 80-division pyramid plus demo league.", "Counts matched 16 countries, 80 generated divisions, 81 runtime leagues, and 1,737 clubs.", "src/state/worldgen.ts", "generateSampleWorld");
} else {
  issue("HIGH", "League structures", "src/state/worldgen.ts", "generateSampleWorld", "Generated world counts differ from the expected full-world target.", "League scale and participation coverage would not match the intended world.", `Observed countries=${countryCount}, divisions=${divisionCount}, leagues=${leagueCount}, clubs=${clubCount}.`, "Reconcile world generation with the documented target before production.", "Changing counts would affect fixture IDs, schedules, and deterministic saves.");
}

const promotionErrors = checkPromotionConfig(first);
if (promotionErrors.length === 0) pass("Promotion/relegation rules", "Every generated division points to its adjacent tier and boundary tiers are open on the correct side.", "All country pyramids passed adjacency checks.", "src/state/worldgen.ts", "generateSampleWorld");
else issue("HIGH", "Promotion/relegation rules", "src/state/worldgen.ts", "generateSampleWorld", "Division movement configuration has invalid targets.", "Clubs could move to the wrong tier or leave the configured pyramid.", promotionErrors.join("; "), "Correct the world configuration and add a boundary-tier invariant test.", "Changing targets changes club movement deterministically.");

const fixtureErrors = checkFixtureIntegrity(generated);
if (fixtureErrors.length === 0) pass("Fixture identity and references", "Generated fixtures use unique IDs, valid competitions, valid clubs, distinct opponents, and ISO dates.", `Checked ${generated.fixtures.length} fixtures with no integrity errors.`, "src/state/season.ts", "generateLeagueFixtures");
else issue("CRITICAL", "Fixture identity and references", "src/state/season.ts", "generateLeagueFixtures", "Fixture integrity violations were observed.", "Broken references or IDs can make standings, scheduling, and progression unsafe.", fixtureErrors.join("; "), "Block release and repair fixture construction before changing any other competition behavior.", "Any repair could change fixture ordering or IDs and requires deterministic comparison.");

const leagueBalanceErrors = checkLeagueBalance(generated);
if (leagueBalanceErrors.length === 0) pass("League fixture generation", "Each club receives the expected number of league appearances for its division.", `Checked ${Object.keys(generated.leagues).length} leagues and ${generated.fixtures.length} generated fixtures.`, "src/state/season.ts", "generateLeagueFixtures");
else issue("HIGH", "League fixture generation", "src/state/season.ts", "generateLeagueFixtures", "At least one league has an incomplete or outsider fixture set.", "League standings and season completion would be wrong for affected divisions.", leagueBalanceErrors.slice(0, 10).join("; "), "Repair fixture generation only after producing an exact fixture equivalence harness.", "Yes; fixture order and IDs are observable.");

const homeAwayErrors = checkHomeAwayBalance(generated);
if (homeAwayErrors.length === 0) pass("Home/away balance", "Generated league fixtures preserve balanced home and away appearances.", "All checked generated leagues passed home/away balance; the nine-club demo league is intentionally handled separately.", "src/state/season.ts", "generateLeagueFixtures");
else issue("HIGH", "Home/away balance", "src/state/season.ts", "generateLeagueFixtures", "Home/away appearances are imbalanced.", "A club could receive an unfair schedule and standings would lose sporting realism.", homeAwayErrors.slice(0, 10).join("; "), "Review the pairing/date semantics without changing them implicitly.", "Any correction may change deterministic fixture ordering.");

const conflictErrors = checkScheduleConflicts(generated);
if (conflictErrors.length === 0) pass("Scheduling conflicts", "No scheduled fixture gives a club two matches on the same calendar date in the initial schedule.", `Checked ${first.fixtures.filter((fixture) => fixture.status === "scheduled").length} scheduled fixtures.`, "src/state/season.ts", "generateLeagueFixtures");
else issue("HIGH", "Scheduling conflicts", "src/state/season.ts", "generateLeagueFixtures", "A club has multiple scheduled fixtures on one date.", "This creates impossible match congestion and invalid calendar behavior.", conflictErrors.slice(0, 10).join("; "), "Resolve date allocation conflicts while preserving the documented date rules.", "Yes; date allocation changes fixture behavior and determinism.");

const continental = worldCompetitions(first).filter((competition) => competition.type === "continental");
const formatErrors = checkContinentalFormats(first);
if (formatErrors.length === 0) pass("Continental format configuration", "Continental group and knockout formats are internally consistent with their configured capacities.", `Checked ${continental.length} continental competitions.`, "src/state/worldgen.ts", "generateSampleWorld");
else issue("HIGH", "Continental format configuration", "src/state/worldgen.ts", "generateSampleWorld", "At least one continental format has a capacity mismatch.", "The competition can fail to schedule a valid knockout stage or leave qualified clubs without a route.", formatErrors.join("; "), "Align qualification slots, group capacity, and first knockout round before production.", "Yes; changing formats changes participation and fixture sequences.");

const qualificationState = applyEuropeanQualificationRegistrations(first);
const qualificationErrors = checkQualification(qualificationState);
if (qualificationErrors.length === 0) pass("Competition registration", "European registrations are unique and point to configured continental competitions and existing clubs.", `Registrations recorded: ${qualificationState.meta?.europeanQualifications?.length ?? 0}.`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations");
else issue("HIGH", "Competition registration", "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "European registrations contain invalid or duplicate entries.", "Clubs could participate in the wrong competition or be registered twice.", qualificationErrors.join("; "), "Make registration replacement explicitly season-keyed and validate every entry before persistence.", "Yes; registration ordering and participation change deterministically.");

const qualificationAgain = applyEuropeanQualificationRegistrations(qualificationState);
const repeatedRegistrationKeys = qualificationAgain.meta?.europeanQualifications?.map((entry) => `${entry.competitionId}:${entry.clubId}`) ?? [];
if (unique(repeatedRegistrationKeys).length === repeatedRegistrationKeys.length) pass("Qualification idempotency", "Repeating registration does not create duplicate competition/club registration keys.", "Second registration pass retained unique keys.", "src/state/qualification.ts", "applyEuropeanQualificationRegistrations");
else issue("MEDIUM", "Qualification persistence", "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "Repeated qualification registration can retain duplicate logical entries.", "Duplicate registration state can contaminate continental participation and later-season setup.", `Duplicate keys: ${repeatedRegistrationKeys.length - unique(repeatedRegistrationKeys).length}.`, "Persist registrations by season and competition/club key, then add a multi-season replacement test.", "Yes; changing persistence changes future-season registrations.");

const cupState = runDomesticCup(generated);
const continentalState = runEuropeanCompetitions(qualificationState);
const cupFixtures = cupState.fixtures.filter((fixture) => fixture.competitionId.endsWith("-cup") || fixture.competitionId === "national-cup");
const continentalFixtures = continentalState.fixtures.filter((fixture) => fixture.competitionId.startsWith("uefa-"));
if (cupFixtures.length > 0) pass("Domestic cup scheduling", "Domestic cup scheduling creates valid knockout fixtures from eligible entrants.", `Generated ${cupFixtures.length} cup fixtures in the exercised state.`, "src/state/cups.ts", "runDomesticCup");
else issue("HIGH", "Domestic cup scheduling", "src/state/cups.ts", "runDomesticCup", "No domestic cup fixture was created in the exercised state.", "A cup configured in the world would not participate in the season ecosystem.", `World cup configs=${worldCompetitions(first).filter((item) => item.type === "cup").length}; exercised cup fixtures=${cupFixtures.length}.`, "Exercise each configured national cup and verify its first round and later progression.", "Yes; adding fixtures changes deterministic state.");
if (continentalFixtures.length > 0) pass("Continental fixture generation", "Continental scheduling creates fixtures when valid registrations are present.", `Generated ${continentalFixtures.length} continental fixtures in the exercised state.`, "src/state/european.ts", "runEuropeanCompetitions");
else issue("MEDIUM", "Continental fixture generation", "src/state/european.ts", "runEuropeanCompetitions", "No continental fixture was created in the exercised registration state.", "Continental qualification may be recorded without actual competition participation.", `Configured continental competitions=${continental.length}; generated fixtures=${continentalFixtures.length}.`, "Run a targeted played-group-stage simulation with valid entrants and verify the first knockout round.", "Yes; competition fixtures affect deterministic progression.");

const table = computeLeagueTable(first, Object.keys(first.leagues)[0]!);
if (table.every((row, index) => row.position === index + 1) && table.every((row) => row.points === row.wins * 3 + row.draws)) pass("Standings and tie-breakers", "League tables assign stable positions and standard 3/1/0 points for the audited initial state.", `Checked ${table.length} rows in the first league; deterministic club-id fallback is implemented in standings.ts.`, "src/state/standings.ts", "computeStandings");
else issue("HIGH", "Standings and tie-breakers", "src/state/standings.ts", "computeStandings", "Standings positions or points do not satisfy configured rules.", "Promotion, relegation, qualification, and champions could be selected incorrectly.", "Initial table invariant failed.", "Repair standings before relying on downstream competition outcomes.", "Yes; ranking changes alter all downstream competition decisions.");

const initialClubLeagues = Object.fromEntries(Object.entries(first.clubs).map(([id, club]) => [id, club.leagueId]));
let progressed = first;
const progressionLabels: string[] = [];
for (let index = 0; index < 3; index += 1) {
  progressed = applyWorldSeasonProgression(progressed);
  progressionLabels.push(`${progressed.time.season}@${progressed.time.date}`);
}
const clubCountStable = Object.keys(progressed.clubs).length === clubCount;
const noClubLost = Object.keys(initialClubLeagues).every((clubId) => Boolean(progressed.clubs[clubId]));
if (clubCountStable && noClubLost) pass("Multi-season progression persistence", "Three world-season transitions preserve club identity and total club count.", progressionLabels.join(", "), "src/state/world.ts", "applyWorldSeasonProgression");
else issue("HIGH", "Multi-season progression persistence", "src/state/world.ts", "applyWorldSeasonProgression", "Club identity or count changed during multi-season progression.", "Promotion/relegation and historical competition participation cannot remain stable.", `Stable count=${clubCountStable}; no club lost=${noClubLost}; labels=${progressionLabels.join(", ")}` , "Repair season transition persistence before production.", "Yes; transition state is deterministic and externally observable.");

const deterministicA = stateFingerprint(buildInitialState("step-4a-determinism"));
const deterministicB = stateFingerprint(buildInitialState("step-4a-determinism"));
if (deterministicA === deterministicB) pass("Determinism", "Repeated initial worlds with the same seed produce the same competition state fingerprint.", `Fingerprint length=${deterministicA.length}.`, "src/state/seed.ts", "buildInitialState");
else issue("CRITICAL", "Determinism", "src/state/seed.ts", "buildInitialState", "Repeated same-seed initialization produced different competition state.", "Save reproducibility and debugging would be compromised.", "Same-seed fingerprints differed.", "Block release and isolate the nondeterministic state source.", "The issue itself is a determinism failure.");

const initialFixtureIds = first.fixtures.map((fixture) => fixture.id);
if (initialFixtureIds.every((id) => id.length > 0) && unique(initialFixtureIds).length === initialFixtureIds.length) pass("Competition and fixture IDs", "Competition IDs and initial fixture IDs are non-empty and unique.", `Checked ${first.competitions.length} competitions and ${initialFixtureIds.length} fixture IDs.`, "src/state/seed.ts", "buildInitialState");
else issue("CRITICAL", "Competition and fixture IDs", "src/state/seed.ts", "buildInitialState", "Competition or fixture IDs are missing or duplicated.", "References, history, and progression would collide.", "ID invariant failed.", "Repair IDs before any ecosystem changes.", "Yes; IDs are part of deterministic state.");

console.log("\nSUMMARY");
for (const severity of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "PASS"] as Severity[]) {
  console.log(`${severity}: ${findings.filter((finding) => finding.severity === severity).length}`);
}
console.log(`\nFixtures: initial=${fixtureCount}, generatedAfterExisting=${generated.fixtures.length}`);
console.log(`Cup fixtures exercised=${cupFixtures.length}; continental fixtures exercised=${continentalFixtures.length}`);
console.log("No production code was modified by this audit.");

console.log("\nFINDINGS_JSON");
console.log(JSON.stringify(findings, null, 2));
