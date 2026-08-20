# Manager Legacy Step 2C: Deterministic Simulation Gate

**Date:** 2026-08-20  
**Status:** BLOCKED AT FIRST FULL-SEASON DETERMINISM CHECK  
**Scope:** Verification and determinism only

## 1. Determinism Contract

The canonical deterministic output compares only authoritative simulation results:

- simulation mode and world scope;
- years and days advanced;
- seasons completed;
- fixtures generated;
- fixtures played;
- matches completed;
- goals;
- transfer attempts;
- completed transfers;
- promotions and relegations;
- retirements;
- youth generation;
- manager changes;
- invariant violation count and invariant breakdown;
- complete per-season authoritative metric objects.

The contract intentionally excludes:

- runtime and elapsed milliseconds;
- report generation timestamps;
- object identity;
- console output;
- other diagnostic metadata.

The one-match test compares the complete deterministic match result for identical fixture, club, player, state, and seed inputs.

## 2. Randomness Sources Audited

### Seeded deterministic sources

- `src/lib/match-engine.ts`: Mulberry32 PRNG seeded by the supplied match seed.
- `src/lib/ai-match-adapter.ts`: seeded synthetic roster/tactical inputs and deterministic fixture seed conversion.
- `src/lib/ai-fixture-sim.ts`: seeded fixture simulation helpers and fixture-ID hashing.
- `src/state/utils.ts`: `seededUnit()` and `deterministicId()`.
- `src/state/seed.ts`: deterministic squad generation, round-robin fixture generation, seeded hashes, fixed dates.
- `src/state/ai-manager.ts`: seeded manager identity, priority, formation, and preference selection.
- `src/state/ai-decisions.ts`: seeded priority jitter with explicit seed salt.
- `src/state/academy.ts`: seeded youth generation.
- `src/state/player-development.ts` and `src/state/ai-evolution.ts`: seeded lifecycle/development decisions.
- injuries/events: seeded inputs through state utility helpers.

### Ambient randomness audit

A source search across `src/state` and `src/lib` found no simulation-affecting `Math.random()`, `crypto.random*`, `randomUUID`, or `Date.now()` calls in the audited simulation modules.

### Ordering risks identified

The simulation frequently iterates `Object.keys`, `Object.values`, `Object.entries`, `Map`, and `Set`. JavaScript preserves insertion order for ordinary objects and these collections, so identical initial state construction should preserve ordering. However, this is an implicit ordering contract rather than an explicit canonical sort at every decision boundary.

Potential risk areas requiring later work if the same-state comparison fails:

- object insertion order after state transformations;
- map/set construction order after filtering;
- global memo/cache state between repeated runs in one process;
- fixture ID reuse after pruning;
- random-call order changes caused by branches that create different numbers of events.

No gameplay or simulation source was modified to address these risks.

## 3. Tests Before

Command:

```text
npx vitest run src/lib/ai-match-adapter.test.ts src/state/ai-fixture-calendar.test.ts src/state/ai-manager-identity.test.ts src/state/ai-world-scheduler.test.ts src/state/final-d2.1-regression.test.ts
```

Result:

```text
3 test files passed
25 tests passed
2 pre-existing failures
```

Pre-existing failures:

- `src/lib/ai-match-adapter.test.ts`: underdog-outcome expectation failed; deterministic repeat equality within that test was not the failing assertion.
- `src/state/final-d2.1-regression.test.ts`: scheduler representative-scale test timed out.

## 4. Tests Added

Added:

- `src/state/deterministic-simulation.test.ts`

The file contains:

- one-match same-input/same-seed comparison;
- one-season same-seed canonical projection comparison;
- different-seed canonical projection comparison.

A five-season test was not started because the first full-season same-seed test timed out and the task explicitly requires stopping after diagnosing the first determinism failure/blocker.

## 5. Exact Commands Executed

### One-match deterministic test

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result"
```

Result:

```text
1 test passed
2 tests skipped by filter
EXIT=0
```

### Full one-season/different-seed determinism attempt

```text
npx vitest run src/state/deterministic-simulation.test.ts -t "match result|same one-season|different seeds"
```

Result:

```text
1 test failed
```

Failure:

```text
produces identical authoritative metrics for the same one-season seed
Error: Test timed out in 240000ms
```

The test timed out while running two full one-season representative simulations. No differing metric or event was produced, so there is no observed first divergence to report.

### TypeScript

```text
npx tsc --noEmit
```

Result: PASS.

## 6. One-Match Result

PASS.

Identical fixture/state/player inputs and seed `6016` produced equal complete `simulateAiFixtureViaEngine()` results.

## 7. One-Season Result

UNVERIFIED / BLOCKED.

The same-seed comparison was attempted with identical seed, initial construction, full mode, representative scope, and one-season duration. It exceeded the 240-second test timeout before producing a second canonical report comparison.

No gameplay divergence was observed.

## 8. Five-Season Result

NOT RUN.

The task requires stopping after the first failed/blocking same-seed determinism check. Running five-season comparisons would not add useful evidence after the one-season full path could not complete twice within the test timeout.

Existing previously verified five-season canonical metrics remain:

```text
matchesCompleted: 22692
goals: 47948
transferAttempts: 539
completedTransfers: 181
promotions: 960
relegations: 960
retirements: 235
youthGenerated: 1316
managerChanges: 0
invariantViolations: 0
```

Those are not determinism results.

## 9. Same-Seed Comparison Result

- Match level: PASS.
- One season: BLOCKED by timeout; no divergence observed.
- Five seasons: NOT RUN because of the required stop rule.

The existing `final-d2.1-regression.ts` supports same-seed repeat comparison, but prior recorded runs used `--no-repeat`, which reports `Same-seed reproducibility: NOT RUN`. The new test makes the comparison contract explicit but cannot complete the first full-season repeat in this environment.

## 10. Different-Seed Comparison Result

NOT COMPLETED in the new determinism test because the same-season test timed out first.

The canonical system already uses the supplied seed in initial manager worlds, seeded squad/world generation, youth, match, and AI decision inputs. Existing manager identity tests prove different world seeds produce different manager identities. That is supporting evidence, not a full simulation different-seed result.

## 11. First Divergence

No first divergence was observed.

The first blocking point was:

```text
same seed + same initial state + one full season
-> second canonical run did not complete within 240 seconds
```

Likely cause of the block is the expensive full seasonal simulation and test-environment contention from other long-running Node processes, not proven nondeterministic behavior. No source change was made to speculate or force equality.

## 12. Files Changed

- `src/state/deterministic-simulation.test.ts`

No gameplay, AI, scheduler, transfer, training, development, match, fixture, season, finance, or manager files were changed.

## 13. Files Added

- `src/state/deterministic-simulation.test.ts`
- `STEP-2C-DETERMINISTIC-SIMULATION-GATE-REPORT.md`

## 14. Remaining Limitations

- Full one-season same-seed canonical equality is not demonstrated because the comparison timed out.
- Five-season same-seed equality is not attempted under the required stop rule.
- Different-seed full simulation divergence is not demonstrated in this run.
- Existing unrelated tests remain failing or timing out.
- Ordering is insertion-order dependent in several simulation paths and has not been refactored because this task forbids a broad nondeterminism refactor.
- Runtime was recorded only as diagnostic context; no performance optimization was attempted.

**Step 2C stopped after diagnosing the first full-season determinism blocker, as required.**
