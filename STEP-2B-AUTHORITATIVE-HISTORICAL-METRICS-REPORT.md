# Manager Legacy Step 2B: Authoritative Historical Metrics

**Date:** 2026-08-20  
**Scope:** Verification infrastructure only

## 1. Root Cause of the Historical Metric Weakness

The previous canonical audit reconstructed historical totals from retained state after season execution. That was invalid because normal season progression prunes completed fixtures and quick-mode compacts historical collections.

The previous implementation also mixed authoritative and non-authoritative definitions:

- goals and played matches were reconstructed from retained fixtures;
- completed transfers used typed events in one place but per-season summaries used `type === "transfer"` plus description text such as `"moved"`;
- transfer attempts counted all lowercase `transfer` events, including unrelated transfer notifications;
- manager changes counted every `manager` event or parsed descriptions/actions for words such as `sacked`, `appointed`, and `change`;
- cumulative totals were recomputed from current state rather than from immutable per-season observations.

## 2. Authoritative Sources Chosen

| Metric | Authoritative source | When it becomes true |
|---|---|---|
| Fixtures generated | Pre-season `state.fixtures` records for the season before execution | `generateLeagueFixtures()` creates the scheduled fixture records. |
| Fixtures played | New structured `MATCH_PLAYED` events in the season transition | `RECORD_MATCH_RESULT` completes a fixture and emits the event. |
| Matches completed | New `MatchRecord` objects appended during the season | `RECORD_MATCH_RESULT` appends the completed match record. |
| Goals | `scoreHome + scoreAway` on new season-scoped `MatchRecord`s | The match result is recorded. |
| Transfer attempts | Structured `transfer` events with `meta.action === "negotiation_start"` and `meta.type === "transfer"` | `createNegotiationSession()` creates the transfer negotiation. |
| Transfers completed | `TRANSFER_COMPLETED` events | `applyAcceptedTransfer()`/transfer completion moves the player and emits the typed event. |
| Promotions | `PROMOTION` events with structured club/division metadata | Competition outcome applies the division move. |
| Relegations | `RELEGATION` events with structured club/division metadata | Competition outcome applies the division move. |
| Retirements | `PLAYER_RETIRED` events | Player lifecycle marks retirement and emits the event. |
| Youth generated | `YOUTH_GENERATED` events | Academy generation creates the player and emits the event. |
| Manager changes | Structured `manager` events with `meta.action === "appointed"` | Manager replacement emits the appointment event. |

No metric in the canonical accumulator uses event descriptions.

## 3. Files Changed

- `scripts/canonical-simulation-audit.ts`
- `scripts/final-d2.1-regression.ts`
- `scripts/canonical-simulation-audit.test.ts`
- `src/state/canonical-simulation-audit.test.ts`
- `STEP-2B-AUTHORITATIVE-HISTORICAL-METRICS-REPORT.md`

No gameplay, AI, scheduler, transfer, training, development, match, finance, manager, fixture-generation, season-progression, or fixture-maintenance code was changed.

## 4. Authoritative Accumulation Design

`collectAuthoritativeSeasonMetrics(beforeState, afterState, seasonLabel)` observes one season boundary:

- fixtures are counted from the pre-execution fixture set;
- new matches are identified by MatchRecord IDs not present before the season;
- goals come from those new MatchRecords;
- new events are identified by event IDs not present before the season;
- structured event type/meta fields provide lifecycle and transfer metrics.

The result is stored in the local canonical `perSeason` report. It is not written into gameplay state and does not retain unlimited fixtures for auditing.

Cumulative report fields are sums of the per-season authoritative metrics:

```text
fixturesScheduled = sum(season.fixturesGenerated)
matchesPlayed     = sum(season.matchesCompleted)
goals             = sum(season.goals)
transferAttempts  = sum(season.transferAttempts)
transfers         = sum(season.completedTransfers)
...
```

## 5. Description Parsing

Canonical metric collection does not parse descriptions.

There are no canonical checks for:

- `description.includes("moved")`
- `description.includes("appointed")`
- `description.includes("sacked")`
- `description.includes("promoted")`
- `description.includes("relegated")`

The metric tests intentionally use the description `"opaque"` for every event and still obtain the correct values from event types and metadata.

Legacy diagnostic scripts elsewhere in the repository still contain description parsing, but they are not used by the canonical authoritative accumulator and were not modified in this verification-only task.

## 6. Tests Before

Relevant baseline tests before the Step 2B changes:

```text
src/state/event-invariants.test.ts
src/state/player-lifecycle.invariants.test.ts
src/state/season-report-history.test.ts
src/state/ai-fixture-calendar.test.ts

4 files passed
16 tests passed
```

The earlier canonical implementation had no authoritative per-season metric accumulator and reconstructed match/goals data from retained fixtures.

## 7. Tests After

TypeScript:

```text
npx tsc --noEmit
PASS
```

Authoritative metric and related regression tests:

```text
scripts/canonical-simulation-audit.test.ts
src/state/event-invariants.test.ts
src/state/player-lifecycle.invariants.test.ts
src/state/season-report-history.test.ts
src/state/ai-fixture-calendar.test.ts

3 files passed
13 tests passed
```

The authoritative metrics test is now located under `src/state`, so it is included by normal Vitest discovery.

The new test coverage verifies:

- fixture generation is counted from the pre-season fixture set;
- played fixtures and completed matches are separate metrics;
- goals come from actual MatchRecord results;
- fixture pruning does not destroy metrics;
- transfer attempts and completed transfers differ;
- promotions/relegations, retirements, youth, and manager changes use structured events;
- metric collection does not mutate either state;
- repeated collection is idempotent;
- season 1 remains unchanged after season 2 executes.

## 8. Example One-Season Metrics

Final canonical representative full-path run:

```text
seasonsCompleted: 1
daysAdvanced: 263
fixturesGenerated: 84
fixturesPlayed: 4548
matchesCompleted: 4548
goals: 5594
transferAttempts: 107
completedTransfers: 34
promotions: 192
relegations: 192
retirements: 0
youthGenerated: 0
managerChanges: 0
invariantViolations: 0
```

The process’s nonzero exit status came from the existing single-seed different-seed-divergence check, not from the authoritative metric or invariant checks.

## 9. Example Five-Season Metrics

Final representative full-path run:

```text
seasonsCompleted: 5
daysAdvanced: 1724
fixturesGenerated: 84
matchesCompleted: 22692
goals: 47948
completedTransfers: 182
promotions: 960
relegations: 960
retirements: 235
youthGenerated: 1316
transferAttempts: 539
managerChanges: 0
invariantViolations: 0
```

The five-season run completed after the accumulator migration. Manager changes are zero because this seed/path emitted no structured appointment events; no description fallback is used.

## 10. Proof Pruning Does Not Destroy Historical Metrics

The accumulator observes metrics before the season’s completed fixtures are pruned:

- fixture generation is read from `beforeState.fixtures`;
- match completion and goals are read from new `MatchRecord`s;
- lifecycle metrics are read from new structured events;
- the post-season state may contain no completed fixtures from the prior season.

The new tests construct a state with no retained fixture but retained MatchRecord/event evidence and verify that the same historical totals remain available.

## 11. Proof Cumulative Totals Equal Season Totals

The canonical report computes cumulative totals only through `sumSeasonMetrics()` over `perSeason` summaries. The Step 2B test constructs two seasons with 3 and 1 goals and verifies cumulative goals equal 4; it similarly verifies two completed matches.

No final total is reconstructed by scanning the pruned fixture array.

## 12. Performance Impact

The canonical metric collection performs one before/after delta pass per season:

- one set of prior event IDs;
- one set of prior MatchRecord IDs;
- one scan of new events;
- one scan of new MatchRecords.

It does not scan all historical fixtures or all historical events for each season. It does not retain extra gameplay state and does not mutate simulation state.

## 13. Remaining Limitations

- Manager changes are authoritative only when the production system emits the structured `manager` appointment event. No description fallback is used; a missing structured event is reported as zero rather than guessed.
- Transfer attempts are defined as transfer negotiation-start events. Listings, rejected offers, and contract negotiations are intentionally not conflated with attempts.
- The canonical default remains representative unless full-world mode is explicitly requested.
- Determinism and performance benchmarking are outside Step 2B.
- Legacy diagnostic harnesses still contain description-based metrics, but canonical reporting no longer depends on them.
- The older `scripts/canonical-simulation-audit.test.ts` helper remains outside default Vitest discovery; the authoritative coverage is duplicated under `src/state/canonical-simulation-audit.test.ts` and runs normally.

**Step 2B complete. Stopped after authoritative metric infrastructure changes and validation.**
