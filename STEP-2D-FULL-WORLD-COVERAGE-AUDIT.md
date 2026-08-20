# Manager Legacy Step 2D: Full-World Coverage Audit

**Date:** 2026-08-20  
**Scope:** Architecture and coverage audit only  
**Gameplay code changed:** No

## 1. Full-World Definition

In the current canonical implementation, `FULL-WORLD` means:

```text
buildInitialState(seed)
  -> no buildRepresentativeState() filtering
  -> simulateSeason() full match path
  -> applyWorldSeasonProgression()
```

The `--full-world` flag only changes the `representative` boolean in `final-d2.1-regression.ts`. It does not add competitions, generate missing fixtures, or alter simulation rules.

Representative mode calls `buildRepresentativeState()` and reduces the initial world to a fixed number of clubs per league:

- 30-year run: 2 clubs per league
- 10-year run: 4 clubs per league
- shorter runs: 8 clubs per league

It filters clubs, players, fixtures, matches, and transfer listings before simulation.

Full-world mode skips that filtering and starts from the complete `buildInitialState()` world.

## 2. Concrete World Inventory

Measured from `buildInitialState("step2d-inventory")`:

| Entity | Count |
|---|---:|
| Countries in generated world config | 16 |
| Configured divisions | 80 |
| Runtime league objects | 81, including the 9-club demo national league |
| Runtime competitions | 100 |
| Configured world competitions | 98 |
| Clubs | 1,737 |
| Players | 41,521 |
| AI-managed clubs | 1,736 |
| Initial fixtures | 108 |
| Initial competitions with fixtures | 1: `national-league` |

### Divisions and leagues

The generated world has five divisions per country:

- Premier League
- Championship
- League One
- League Two
- National League

The 16 generated countries contribute 80 configured league divisions. The runtime state also contains the separate nine-club `national-league` demo competition, producing 81 league objects total.

Club distribution:

- 16 Premier divisions with 20 clubs each;
- 64 lower divisions with 22 clubs each;
- one separate nine-club demo national league;
- total: 1,737 clubs.

### Domestic cups

The generated configuration contains 16 domestic cups, one per country. Each has 108 potential country entrants because each country has five divisions containing 20 + 22 + 22 + 22 + 22 clubs.

The inspected world configuration does not provide knockout-round format data for these 16 cups. The cup runtime can construct configured cups only when a usable competition format exists; the audit found no configured knockout rounds for these domestic cup entries.

The seeded `national-cup` is a separate demo cup fallback scoped to the nine-club demo league.

### Continental competitions

Two configured continental competitions exist:

- UEFA Champions League
  - two groups;
  - two teams per group;
  - home and away group matches;
  - two-legged semi-final;
  - one-leg final.
- UEFA Europa League
  - two groups;
  - one team per group;
  - home and away group matches;
  - one-leg final.

Qualification is configured from the generated world’s first country and uses league-position/cup-winner rules. The runtime registration path is connected through qualification and European competition functions, but actual participation depends on registration state and competition format.

### Reserve/B teams and youth teams

No separate reserve-team or B-team competition population was found in the inspected world configuration. Youth players exist as academy prospects/new player records, but no separate youth league fixture population was found. Youth generation is a lifecycle system, not a separate scheduled football competition.

## 3. Representative vs Full-World Coverage

| Area | Representative | Full-world |
|---|---|---|
| Initial clubs | Filtered to 2/4/8 clubs per league plus manager club | All 1,737 seeded clubs |
| Initial players | Only players belonging to selected clubs | All 41,521 seeded players |
| Initial fixtures | Only fixtures whose clubs survive filtering | All initial fixtures, though seed initially has only 108 demo fixtures |
| Initial matches | Filtered to surviving clubs | All initial matches |
| Transfers | Listings filtered to surviving sellers | Full initial listing set |
| Season path | `simulateSeason()` in full mode | Same `simulateSeason()` path |
| Quick path | `simulateSeasonQuick()` if requested | Same quick path; quick is not football truth |
| Match engine | Real match execution for full mode | Same real match execution, at much larger scale |
| Canonical metrics | Global over the selected representative state | Global over the full state, when run completes |
| World label | `REPRESENTATIVE` | `FULL-WORLD` |

The simulation algorithm is the same after state construction. The meaningful difference is population size and retained starting entities.

## 4. Coverage Matrix

| World component | Representative | Full-world | Actually simulated? |
|---|---|---|---|
| Generated country divisions | Subset of clubs from each division | All 80 configured divisions | League simulation path can process them if fixtures are generated |
| Demo national league | Included if manager club/selected clubs survive | Included | Yes, initial 108 fixtures |
| Generated league fixtures | Reduced by selected clubs | Generation path can create all divisions | Full path is expected to generate them, but full-world run did not complete for measurement |
| Clubs | Reduced population | 1,737 clubs | Exists; actual match coverage unverified at full-world scale |
| Players | Reduced to selected club rosters | 41,521 players | Participate in lifecycle systems; match participation depends on club roster/input branch |
| Domestic cups | Demo/config-dependent | 16 configured entries, no inspected knockout formats | Not proven as active football competitions |
| Continental competitions | Qualification-dependent | Two configured continental competitions | Connected path, actual full-world output unverified |
| Transfers | Selected-state activity | Full-state activity if run completes | Structured transfer events are counted |
| Youth | Selected-state lifecycle | Full-state lifecycle | Structured `YOUTH_GENERATED` events |
| Retirements | Selected-state lifecycle | Full-state lifecycle | Structured `PLAYER_RETIRED` events |
| Manager changes | Selected-state lifecycle | Full-state lifecycle | Structured manager appointment events when emitted |
| Promotion/relegation | Selected clubs/divisions | All configured division clubs | Connected to standings and structured events |

## 5. Expected Fixture Counts

For an even-number league with $n$ clubs and a double round robin:

$$
F = n(n-1)
$$

For the 16 generated countries:

- each country has one 20-club division: $20 \times 19 = 380$ fixtures;
- each country has four 22-club divisions: $4 \times (22 \times 21) = 1,848$ fixtures;
- each country total: $2,228$ fixtures;
- 16 countries total: $35,648$ regular league fixtures.

The separate nine-club demo league uses a triple round robin and has 108 fixtures.

Measured initial state:

```text
fixtures: 108
fixturesByCompetition: { national-league: 108 }
```

Therefore the initial full-world seed does **not** contain all 35,648 generated-world league fixtures. Those are generated later by the season path. The expected full first-season regular-league total is approximately:

```text
35,648 generated-world league fixtures + 108 demo-league fixtures
= 35,756 regular league fixtures
```

Domestic cups and continental fixtures would add further records if their configured formats and qualification paths are active.

## 6. Fixture and Match Execution Coverage

The full season path:

1. calls `generateLeagueFixtures()`;
2. calls `runDomesticCup()`;
3. simulates scheduled fixtures through `simulateScheduledFixturesViaEngine()`;
4. applies results through the shared `RECORD_MATCH_RESULT` reducer path;
5. runs European competition progression and scheduled fixture simulation;
6. applies promotion/relegation;
7. prunes completed/previous-season fixtures.

AI fixture calendar tests prove the local contract:

- today’s eligible AI fixture is played;
- manager fixtures remain scheduled;
- future fixtures remain scheduled;
- repeated application is exactly once.

Intentional exceptions:

- manager-club fixtures require interactive handling and are excluded from AI-only fixture simulation;
- postponed fixtures are not played;
- fixtures not connected to a configured/active competition path may remain unexecuted;
- quick mode intentionally skips match simulation and is rejected by the football truth gate.

The full-world one-season run was started with:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --full-world --no-repeat
```

It remained CPU-bound with no result output after a bounded observation and was stopped. Therefore generated-versus-played reconciliation for the complete 1,737-club world is unverified in this environment.

## 7. Player Coverage

### Representative

`buildRepresentativeState()` retains only players referenced by selected clubs. This is a reduced player universe and cannot prove full population lifecycle totals.

### Full-world

All 41,521 seeded players are present. The lifecycle systems can process:

- player development;
- injuries/recovery/training where club/player data is available;
- transfers through structured negotiation/completion paths;
- retirements through `PLAYER_RETIRED` events;
- youth generation through `YOUTH_GENERATED` events.

There are two roster/input cases in the AI match adapter:

- fully modeled clubs with player IDs;
- minimal clubs using synthetic roster adaptation for match-engine inputs.

This means a club can participate in a match without having a full named player roster, but the population-level match participation of every full-world player was not completed by the blocked full-world run.

## 8. Competition Coverage

| Competition category | Configuration | Execution status |
|---|---|---|
| 80 generated leagues | Present in `worldConfig` | Fixture generation/simulation path exists; full-world result not completed |
| 1 demo national league | Present in runtime seed | Verified in representative full runs |
| 16 domestic cups | Present as configured entries | No knockout rounds observed in config; full active execution not proven |
| 1 Champions League | Configured group + knockout format | Qualification/European path connected; full-world execution unverified |
| 1 Europa League | Configured group + knockout format | Qualification/European path connected; full-world execution unverified |
| Reserve/B teams | No separate configured population found | Not applicable/not found |
| Youth competitions | No separate scheduled competition found | Youth is lifecycle generation, not a competition |

## 9. Lifecycle Coverage

- **Transfers:** structured negotiation-start and `TRANSFER_COMPLETED` events; representative execution verified, full-world totals unverified.
- **Promotions/relegations:** `computeLeagueTable()` plus `applyPromotionRelegation()` over configured divisions; representative full runs verified.
- **Retirements:** player lifecycle emits `PLAYER_RETIRED`; representative full runs produce structured totals.
- **Youth:** academy emits `YOUTH_GENERATED`; representative full runs produce structured totals.
- **Manager changes:** only structured manager appointment events are counted; the inspected one-season seed trace emitted zero such events.
- **Finance:** runs as part of the season/day path but is outside this coverage audit’s acceptance claims.

## 10. One-Season Full-World Result

**Status: BLOCKED by runtime.**

The command was started exactly as required:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --full-world --no-repeat
```

Observed:

- process remained responsive and CPU-bound;
- output file remained empty during the bounded observation;
- no complete full-world metrics were produced;
- process was stopped after the measured runtime blocker.

No full-world five-year or 30-year run was attempted.

## 11. Missing and Partial Coverage

The audit identifies these gaps without modifying them:

1. The initial seed contains only the demo league’s 108 fixtures; generated-world league fixtures are created during season simulation.
2. Full-world one-season execution could not complete in the available environment.
3. Generated domestic cups have entrants but no knockout format in the inspected configuration, so their actual match coverage is not proven.
4. Continental competitions are configured and connected to qualification/progression code, but their full-world participation was not measured.
5. Full-world per-club/player match participation is unverified.
6. Representative metrics cannot be treated as full-world metrics.
7. Fixture pruning means only authoritative MatchRecords/events preserve historical football evidence after a completed season.
8. `--full-world` correctly bypasses representative filtering, but it does not itself guarantee that every configured competition has fixtures or that every fixture executes.

## 12. Files Changed

No production files were changed.

No audit report file was generated before this final report. This report is the only artifact created for Step 2D.

## 13. Final Assessment

The current implementation’s full-world definition is clear at the state-construction boundary: full-world means the complete seeded 1,737-club/41,521-player state, not the representative filtered subset.

However, full-world **coverage is not proven**:

- the world inventory is broader than the initial fixture set;
- generated leagues are connected to fixture generation but were not reconciled in a completed full-world run;
- domestic cup configuration is incomplete for active knockout verification;
- continental execution is connected but unverified at full-world scale;
- the one-season full-world run is blocked by runtime.

**Step 2D audit complete. No gameplay code was modified.**
