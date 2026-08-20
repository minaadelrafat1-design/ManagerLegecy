# Manager Legacy Step 2C.1: Determinism Runtime Blocker Diagnosis

**Date:** 2026-08-20  
**Status:** DIAGNOSIS COMPLETE  
**Scope:** Diagnostic verification only

## 1. Exact Reproduction

Command used for the new deterministic contract:

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result|same one-season|different seeds"
```

Timeout:

```text
240000ms
```

Result:

```text
1 test failed
produces identical authoritative metrics for the same one-season seed
Error: Test timed out in 240000ms
```

The isolated match test passed. The one-season test timed out before the second canonical result could be compared. The five-season test was not run, per the Step 2C hard-stop rule.

No production simulation code was modified.

The exact command later completed when allowed to run beyond the 240-second
command cutoff:

```text
1 test file passed
3 tests passed
Duration: 273.39s
```

That command performs four full one-season simulations: two same-seed runs
and two different-seed runs. The earlier blocker was a timeout threshold for
the complete command, not an observed determinism mismatch.

## 2. Last Observable Progress

The test entered Vitest successfully and began the one-season comparison. The test body performs:

```text
first = collectCanonicalSimulationReport(1, seed, full, representative)
second = collectCanonicalSimulationReport(1, seed, full, representative)
comparison = canonicalProjection(first) === canonicalProjection(second)
```

No first-difference payload was emitted. The timeout occurred during the
full-season simulation workload before the 240-second cutoff. When allowed to
complete, all canonical comparisons passed.

The repository’s prior one-season canonical runs report approximately 42-145 seconds for a single representative full simulation. The deterministic test requires two same-seed simulations, and the environment also had multiple long-running Node processes from earlier audits. The combined run exceeded 240 seconds.

## 3. Runtime Breakdown

| Operation | Runtime | Relative cost | Result |
|---|---:|---|---|
| Initial state creation | 51-79 ms | Low | Measured |
| Initial state serialization | 88-119 ms; about 17.0 MB | Low | Measured |
| One-match simulation | 59 ms | Low | Passed |
| First full-season simulation | 44,695 ms | Dominant | Completed |
| First canonical metric collection | 3.46 ms | Negligible | Measured |
| First invariant checking | 49.25 ms | Negligible | Measured |
| First final-state serialization | 119.13 ms; about 23.5 MB | Low | Measured |
| First report serialization | 0.04 ms; 1,051 bytes | Negligible | Measured |
| Second full-season simulation | 43,377 ms | Dominant | Completed |
| Second canonical metric collection | 4.08 ms | Negligible | Measured |
| Second invariant checking | 55.88 ms | Negligible | Measured |
| Second final-state serialization | 179.15 ms; about 23.5 MB | Low | Measured |
| Second report serialization | 0.02 ms; 1,051 bytes | Negligible | Measured |
| Final comparison | 0.006 ms | Negligible | Equal |

The standalone two-run diagnostic completed in about 89 seconds. The exact
Vitest command took 273.39 seconds because it executes four full reports.

## 4. Duplicated Work Observed

The determinism test intentionally performs two complete simulations for the same seed. This is required to prove reproducibility.

Each canonical report also performs verification work after simulation:

- canonical per-season metric collection;
- authoritative event and MatchRecord delta processing;
- final invariant checking;
- aggregate projection construction.

The comparison itself does not consume randomness and does not mutate either result.

The current test does not serialize full GameState snapshots for comparison. It compares a projected canonical report that excludes runtime and timestamps.

The full report still performs final invariant checking, which scans retained state and historical evidence. That cost is included inside report collection and was not separately instrumented before the timeout.

## 5. Data Growth Context

Measured one-season diagnostic growth:

| Collection | Initial | End of season | Growth |
|---|---:|---:|---:|
| players | 15,408 | 15,408 | 0 |
| clubs | 648 | 648 | 0 |
| fixtures | 84 | 0 | -84, due to pruning |
| matches | 0 | 4,548 | +4,548 |
| events | 0 | 5,697 | +5,697 |
| transfers | 35 | 35 | 0 |
| negotiations | 0 | 107 | +107 |
| inbox | 0 | 0 | 0 |
| news | 3 | 213 | +210 |
| serialized state | about 17.0 MB | about 23.5 MB | about +6.5 MB |
| canonical report | not applicable | 1,051 bytes | diagnostic only |
| historical metrics | not stored in gameplay state | per-season report only | diagnostic only |

Previously completed five-season representative full runs show the following final-scale values:

```text
Players: 16,724
Clubs: representative subset
Fixtures retained: 84
MatchRecords: 22,692
Goals: 47,948
Events: large retained history
Transfer attempts: 539
Completed transfers: 181
Invariant violations: 0
```

Previously measured mature daily simulations show that events, fixtures, development, and AI processing can dominate runtime. The deterministic test executes the full season path twice, so it inherits that cost.

No explosive player/club growth was observed. Match, event, negotiation, and news growth follows the executed season; fixtures decrease because pruning runs. The blocker is repeated full simulation cost, not historical metric reconstruction.

## 6. Invariant Cost

The canonical report invokes `checkAllInvariants(state)` once per completed report. The deterministic test therefore invokes the invariant suite once for each completed canonical simulation.

Measured invariant runtime was approximately 49-56 ms per report. No invariant was removed, weakened, or bypassed.

## 7. Canonical Metric Cost

Step 2B’s accumulator is incremental relative to the season boundary:

- it compares new event IDs against the before-state event IDs;
- it compares new MatchRecord IDs against the before-state match IDs;
- it reads pre-season fixture records for generated-fixture count;
- it sums only newly completed season MatchRecords.

It does not reconstruct all historical totals from the pruned fixture collection. Measured metric collection was approximately 3.5-4.1 ms per season and was not the timeout source.

## 8. RNG Observations

No simulation-affecting `Math.random()`, `Date.now()`, `crypto.random*`, or `randomUUID` calls were found in the audited state/lib simulation modules.

Randomness is primarily seeded/hash-based:

- Mulberry32 in `src/lib/match-engine.ts`;
- fixture seed hashing in `src/lib/ai-fixture-sim.ts`;
- seeded adapter inputs in `src/lib/ai-match-adapter.ts`;
- `seededUnit()` and `deterministicId()` in `src/state/utils.ts`;
- seeded world/squad/youth/AI-manager generation;
- seeded AI priority jitter.

The audit does not reuse a mutable RNG instance across separate canonical runs. Match and generation functions create deterministic RNGs from explicit seeds. The comparison itself consumes no RNG.

Potential future observation points, not fixed here:

- insertion-order dependence from `Object.keys`, `Object.values`, `Map`, and `Set` iteration;
- global memo/cache state between repeated runs in the same process;
- branch-dependent random-call ordering;
- fixture ID reuse after pruning.

## 9. Likely Bottleneck

The bottleneck is the full-season simulation itself, amplified by running it four times in the exact Step 2C command.

Evidence:

1. The isolated match comparison completes in 59 ms and passes.
2. The standalone diagnostic measured first/second simulations at 44,695 ms and 43,377 ms.
3. Metrics, invariants, state serialization, report serialization, and comparison were all below 180 ms per run.
4. The exact command executes four full reports and completed in 273.39 seconds, above the prior 240-second cap.
5. No differing canonical output or first event/result divergence was observed.

This is a runtime/verification-environment blocker, not evidence of nondeterministic gameplay.

## 10. Tests Before

Command:

```text
npx vitest run src/lib/ai-match-adapter.test.ts src/state/ai-fixture-calendar.test.ts src/state/ai-manager-identity.test.ts src/state/ai-world-scheduler.test.ts src/state/final-d2.1-regression.test.ts
```

Result:

```text
3 files passed
25 tests passed
2 pre-existing failures
```

Pre-existing failures:

- underdog outcome assertion in `src/lib/ai-match-adapter.test.ts`;
- representative scheduler scale test timeout in `src/state/final-d2.1-regression.test.ts`.

## 11. Tests During Step 2C.1

One-match deterministic contract:

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result"
```

Result:

```text
1 passed
2 skipped by filter
EXIT=0
```

TypeScript:

```text
npx tsc --noEmit
PASS
```

Full deterministic attempt:

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result|same one-season|different seeds"
```

Result:

```text
1 failure: same one-season test timed out at 240000ms
```

Instrumented runtime diagnostic:

```text
npx tsx scripts/step-2c1-runtime-diagnostic.ts
EXIT=0
first simulation: 44,695 ms
second simulation: 43,377 ms
canonical comparison: equal=true
```

Exact command rerun after instrumentation:

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result|same one-season|different seeds"
```

Result:

```text
1 test file passed
3 tests passed
Duration: 273.39s
```

## 12. Files Changed

- `src/state/deterministic-simulation.test.ts`
- `scripts/canonical-simulation-audit.ts` (diagnostic observer only)
- `scripts/step-2c1-runtime-diagnostic.ts`
- `STEP-2C-DETERMINISTIC-SIMULATION-GATE-REPORT.md`
- `STEP-2C.1-DETERMINISM-RUNTIME-BLOCKER-REPORT.md`

No production gameplay or simulation implementation files were changed.

## 13. Final Status

- One-match determinism: **PASS**.
- Same-seed one-season determinism: **PASS when allowed to complete**.
- Five-season determinism: **NOT RUN** for Step 2C.1.
- Different-seed one-season comparison: **PASS when allowed to complete**.
- First divergence: **None observed**.
- Gameplay code untouched: **Confirmed**.

**Step 2C.1 complete. The runtime blocker was measured and explained; no optimization was attempted.**
