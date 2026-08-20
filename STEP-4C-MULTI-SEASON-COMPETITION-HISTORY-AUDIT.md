# Step 4C Multi-Season Competition and Historical Persistence Audit

## Scope

This audit used a bounded deterministic four-club scenario over three consecutive seasons. It exercised real production APIs for qualification registration, European progression, standings, promotion/relegation, season rollover, and historical records.

No performance optimization, competition redesign, football-rule change, RNG change, match-engine change, or unrelated refactor was performed.

## Final result

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0
- **PASS:** 6 audit categories

## Findings discovered and fixes applied

### H1. Prior-season continental registrations contaminated current-season participation

- **File:** [src/state/european.ts](src/state/european.ts)
- **Function:** `getCompetitionParticipants`
- **Root cause:** Participant selection filtered registrations by `competitionId` but not by the current season.
- **Observed behavior:** During Season 2, prior-season registrations were included alongside current entries. The compact competition then had four participants for a two-team group and could not create the next season's group stage.
- **Minimal fix:** Filter registrations by both `entry.season === String(state.time.season)` and `entry.competitionId === competition.id`.
- **Safety:** Qualification selection, registration persistence, formats, fixture dates, fixture ordering, RNG, and match simulation were unchanged.

### M1. Competition history records lacked explicit competition references

- **Files:** [src/state/world-history.ts](src/state/world-history.ts), [src/state/season.ts](src/state/season.ts)
- **Functions:** `recordSeasonChampion`, `recordCupWinner`, `recordEuropeanWinner`, `simulateSeason`
- **Root cause:** `HistoricalClubRecord.competitionId` was optional and the competition winner helpers did not accept or persist a competition ID.
- **Observed behavior:** League, cup, and European history records could not be authoritatively validated against competition definitions.
- **Minimal fix:** Added optional backward-compatible `competitionId` parameters to the three winner helpers. The authoritative season paths now pass the league or continental competition ID.
- **Safety:** Existing callers remain valid; new records are more explicit and deterministic. No competition outcome logic changed.

## Three-season results

| Season | League champion | Cup winner | Continental winner | Promoted | Relegated | Registration entries | History records |
|---|---|---|---|---|---|---:|---:|
| 2026/27 | england-premier-club-2 | england-premier-club-2 | england-premier-club-1 | england-championship-club-2 | england-premier-club-1 | 2 | 3 |
| 2027/28 | england-championship-club-2 | england-championship-club-2 | england-championship-club-2 | england-premier-club-1 | england-premier-club-2 | 4 | 6 |
| 2028/29 | england-premier-club-1 | england-premier-club-1 | england-championship-club-2 | england-championship-club-1 | england-championship-club-2 | 6 | 9 |

The registration count includes retained historical-season registrations plus the current season. Current-season identity is explicit through `season + competitionId + clubId`.

## Audit coverage

### Season rollover

**PASS**

Three consecutive season labels completed: `2026/27`, `2027/28`, and `2028/29`. Dates advanced to the corresponding August 1 season anchors. Previous-season continental registrations remained identifiable without being used as current-season participants.

### League history

**PASS**

Each bounded season recorded a league champion with the correct season and explicit `audit-top` competition ID. Repeating completion did not create duplicate logical historical keys, and previous records remained present.

### Domestic cup history

**PASS**

Each bounded season recorded a cup winner with the correct season and explicit `audit-cup` competition ID. Repeated historical recording remained idempotent through the existing `upsertUnique` logic.

### Continental history

**PASS**

Each season produced a bounded continental winner with explicit `audit-europe` competition ID. Historical winner keys remained unique by logical record identity, and current-season participant selection no longer included prior-season registrations.

### Promotion/relegation persistence

**PASS**

Each season produced valid bounded movement. No club was both promoted and relegated in the same season. Repeating `applyPromotionRelegation` did not add events or alter the same season's movement. All clubs remained assigned to valid divisions.

### Historical consistency

**PASS**

The final state had:

- duplicate registration keys: `0`
- duplicate historical keys: `0`
- invalid club references: `0`
- invalid competition references: `0`
- invalid season references: `0`
- impossible division membership: `0`
- duplicate fixture IDs: `0`
- unlinked competition history records: `0`

### State contamination

**PASS**

The audit explicitly repeated:

- same-season registration
- season rollover and registration
- European competition processing
- winner history recording
- promotion/relegation processing

No duplicate logical state was created.

### Determinism

**PASS**

Two complete three-season runs with seed `step-4c-seed` produced identical:

- season results
- registrations
- competition winners
- historical records
- final state fingerprint

Final same-seed fingerprint length: `15,656` characters.

A different seed, `step-4c-different-seed`, diverged in bounded results/final state, as expected for seeded outcomes.

## Tests and commands

### TypeScript

```text
npx tsc --noEmit
```

Result: **PASS**.

### Focused Vitest tests

```text
npx vitest run src/state/qualification-registration.test.ts src/state/world-history-competition.test.ts src/state/competitions.test.ts src/state/league-pyramid.test.ts --reporter=dot
```

Result:

- `4` test files passed
- `15` tests passed

The new history regression covers explicit competition IDs for league, cup, and European records.

### Bounded three-season audit

```text
npx tsx scripts/step-4c-multi-season-history-audit.ts
```

Result:

- all three seasons completed
- all six audit categories passed
- zero findings in every severity category

## Files changed

- [src/state/european.ts](src/state/european.ts)
- [src/state/world-history.ts](src/state/world-history.ts)
- [src/state/season.ts](src/state/season.ts)
- [src/state/world-history-competition.test.ts](src/state/world-history-competition.test.ts)
- [scripts/step-4c-multi-season-history-audit.ts](scripts/step-4c-multi-season-history-audit.ts)
- [STEP-4C-MULTI-SEASON-COMPETITION-HISTORY-AUDIT.md](STEP-4C-MULTI-SEASON-COMPETITION-HISTORY-AUDIT.md)

## Remaining unverified areas

- This was intentionally a bounded four-club scenario, not an uncontrolled full-world three-season simulation.
- Full continental formats beyond the bounded two-team group/final format were not independently simulated here.
- Long-run player, finance, transfer, and AI systems were outside this audit scope.
- The previously known unrelated missing `src/state/build` import in `test-season-calendar-separation.test.ts` was not changed.

## Exact stop point

Step 4C is complete. No Step 4D or unrelated optimization was started.
