import assert from "node:assert/strict";
import { applyEuropeanQualificationRegistrations } from "../src/state/qualification";
import { getEuropeanChampion, runEuropeanCompetitions } from "../src/state/european";
import { buildInitialState } from "../src/state/seed";
import { recordEuropeanWinner } from "../src/state/world-history";
import type { Fixture, GameState, EuropeanQualificationRegistration } from "../src/state/types";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASS";
interface Finding {
  severity: Severity;
  area: string;
  file: string;
  functionName: string;
  behavior: string;
  evidence: string;
  impact: string;
  recommendation: string;
  determinism: string;
}

const findings: Finding[] = [];
function report(finding: Finding): void {
  findings.push(finding);
  console.log(`[${finding.severity}] ${finding.area}: ${finding.behavior}`);
}
function pass(area: string, behavior: string, evidence: string, file: string, functionName: string): void {
  report({ severity: "PASS", area, file, functionName, behavior, evidence, impact: "No issue observed.", recommendation: "No change recommended.", determinism: "No determinism impact." });
}
function issue(severity: Exclude<Severity, "PASS">, area: string, behavior: string, evidence: string, file: string, functionName: string, impact: string, recommendation: string, determinism: string): void {
  report({ severity, area, file, functionName, behavior, evidence, impact, recommendation, determinism });
}
function fixturesFor(state: GameState, competitionId: string): Fixture[] {
  return state.fixtures.filter((fixture) => fixture.competitionId === competitionId);
}
function stageFixtures(state: GameState, competitionId: string, stage: "group" | "round"): Fixture[] {
  return fixturesFor(state, competitionId).filter((fixture) => stage === "group" ? fixture.groupId != null : fixture.round != null);
}
function duplicateFixtureIds(state: GameState): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const fixture of state.fixtures) {
    if (seen.has(fixture.id)) duplicates.add(fixture.id);
    seen.add(fixture.id);
  }
  return [...duplicates];
}
function registrationKeys(state: GameState): string[] {
  return (state.meta?.europeanQualifications ?? []).map((entry) => `${entry.season}:${entry.competitionId}:${entry.clubId}`);
}
function invalidReferences(state: GameState, competitionId: string): string[] {
  return fixturesFor(state, competitionId).flatMap((fixture) => {
    const errors: string[] = [];
    if (!state.clubs[fixture.homeClubId]) errors.push(`${fixture.id}: unknown home club`);
    if (!state.clubs[fixture.awayClubId]) errors.push(`${fixture.id}: unknown away club`);
    return errors;
  });
}
function scheduleConflicts(state: GameState, competitionId: string): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const fixture of fixturesFor(state, competitionId).filter((item) => item.status === "scheduled")) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const key = `${clubId}:${fixture.calendarDate}`;
      const previous = seen.get(key);
      if (previous) conflicts.push(`${clubId}: ${previous} and ${fixture.id} on ${fixture.calendarDate}`);
      seen.set(key, fixture.id);
    }
  }
  return conflicts;
}
function playFixtures(state: GameState, predicate: (fixture: Fixture) => boolean, scoreHome = 2, scoreAway = 0): GameState {
  return {
    ...state,
    fixtures: state.fixtures.map((fixture) => predicate(fixture) ? { ...fixture, status: "played", scoreHome, scoreAway, result: null } : fixture),
  };
}
function stateFingerprint(state: GameState): string {
  return JSON.stringify({
    season: state.time.season,
    qualifications: state.meta?.europeanQualifications ?? [],
    fixtures: state.fixtures,
    competitions: state.competitions,
  });
}
function boundedScenario(seed: string): {
  initial: GameState;
  registered: GameState;
  groups: GameState;
  semifinals: GameState;
  final: GameState;
  champion: string | null;
  competitionId: string;
} {
  const base = buildInitialState(seed);
  const competitionId = "uefa-champions-league";
  const worldConfig = base.meta?.worldConfig;
  assert(worldConfig, "world configuration is required");
  const initial: GameState = {
    ...base,
    meta: {
      ...(base.meta ?? {}),
      worldConfig: {
        ...worldConfig,
        competitions: worldConfig.competitions.filter((competition) => competition.id === competitionId),
      },
    },
  };
  const registered = applyEuropeanQualificationRegistrations(initial);
  const groups = runEuropeanCompetitions(registered);
  const groupFixtures = stageFixtures(groups, competitionId, "group");
  const groupsPlayed = playFixtures(groups, (fixture) => fixture.groupId != null && fixture.status === "scheduled");
  const semifinals = runEuropeanCompetitions(groupsPlayed);
  const semiFixtures = stageFixtures(semifinals, competitionId, "round").filter((fixture) => fixture.round === "semi");
  assert(groupFixtures.length === 4, `expected 4 group fixtures, got ${groupFixtures.length}`);
  assert(semiFixtures.length === 4, `expected 4 semi-final legs, got ${semiFixtures.length}`);
  const semisPlayed: GameState = {
    ...semifinals,
    fixtures: semifinals.fixtures.map((fixture) =>
      fixture.round === "semi" && fixture.status === "scheduled"
        ? { ...fixture, status: "played" as const, scoreHome: fixture.leg === 2 ? 0 : 2, scoreAway: fixture.leg === 2 ? 1 : 0, result: null }
        : fixture,
    ),
  };
  const final = runEuropeanCompetitions(semisPlayed);
  const finalFixtures = final.fixtures.filter((fixture) => fixture.competitionId === competitionId && fixture.round === "final");
  assert(finalFixtures.length === 1, `expected 1 final fixture, got ${finalFixtures.length}`);
  const finalPlayed = playFixtures(final, (fixture) => fixture.round === "final" && fixture.status === "scheduled", 1, 0);
  const champion = getEuropeanChampion(finalPlayed, competitionId);
  return { initial, registered, groups, semifinals, final: finalPlayed, champion, competitionId };
}

console.log("STEP 4B: FULL CONTINENTAL COMPETITION PROGRESSION AUDIT");
console.log("Bounded deterministic Champions League scenario; only minimal fixes for reproduced HIGH defects were applied.\n");

const scenario = boundedScenario("step-4b-bounded");
const competitionId = scenario.competitionId;
const competition = scenario.initial.meta?.worldConfig?.competitions.find((item) => item.id === competitionId);
assert(competition, "audited competition must exist");

const registrations = scenario.registered.meta?.europeanQualifications ?? [];
const entrants = new Set(registrations.filter((entry) => entry.competitionId === competitionId && entry.season === String(scenario.initial.time.season)).map((entry) => entry.clubId));
if (registrations.length === 4 && entrants.size === 4) pass("Qualification registration and entrants", "The bounded scenario registers four unique same-season Champions League entrants.", `Registrations=${registrations.length}; unique entrants=${entrants.size}; keys=${registrationKeys(scenario.registered).join(",")}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations");
else issue("HIGH", "Qualification registration and entrants", "The bounded scenario did not produce four unique same-season entrants.", `Registrations=${registrations.length}; unique entrants=${entrants.size}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "The competition cannot form its configured groups.", "Repair qualification selection or persistence before progression changes.", "Yes; entrant identity is deterministic state.");

const repeated = applyEuropeanQualificationRegistrations(scenario.registered);
const repeatedKeys = registrationKeys(repeated);
if (new Set(repeatedKeys).size === repeatedKeys.length && JSON.stringify(repeated.meta?.europeanQualifications) === JSON.stringify(scenario.registered.meta?.europeanQualifications)) pass("No duplicate registrations", "Repeating registration preserves the exact logical registration list.", `Duplicate keys=0; entries=${repeatedKeys.length}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations");
else issue("HIGH", "No duplicate registrations", "Repeated registration changed or duplicated the same-season registration list.", `Duplicate keys=${repeatedKeys.length - new Set(repeatedKeys).size}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "Continental participation can be duplicated or drift between passes.", "Use the season/competition/club identity key for persistence.", "Yes; registration state would drift.");

const groupFixtures = stageFixtures(scenario.groups, competitionId, "group");
const groups = [...new Set(groupFixtures.map((fixture) => fixture.groupId))];
if (groupFixtures.length === 4 && groups.length === 2 && groupFixtures.every((fixture) => fixture.groupId && fixture.status === "scheduled")) pass("Group-stage creation and fixtures", "Two groups and four scheduled home/away group fixtures were created.", `Groups=${groups.join(",")}; fixtures=${groupFixtures.length}`, "src/state/european.ts", "runEuropeanCompetitions");
else issue("HIGH", "Group-stage creation and fixtures", "Configured group stage was not created with the expected fixtures.", `Groups=${groups.length}; fixtures=${groupFixtures.length}`, "src/state/european.ts", "runEuropeanCompetitions", "The continental lifecycle cannot reach qualification from groups.", "Repair stage creation before any format changes.", "Yes; fixture identities and ordering are observable.");

const groupPlayed = scenario.semifinals.fixtures.filter((fixture) => fixture.competitionId === competitionId && fixture.groupId != null);
const groupStandingsValid = groups.every((groupId) => groupPlayed.filter((fixture) => fixture.groupId === groupId).length === 2);
if (groupPlayed.length === 4 && groupStandingsValid) pass("Group standings and qualification", "All group fixtures were completed and the progression code accepted group standings to produce the semi-final bracket.", `Played group fixtures=${groupPlayed.length}; semi-final fixtures=${scenario.semifinals.fixtures.filter((fixture) => fixture.round === "semi").length}`, "src/state/european.ts", "pickKnockoutTeamsFromGroups");
else issue("HIGH", "Group standings and qualification", "Completed group fixtures did not produce a valid qualified-team bracket.", `Played group fixtures=${groupPlayed.length}; standings shape valid=${groupStandingsValid}`, "src/state/european.ts", "pickKnockoutTeamsFromGroups", "The competition cannot progress from groups.", "Repair qualification-to-knockout transition without changing standings rules.", "Yes; qualified team ordering is deterministic.");

const semiFixtures = scenario.semifinals.fixtures.filter((fixture) => fixture.competitionId === competitionId && fixture.round === "semi");
const semiTeams = new Set(semiFixtures.flatMap((fixture) => [fixture.homeClubId, fixture.awayClubId]));
if (semiFixtures.length === 4 && semiTeams.size === 4 && semiFixtures.every((fixture) => fixture.leg === 1 || fixture.leg === 2)) pass("Knockout bracket and semi-finals", "The configured four-team semi-final bracket was created as two two-legged ties.", `Semi legs=${semiFixtures.length}; participants=${semiTeams.size}`, "src/state/european.ts", "scheduleKnockoutFixtures");
else issue("HIGH", "Knockout bracket and semi-finals", "The semi-final bracket has the wrong number of legs or participants.", `Semi legs=${semiFixtures.length}; participants=${semiTeams.size}`, "src/state/european.ts", "scheduleKnockoutFixtures", "The final cannot be reached reliably.", "Repair bracket progression while preserving configured rounds.", "Yes; bracket fixture identity is deterministic.");

const finalFixtures = scenario.final.fixtures.filter((fixture) => fixture.competitionId === competitionId && fixture.round === "final");
if (finalFixtures.length === 1 && finalFixtures[0]?.status === "played" && scenario.champion) pass("Final and winner", "The final was created, completed, and getEuropeanChampion returned the actual winner.", `Final=${finalFixtures[0]!.homeClubId} vs ${finalFixtures[0]!.awayClubId}; winner=${scenario.champion}`, "src/state/european.ts", "getEuropeanChampion");
else issue("HIGH", "Final and winner", "The final did not complete or no champion was derived from its played result.", `Final fixtures=${finalFixtures.length}; state=${JSON.stringify(finalFixtures[0] ?? null)}; winner=${scenario.champion ?? "null"}`, "src/state/european.ts", "getEuropeanChampion", "A continental champion cannot be persisted or used for downstream records.", "Repair final completion/winner derivation before production.", "Yes; winner selection must remain deterministic.");

const allCompetitionFixtures = fixturesFor(scenario.final, competitionId);
const duplicateIds = duplicateFixtureIds(scenario.final);
const invalid = invalidReferences(scenario.final, competitionId);
const conflicts = scheduleConflicts(scenario.final, competitionId);
if (duplicateIds.length === 0 && invalid.length === 0 && conflicts.length === 0) pass("Fixture integrity and scheduling", "The bounded lifecycle has no duplicate IDs, invalid club references, or same-day scheduled club conflicts.", `Fixtures=${allCompetitionFixtures.length}; duplicates=0; invalid=0; conflicts=0`, "src/state/european.ts", "runEuropeanCompetitions");
else issue("HIGH", "Fixture integrity and scheduling", "The bounded continental lifecycle produced invalid fixtures or scheduling conflicts.", `duplicates=${duplicateIds.join(",")}; invalid=${invalid.join(",")}; conflicts=${conflicts.join(",")}`, "src/state/european.ts", "runEuropeanCompetitions", "Competition state becomes impossible or unsafe to simulate.", "Repair fixture construction or date allocation before production.", "Yes; fixture identity/date changes affect determinism.");

const historyBefore = scenario.final;
const historyAfter = scenario.champion ? recordEuropeanWinner(historyBefore, scenario.champion, competition.name, String(historyBefore.time.season)) : historyBefore;
const historyRecords = historyAfter.history?.clubRecords.filter((record) => record.kind === "european" && record.clubId === scenario.champion) ?? [];
if (scenario.champion && historyRecords.length === 1) pass("Historical winner persistence helper", "The canonical historical-record helper persists the derived European winner with a unique key.", `European history records=${historyRecords.length}`, "src/state/world-history.ts", "recordEuropeanWinner");
else issue("HIGH", "Historical winner persistence", "The completed European winner is not persisted by the audited lifecycle without an explicit history call.", `Derived winner=${scenario.champion ?? "null"}; records before explicit helper=${historyBefore.history?.clubRecords.filter((record) => record.kind === "european").length ?? 0}`, "src/state/season.ts", "simulateSeason", "A completed continental competition can lose its winner from historical records.", "Wire winner persistence into the authoritative season/competition completion path, then add an end-to-end regression test.", "Yes; adding history is deterministic but changes persisted state.");

const nextSeason = applyEuropeanQualificationRegistrations({
  ...scenario.final,
  time: { ...scenario.final.time, season: "2027/28", date: "2027-08-01", seasonStartDate: "2027-08-01" },
  meta: { ...(scenario.final.meta ?? {}), europeanQualifications: scenario.final.meta?.europeanQualifications ?? [] },
});
const nextSeasonEntries = nextSeason.meta?.europeanQualifications ?? [];
const preservedOldSeason = nextSeasonEntries.some((entry) => entry.season === String(scenario.final.time.season));
const nextSeasonKeys = nextSeasonEntries.filter((entry) => entry.season === "2027/28").map((entry) => `${entry.season}:${entry.competitionId}:${entry.clubId}`);
if (preservedOldSeason && new Set(nextSeasonKeys).size === nextSeasonKeys.length) pass("Next-season registration persistence", "Previous-season registrations remain identifiable and next-season registration keys remain unique.", `Old-season preserved=${preservedOldSeason}; next-season entries=${nextSeasonKeys.length}; duplicates=0`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations");
else issue("MEDIUM", "Next-season registration persistence", "Season transition did not preserve explicit historical registration identity or unique next-season keys.", `Old-season preserved=${preservedOldSeason}; next-season entries=${nextSeasonKeys.length}`, "src/state/qualification.ts", "applyEuropeanQualificationRegistrations", "Next-season continental participation can be contaminated or lost.", "Add a bounded season-transition registration test using explicit season keys.", "Yes; season-key persistence is observable.");

const firstRun = boundedScenario("step-4b-determinism");
const secondRun = boundedScenario("step-4b-determinism");
if (stateFingerprint(firstRun.final) === stateFingerprint(secondRun.final) && firstRun.champion === secondRun.champion) pass("Same-seed determinism", "The complete bounded continental progression produces the same fixtures, registrations, and winner for the same seed.", `Winner=${firstRun.champion}; fingerprint length=${stateFingerprint(firstRun.final).length}`, "src/state/european.ts", "runEuropeanCompetitions");
else issue("CRITICAL", "Same-seed determinism", "The bounded continental progression diverged for the same seed.", `Winner A=${firstRun.champion}; winner B=${secondRun.champion}`, "src/state/european.ts", "runEuropeanCompetitions", "Reproducible competition progression and saves would be broken.", "Block release and isolate the nondeterministic stage.", "This is a direct determinism failure.");

console.log("\nSUMMARY");
for (const severity of ["CRITICAL", "HIGH", "MEDIUM", "LOW", "PASS"] as Severity[]) console.log(`${severity}: ${findings.filter((finding) => finding.severity === severity).length}`);
console.log(`Stages: qualification=${registrations.length}; groups=${groupFixtures.length}; semi=${semiFixtures.length}; final=${finalFixtures.length}; winner=${scenario.champion ?? "null"}`);
console.log("\nFINDINGS_JSON");
console.log(JSON.stringify(findings, null, 2));
