# Manager Legacy Step 2D.1: Full-World Runtime and Coverage Bottleneck Diagnosis

**Date:** 2026-08-20  
**Status:** DIAGNOSIS COMPLETE; FULL-WORLD RUN BLOCKED  
**Scope:** Diagnostic architecture audit only

## 1. Exact Commands

World inventory:

```text
npx tsx -e '<buildInitialState inventory script>'
```

Fixture/competition expectation calculation:

```text
npx tsx -e '<world config and fixture formula script>'
```

Smallest full-world execution:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --full-world --no-repeat
```

The full-world process was observed CPU-bound with no output and stopped after a bounded observation. No five-year or 30-year full-world run was attempted.

No production gameplay code was modified.

## 2. Startup and World Measurements

Measured from `buildInitialState("step2d-inventory")`:

| Metric | Value |
|---|---:|
| Countries | 16 |
| Configured divisions | 80 |
| Runtime leagues | 81 |
| Runtime competitions | 100 |
| Configured world competitions | 98 |
| Clubs | 1,737 |
| Players | 41,521 |
| AI-managed clubs | 1,736 |
| Initial fixtures | 108 |
| Initial fixture competitions | 1: `national-league` |

The initial state is not a fully fixture-populated world. It contains the nine-club demo league’s 108 fixtures. The generated 80-division league fixture population is created by `generateLeagueFixtures()` during season setup.

## 3. Diagnostic Checkpoints

The required full-world process was started with the existing canonical command, but the current canonical API does not expose observer callbacks for internal `simulateSeason()` phases. Therefore the following checkpoints were not emitted by the production path:

| Checkpoint | Reached? | Evidence |
|---|---|---|
| A. `buildInitialState` | Yes, established by separate inventory run | 1,737 clubs, 41,521 players, 108 fixtures |
| B. league fixture generation | Not independently observed in full-world run | Full-world output remained empty |
| C. domestic cup setup | Not independently observed | No completed full-world output |
| D. continental qualification/setup | Not independently observed | No completed full-world output |
| E. first scheduled fixture execution | Not independently observed | No completed full-world output |
| F. 1,000 matches | Not reached/observed | No result |
| G. 5,000 matches | Not reached/observed | No result |
| H. 10,000 matches | Not reached/observed | No result |
| I. 20,000 matches | Not reached/observed | No result |
| J. 30,000 matches | Not reached/observed | No result |
| K. season completion | Not reached | Process stopped after bounded observation |

This is itself a diagnostic finding: the existing public season function does not provide phase-level progress hooks, so a separate observer cannot report internal milestones without either duplicating the season loop or modifying production orchestration, both outside this task.

## 4. Fixture Reconciliation

### Expected league fixture formula

For an even-sized double round robin:

$$
F = n(n-1)
$$

The generated world contains:

- 16 Premier divisions × 20 clubs × 19 opponents = 6,080 fixtures;
- 64 lower divisions × 22 clubs × 21 opponents = 29,568 fixtures;
- generated-world total = **35,648 regular league fixtures**;
- separate nine-club demo league triple round robin = **108 fixtures**;
- combined regular-league expectation = **35,756 fixtures**.

### Per-category reconciliation

| League category | Division count | Clubs/division | Expected fixtures/division | Category expected |
|---|---:|---:|---:|---:|
| Generated Premier | 16 | 20 | 380 | 6,080 |
| Generated Championship | 16 | 22 | 462 | 7,392 |
| Generated League One | 16 | 22 | 462 | 7,392 |
| Generated League Two | 16 | 22 | 462 | 7,392 |
| Generated National | 16 | 22 | 462 | 7,392 |
| Demo national league | 1 | 9 | 108 triple-round-robin | 108 |
| **Total** | **81 runtime leagues** | | | **35,756** |

### Actual initial fixture count

```text
108
```

All 108 initial fixtures belong to `national-league`. The generated-world regular fixtures are not present until season generation.

### Actual full-world generated/played count

Not completed. The full-world one-season process remained CPU-bound before producing a report.

## 5. Runtime Pipeline and Workload

The full season path in `src/state/season.ts` is:

```text
generateLeagueFixtures
-> runDomesticCup
-> simulate all scheduled fixtures through simulateScheduledFixturesViaEngine
-> runDomesticCup again as rounds progress
-> applyEuropeanQualificationRegistrations
-> runEuropeanCompetitions
-> repeatedly simulate scheduled European fixtures
-> applyPromotionRelegation
-> generateSeasonAwards
-> applyLongTermEvolution
-> prune completed/previous-season fixtures
```

`simulateScheduledFixturesViaEngine()` selects all scheduled fixtures, maps every fixture through `simulateAiFixtureViaEngine()`, then applies each result through `applyAiFixtureResults()`.

`applyAiFixtureResults()` dispatches `RECORD_MATCH_RESULT` once per fixture. The reducer then:

- searches fixtures by ID;
- invalidates standings/club-strength caches;
- maps the entire fixtures array;
- copies the players record;
- updates players for both clubs;
- appends a MatchRecord;
- appends a MATCH_PLAYED event;
- applies consequences and memories.

This is a very large immutable-state workload at 35,756+ fixtures.

## 6. Complexity and Repeated Work Evidence

The audit found the following likely costs without changing them:

### A. Repeated immutable state copying

Per match, `RECORD_MATCH_RESULT` copies or rebuilds:

- `fixtures` through `.map()`;
- `players` through a spread and per-player updates;
- `matches` through array append;
- `events` through array append;
- nested club/player structures for match consequences.

At tens of thousands of matches this creates substantial allocation and garbage-collection pressure.

### B. Repeated fixture scans

- `simulateScheduledFixturesViaEngine()` initially scans all fixtures for scheduled entries.
- `applyAiFixtureResults()` calls the reducer once per result.
- The reducer searches `state.fixtures` by fixture ID for each match and maps the full fixture array.
- Standings recomputation scans played fixtures for each affected competition.

### C. Repeated player scans

The match adapter builds team inputs and morale/strength information from club/player data for each fixture. Full-world clubs with minimal rosters use synthetic adaptation; fully modeled clubs scan their player IDs.

### D. Repeated club/league scans

`generateLeagueFixtures()` loops through every runtime league and filters all clubs for each league. Promotion/relegation and standings also traverse configured divisions and club collections.

### E. Verification cost

Canonical metrics are not the bottleneck:

- Step 2C.1 measured metric collection at roughly 3.5-4.1 ms per season.
- Invariant checks were roughly 49-56 ms per report in representative runs.

Those are negligible beside full-season simulation time.

### F. Accidental duplicate fixture simulation

The code contains scheduled-status guards and duplicate-ID validations. The local fixture tests verify exactly-once application for selected fixtures. No evidence was found that the same retained scheduled fixture is intentionally simulated twice in the normal full-season loop.

## 7. Match Reconciliation

The intended lifecycle is:

```text
scheduled fixture
-> simulateAiFixtureViaEngine
-> RECORD_MATCH_RESULT
-> played fixture + MatchRecord + MATCH_PLAYED event
```

Intentional exceptions:

- manager-club fixtures are excluded from AI-only simulation and require the interactive path;
- postponed fixtures are skipped;
- missing/unknown fixture IDs are skipped by result application;
- configured competitions with no usable fixture format may produce no fixtures;
- quick mode intentionally does not execute football matches.

For the full-world run, eligible-versus-played reconciliation could not be completed because the run did not reach a report. The representative full path previously verified real match execution and exact-once application, but that does not establish full-world coverage.

## 8. Domestic Cup Diagnosis

The 16 generated domestic cups are present in `worldConfig` as `type: "cup"` entries. Inventory showed:

- 108 potential entrants per country;
- no `knockoutStage.rounds` format in the generated configuration for these cups.

Classification: **incomplete generated configuration / fallback-dependent behavior**, not proven intentional gameplay design.

The cup runtime has fallback logic for the seeded `national-cup`, but generated cups without round configuration cannot be proven to execute a full knockout path. No change was made.

## 9. Continental Competition Diagnosis

The two continental competitions are configured with formats:

- qualification rules;
- group stages;
- home/away settings;
- knockout rounds;
- extra time and penalties.

The connection is:

```text
season results
-> applyEuropeanQualificationRegistrations
-> europeanQualifications metadata
-> runEuropeanCompetitions
-> generate European fixtures
-> simulate scheduled fixtures through the season loop
-> apply MatchRecords/events
```

Clubs can reach the qualification path in architecture, but full-world participation was not verified because the full-world season did not complete. Continental execution is therefore **connected but unverified at full-world scale**.

## 10. Coverage Classification

| Classification | Evidence |
|---|---|
| Expected workload | 1,737 clubs, 41,521 players, approximately 35,756 regular fixtures plus cups/continentals. |
| Inefficient algorithm | Per-match immutable array/record copies and repeated full fixture/player/club scans. |
| Excessive state copying | Reducer rebuilds large arrays and records for every match. |
| Excessive event processing | Each match appends events and triggers downstream consequences; event history grows during the run. |
| Fixture-generation bottleneck | Generation loops 81 leagues and filters the full club set per league; generation itself was not separately timed. |
| Match-engine bottleneck | Every eligible fixture runs the full match engine adapter; actual full-world match count was not reached. |
| Lifecycle bottleneck | Promotion, development, finance, and consequences operate on large state after match processing. |
| Verification bottleneck | Not primary; prior measurements show metrics/invariants are milliseconds, not minutes. |
| Competition configuration issue | Generated domestic cups have entrants but no knockout formats. |

Primary classification: **A expected workload + B inefficient algorithm + C excessive state copying**, with **I competition configuration incompleteness** as a separate coverage issue.

## 11. Full-World One-Season Result

Command:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --full-world --no-repeat
```

Result:

- process remained CPU-bound and responsive;
- output file remained empty during bounded observation;
- no phase milestone beyond startup inventory was observed;
- process was stopped;
- no full-world fixture/match/goal/transfer/invariant totals were produced.

This is the required runtime blocker result. No longer run was attempted.

## 12. Files Changed

- `STEP-2D.1-FULL-WORLD-RUNTIME-COVERAGE-DIAGNOSIS.md`

No production simulation files were changed. No diagnostic observer was added to production code because the existing season function does not expose phase callbacks and the task prohibited production changes.

## 13. Final Conclusion

Step 2D.1 answers the requested questions as far as the current architecture allows:

1. Expected full-world regular league fixtures: **35,756 including the demo league**, before cups/continentals.
2. Actual initial fixtures: **108**, demo league only.
3. Actual full-world matches attempted: not reached in the bounded run.
4. Runtime is dominated by full-season simulation and immutable per-match state copying, not canonical verification.
5. The workload is both large and algorithmically expensive at full-world scale.
6. Generated domestic cups are configured with entrants but no knockout-round formats.
7. Continental competitions are structurally connected but full-world participation is unverified.
8. The one-season full-world run does not finish in the available runtime because the full world expands from a 108-fixture seed to tens of thousands of fixtures, each processed through full match/state-update machinery.

**Step 2D.1 complete. No gameplay code was modified.**
