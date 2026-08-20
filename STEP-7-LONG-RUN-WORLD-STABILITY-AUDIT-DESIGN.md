# STEP 7 - LONG-RUN WORLD STABILITY & 30-YEAR AUDIT DESIGN

## Status

Step 7 diagnostic audit design and runner are complete.

No gameplay code, simulation rules, RNG, fixture counts, reducer semantics, or state architecture were changed. No match-result optimization was attempted. No Step 6F work was started.

A 30-season full-world completion is **not claimed**. This turn validated the runner on one representative season only.

## Existing infrastructure inspected

The existing canonical path is:

```text
buildInitialState(seed)
  -> simulateSeason(state)
  -> applyWorldSeasonProgression(state)
```

`simulateSeason()` remains the authoritative full-world simulation. It generates league fixtures, runs transfers, domestic competitions, the canonical AI match engine, player lifecycle, youth generation, European competitions, promotion/relegation, awards, and long-term evolution. It prunes completed/previous-season fixtures before returning.

The prior canonical collector in `scripts/canonical-simulation-audit.ts` already reports useful metrics, but it derives season metrics by comparing state snapshots and event history. That approach is vulnerable when live state is compacted or fixtures are pruned. It also did not provide a dedicated cumulative ledger for all Step 7 stability dimensions.

## Smallest safe collection design

The new script is:

[scripts/step-7-long-run-audit.ts](scripts/step-7-long-run-audit.ts)

It preserves the canonical simulation path and adds only an audit boundary:

```text
before = state
stateAfterSimulation = simulateSeason(before)
seasonMetrics = collectPrimitiveMetrics(before, stateAfterSimulation)
state = applyWorldSeasonProgression(stateAfterSimulation)
ledger.push(seasonMetrics)
```

The important ordering rule is that metrics are captured immediately after `simulateSeason()` and before the next season begins. The ledger stores primitive per-season values, so later fixture pruning or live-state compaction cannot erase historical totals.

The runner exposes:

```bash
npx tsx scripts/step-7-long-run-audit.ts 30 step-7
```

Optional representative and seed checks:

```bash
npx tsx scripts/step-7-long-run-audit.ts 1 step-7 --representative --verify-seeds
```

The report includes `completedSeasons` and `completedAllRequestedSeasons`. A caller must not treat the run as a 30-year success unless `completedAllRequestedSeasons === true` and `completedSeasons === 30`.

## Metrics captured

Each season records:

- matches actually simulated, based on new `MatchRecord` IDs rather than scheduled fixture counts;
- goals, summed from those newly simulated match records;
- completed transfers from new structured `TRANSFER_COMPLETED` events;
- transfer attempts from structured transfer negotiation-start events;
- promotions and relegations from structured events;
- retirements from `PLAYER_RETIRED` events;
- youth generation from `YOUTH_GENERATED` events;
- manager changes from manager appointment events;
- European fixtures generated, using competitions whose canonical type is `continental` and season fixture records;
- European matches simulated, by matching newly created match fixture IDs to continental fixture IDs;
- player and club population after each simulation;
- financially negative/stable club counts, minimum balance, and average balance;
- duplicate IDs across players, clubs, fixtures, matches, events, and transfers;
- invalid player/club, roster, fixture, and match references;
- invariant violations from `checkAllInvariants()`.

The cumulative report also carries totals for every event/match category and final population values.

## Determinism checks

For short verification runs (`seasons <= 2`) with `--verify-seeds`, the runner performs:

1. a second run with the same seed and compares the authoritative report projection;
2. a run with a different seed and verifies the authoritative projection diverges.

Timing and the determinism flags are excluded from the comparison projection. Same-seed equality therefore tests the cumulative metrics and per-season ledger, not runtime noise.

For a 30-season run, seed verification is intentionally opt-in and should be run as separate long executions if the operator needs both the 30-season audit and a 30-season determinism gate. This prevents the audit command from silently multiplying a very expensive full-world workload.

## Validation performed

TypeScript:

```bash
npx tsc --noEmit
```

Result: passed with no errors.

Representative smoke audit:

```bash
npx tsx scripts/step-7-long-run-audit.ts 1 step-7-test --representative --verify-seeds
```

Result:

- requested seasons: 1;
- completed seasons: 1;
- `completedAllRequestedSeasons: true`;
- matches simulated: 167;
- goals: 229;
- completed transfers: 8;
- transfer attempts: 26;
- promotions: 128;
- relegations: 32;
- duplicate IDs: 0;
- invalid references: 0;
- invariant violations: 0;
- same-seed deterministic: `true`;
- different-seed divergence: `true`.

The representative world had no continental registrations, so European activity was correctly reported as zero for that smoke run. The collector uses canonical competition metadata rather than relying on competition-ID naming.

Relevant canonical determinism tests:

```bash
npx vitest run scripts/canonical-simulation-audit.test.ts src/state/deterministic-simulation.test.ts --reporter=dot
```

Result captured from the test runner:

- 1 test file passed;
- 3 tests passed;
- duration: approximately 146 seconds.

The existing focused match/integration suite was also already passing in the preceding Step 6E validation: 4 files and 74 tests.

## 30-year completion policy

The runner intentionally does not convert a requested duration into a claim of completion. A valid 30-year result must show:

```json
{
  "requestedSeasons": 30,
  "completedSeasons": 30,
  "completedAllRequestedSeasons": true
}
```

If execution stops, times out, throws, or returns fewer seasons, the output is diagnostic evidence only and must be reported as incomplete. No extrapolation from Season 1 or a representative world is acceptable as a 30-year completion claim.

## Known limitations and follow-up boundaries

- The representative mode is a smoke-test mode and is not a full-world result.
- Financial stability is measured from the canonical financial calculation at each season boundary; it is not reconstructed from pruned transaction history.
- European activity depends on actual continental registrations and therefore can legitimately be zero in a reduced world.
- The audit counts duplicate IDs in the live state at each boundary and accumulates those counts; it does not mutate or repair duplicates.
- The audit reports invariant violations but does not suppress, repair, or reinterpret them.
- The full-world 30-season command is intentionally available but was not claimed complete during this turn because only bounded validation was run.

## Final conclusion

The smallest safe Step 7 design is an external cumulative ledger around the existing canonical `simulateSeason()` call. It records authoritative match and event deltas before pruning, preserves the complete simulation path, and makes completion and determinism explicit instead of inferred.

Step 7 audit infrastructure is implemented and validated. No production gameplay changes were made. Stop point reached.
