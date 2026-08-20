# Manager Legacy Step 2A: Canonical Simulation Truth Gate

**Date:** 2026-08-20  
**Scope:** Verification infrastructure only  
**Gameplay/AI/match formulas/transfers/training/development:** unchanged

## Result

The canonical verification path now fails closed when it cannot prove that football occurred.

The original false-positive path was:

```text
simulateSeasonQuick()
  -> intentionally skips fixture/match simulation
  -> prunes/replaces fixture state during season progression
  -> canonical audit reports seasons completed with fixtures=0, matches=0, goals=0
```

The truth gate now:

- rejects `--quick` before simulation because quick mode intentionally does not execute matches;
- captures fixtures from the pre-season state before season pruning;
- counts match records appended by the season execution path;
- sums goals from those appended match records;
- records calendar days advanced after the existing season progression step;
- fails a case when total or any individual season has zero days, generated fixtures, or completed matches;
- labels reports as `REPRESENTATIVE` or `FULL-WORLD`.

## Root Cause

There were two separate causes:

1. `simulateSeasonQuick()` is intentionally a non-football fast path. It calculates deterministic standings and lifecycle changes but does not simulate scheduled fixtures or goals.
2. `canonical-simulation-audit.ts` summarized after season execution and transition. Completed fixtures are removed/replaced by the season lifecycle, so looking only at the post-transition `state.fixtures` collection produced zero fixture/match/goal evidence even for a path that had actually executed matches.

No gameplay code was changed to make verification pass.

## Files Changed

- `scripts/canonical-simulation-audit.ts`
- `scripts/final-d2.1-regression.ts`
- `STEP-2A-CANONICAL-SIMULATION-TRUTH-GATE-REPORT.md`

No changes were made to AI, scheduler, transfers, training, development, match simulation, finance, manager behavior, fixture generation, season progression, or fixture maintenance.

## Exact Verification Changes

### `scripts/canonical-simulation-audit.ts`

- Added `worldScope: "REPRESENTATIVE" | "FULL-WORLD"` to `SimulationReport`.
- Added `daysAdvanced` to the report and every `SeasonSummary`.
- Added `fixturesGenerated` and `matchesCompleted` to `SeasonSummary`.
- Captures `beforeState.fixtures` for the season being executed.
- Captures the appended `MatchRecord` slice from `state.matches`.
- Counts goals from appended match records instead of post-pruning fixtures.
- Summarizes after `applyWorldSeasonProgression()` so calendar advancement is measured.
- Keeps fixture/match evidence independent of the post-season fixture collection.
- Validation output now reports days, generated fixtures, played fixtures, and completed matches.

### `scripts/final-d2.1-regression.ts`

- Rejects `--quick` immediately with:

```text
CANONICAL TRUTH GATE FAILED: --quick intentionally skips match execution and cannot prove football occurred.
```

- Requires total days advanced to be positive.
- Requires total generated fixtures to be positive.
- Requires total completed matches to be positive.
- Requires every season to have positive days, generated fixtures, and completed matches.
- Retains existing population, lifecycle, and invariant checks.

## Tests Before

Relevant pre-change tests:

```text
src/state/ai-fixture-calendar.test.ts
src/state/season-lifecycle.test.ts
src/state/multi-season.test.ts

3 files passed
25 tests passed
```

The pre-change one-season quick regression demonstrated the false path:

```text
1 seasons seed 0: fixtures=0 matches=0 goals=0
World scope: representative
```

It exited nonzero for an unrelated different-seed divergence check, but the zero-football report itself was not rejected by the old truth logic.

## Tests After

TypeScript:

```text
npx tsc --noEmit
PASS
```

Relevant tests after the changes:

```text
src/state/ai-fixture-calendar.test.ts
src/state/season-lifecycle.test.ts
src/state/multi-season.test.ts

3 files passed
25 tests passed
```

Quick-mode gate:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --quick --no-repeat
EXIT=1
CANONICAL TRUTH GATE FAILED: --quick intentionally skips match execution and cannot prove football occurred.
```

## One-Season Canonical Result

The final one-season run used the **full football path** in explicitly labeled representative mode:

```text
npx tsx scripts/final-d2.1-regression.ts 1 0 --no-repeat
```

Result:

```text
worldScope: REPRESENTATIVE
daysAdvanced: 263
seasonsCompleted: 1
fixturesGenerated: 84
fixturesPlayed: 4548
matchesCompleted: 4548
goals: 5594
```

The process exited nonzero because the existing invariant checker reported retained-fixture reference violations after the normal season pruning step. The truth-gate requirement itself passed: days, fixtures, matches, and season completion were all positive.

## Multi-Season Canonical Result

The five-season full-path representative run completed:

```text
npx tsx scripts/final-d2.1-regression.ts 5 0 --no-repeat
```

Result:

```text
worldScope: REPRESENTATIVE
daysAdvanced: 1724
seasonsCompleted: 5
fixturesGenerated: 84
matchesCompleted: 22692
goals: 47948
```

Each simulated season satisfied the new per-season positive-fixture and positive-match gate. The run still exited nonzero because existing final-state invariant checks reported `MATCH_PLAYED_MISSING_FIXTURE` violations after fixture pruning:

```text
invariantViolations: 140808
invariantBreakdown: { MATCH_PLAYED_MISSING_FIXTURE: 140808 }
```

That issue is deliberately not fixed in Step 2A because it concerns historical metric/invariant retention, which the task explicitly deferred.

## Full-World Status

Representative/full-world labeling is now explicit in the canonical report:

- Representative runs report `worldScope: "REPRESENTATIVE"`.
- Full-world runs report `worldScope: "FULL-WORLD"`.
- The default regression script remains representative unless `--full-world` is supplied.

A one-season full-world attempt was started but did not complete within the available run window and was stopped. Therefore this task provides verified football execution in representative full mode, but does not claim a completed full-world result.

## Did Real Matches Execute?

Yes, in the full-path representative runs.

Evidence:

- 4,548 `MatchRecord` entries were appended in the one-season run.
- 22,692 match records were appended across five seasons.
- Goals were calculated from those match records: 5,594 in one season and 47,948 across five seasons.
- The existing AI fixture tests also verify that scheduled AI fixtures transition to `played`, append a match, and are exactly-once.

No synthetic fixtures or synthetic match metrics were injected.

## Remaining Limitations

- Full-world execution was not completed in this environment because it is very expensive.
- The existing invariant suite runs against the final retained state, while completed fixtures are pruned. This produces `MATCH_PLAYED_MISSING_FIXTURE` violations after otherwise real matches execute.
- Determinism, historical metric collection, performance, and invariant retention are intentionally outside Step 2A.
- Representative mode is still the default command mode, but it is now explicitly labeled and cannot be mistaken for full-world evidence.
- The final command may still exit nonzero for pre-existing different-seed divergence or retained-fixture invariant checks; the truth gate separately proves whether football executed.

**Step 2A complete. Stopped after verification-infrastructure changes as requested.**
