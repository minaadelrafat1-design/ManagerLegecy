# Phase D2.1 Prompt 6 Regression Report

## Scope

Prompt 6 adds observable AI regression coverage, one canonical daily-pipeline end-to-end test, performance metric collection, scale guards, and a resumable long-term simulation runner.

## Critical Issues Fixed

- The AI scheduler could process more than the documented four clubs per day when urgent reasons accumulated. `planAiWorldWork` now applies a final deterministic four-club cap after priority ordering.
- Match determinism tests reused mutable team inputs. The regression suite now constructs fresh equivalent inputs for repeated simulations.
- Long-run reporting compared historical events against only final state, producing false transfer/retirement invariant positives. Current-season scoping now applies to those state-consistency checks.
- Long-run status and seed-divergence predicates were corrected: non-retired players count as active, and seed comparison uses the requested duration and lifecycle metrics.
- Quick long-horizon audits now compact historical events, news, inbox, season reports, and player career history after each season, preventing 30-season heap exhaustion.

## New Coverage

- `src/state/final-d2.1-regression.test.ts`
  - before/after AI action assertions
  - fixture resolution through the daily hook pipeline
  - match result and event consequences
  - scheduler work and AI memory observation
  - normal, heavy, transfer-window, and season-transition performance metrics
  - representative scale scheduler bound and metadata growth checks
  - repeated match simulation determinism
- `scripts/final-d2.1-regression.ts`
  - 1, 5, 10, and 30-season cases
  - seeds 0 and 1 by default
  - population, fixtures, matches, goals, transfers, promotions, relegations, retirements, youth, manager changes, average age/OVR/potential, finances, league strength, AI memory, and invariant counts
  - same-seed reproducibility and different-seed divergence checks
  - resumable arguments, for example: `npx tsx scripts/final-d2.1-regression.ts 1 0`
- `scripts/canonical-simulation-audit.ts`
  - added population, active/retired player, AI memory, and invariant metrics to `SimulationReport`

## Validation Results

- Prompt 6 focused suite: **12 tests passed** across the scheduler and new regression suite.
- Revenue/scouting/movement affected suites from the preceding determinism audit: **118 tests passed**.
- Strict TypeScript: **passed**.
- Focused ESLint for new suite, scheduler, and long-term runner: **passed**.
- Five-season quick matrix: both seeds completed, but the pre-fix report showed 4,289 and 4,339 invariant findings and false determinism flags. Those reports are superseded by the current invariant-scoped report logic and should not be treated as final.
- Corrected five-season representative matrix: both seeds completed in about 30 seconds each with **0 invariant violations** and seed divergence passing.
- Corrected ten-season representative matrix: both seeds completed in about 90 seconds each with **0 invariant violations** and seed divergence passing.
- Corrected thirty-season representative matrix: seed 0 completed in 54.2 seconds and seed 1 in 21.1 seconds, both with **0 invariant violations** and seed divergence passing.
- Full-engine mode is intentionally too expensive at the project's 1,737-club scale. Long-horizon lifecycle audits use adaptive representative density: 8 clubs per league for short runs, 4 for 10-season runs, and 2 for 30-season runs.

## Remaining Issues

### Critical

None found by the completed focused regression suite.

### Major

The full long-term matrix needs to be run in an unrestricted/long-running CI job or separate process. The current interactive terminal window is not sufficient for the full-world 30-season workload.

The existing canonical audit still contains legacy explicit `any` usage in its historical helper functions; the new runner and new tests do not add those findings.

## Performance

The test suite reports elapsed time and observable work counters without machine-specific pass/fail thresholds:

- clubs evaluated
- expensive AI evaluations
- fixtures processed
- actions executed
- elapsed milliseconds

The scale guard enforces the scheduler's four-club daily bound and bounded scheduler metadata.

## Determinism

The completed regression suite verifies repeated same-seed match results and the existing deterministic scheduler/fixture contracts. The long-term runner performs whole-report same-seed and different-seed checks when completed.

## Recommended Next Phase

Run `scripts/final-d2.1-regression.ts` in CI with a long timeout and archive `outputs/final-d2.1-regression.json`. Review any non-zero invariant counts before starting new gameplay features.
