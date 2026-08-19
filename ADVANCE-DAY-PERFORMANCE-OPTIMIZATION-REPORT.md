# Advance Day Performance Optimization Report

Date: 2026-08-20

## Result

The real Advance Day path was instrumented and several confirmed repeated-work issues were fixed. The mature-career stress test exposed a severe unresolved performance cliff, so this pass does not claim production readiness.

## Before and After Evidence

| Scenario | Days | Before average | After average | Before maximum | After maximum |
|---|---:|---:|---:|---:|---:|
| Fresh seeded state, 7-day run | 7 | 877.97 ms | 1,161.90 ms | 1,161.16 ms | 1,461.98 ms |
| Fresh seeded state, continuation to 30 days | 23 | 1,044.07 ms | 1,794.61 ms | 3,276.29 ms | 5,732.78 ms |
| Five-season mature state, 30 days | 30 | 28,706.86 ms | Not completed | 199,253.62 ms | Not completed |

The fresh runs are noisy wall-clock measurements and do not demonstrate a speedup. They do demonstrate that the instrumentation captures real hook timings and that state progression remains active. The mature baseline is a failure: 28.7 seconds average per day and a 199.3-second maximum.

Mature baseline state metrics:

- Players: 44,979
- Clubs: 1,737
- Fixtures: 35,756
- Events: 7,104 at the first measured day, with large daily swings
- Transfers: approximately 3,492 to 3,507
- Negotiations: approximately 1,707 to 6,297
- Inbox: approximately 7,101 to 17,268
- State size decreased by 7.91 MB during the 30-day run because archival ran

## Slowest Subsystems

### Mature baseline

- `src/state/events-engine.ts` and other `events` registrations: 523,035 ms total, 17,434 ms average per day. The worst event days reached approximately 83,599 ms.
- `src/state/ai-fixture-calendar.ts` through `src/lib/ai-match-adapter.ts`: 238,543 ms total, 7,951 ms average per day. The mature state scans 35,756 fixtures daily to locate today's fixtures.
- `src/state/ai-evolution.ts`: 40,205 ms total, 1,340 ms average per day on monthly/seasonal due days.
- AI transfer and scheduler hooks: 22,170 ms total, 739 ms average per day.

### Confirmed optimizations applied

- `src/state/ai-world-scheduler.ts`: consolidated multiple full event scans into one pass; removed construction of one-event temporary states.
- `src/state/events-engine.ts`: removed an unused `eventsByDate` index, retained direct event indices while scanning, and replaced manual 90-day date arithmetic with `addDaysISO`.
- `src/state/inbox.ts`: replaced repeated `existing.some(...)` inbox duplicate checks with an active-message dedupe key set. This targets the confirmed mature O(events x inbox) path.
- `src/state/ai-contracts.ts`: moved the weekly/expiry due checks ahead of full club-player indexing, avoiding a 45k-player scan on ordinary days.
- `src/state/ai-transfers.ts`: gated high-volume transfer diagnostics behind `AI_TRANSFER_DEBUG = false`.
- `src/state/performance-monitor.ts`: stopped serializing and retaining every console message when no explicit profiling session is active.
- `src/state/reducer.ts`: short-circuits blocked Advance Day actions before fixture scanning and season-finalization plumbing.
- `src/state/calendar.ts`: exposed Node profiling APIs and added individual registered-hook timing keys while retaining aggregate group timings.
- `src/state/persistence.ts`-era archival typing fixes in `src/state/finance.ts` and `src/state/world-history.ts`: corrected strict TypeScript errors without changing retention behavior.

An experimental morale cache in `src/lib/ai-match-adapter.ts` was removed after adapter tests showed that the cache identity assumptions were unsafe. No fixture cache remains.

## Workload Map

Daily hook order is:

1. fixtures
2. training
3. recovery
4. injuries
5. development
6. ai
7. scouting
8. finances
9. events
10. news

Confirmed guards:

- AI fixture processing checks `status`, current date, current season, and manager-club exclusion.
- Development performs full evolution only on monthly/year-opening/season-opening dates.
- AI transfers return immediately outside transfer windows and on non-evaluation days.
- Season finalization and fixture generation have existing lifecycle guards.

## Validation

- TypeScript: `npx tsc --noEmit` passed with no output after the changes.
- Focused scheduler/calendar/regression tests: 31 passed.
- Inbox/calendar/regression tests: 50 passed.
- Daily pipeline script: all checks passed.
- AI match adapter: 4/5 passed; one existing underdog-outcome assertion failed even after the unsafe cache was removed.
- Transfer-month simulation: 3/4 passed; the 30-day performance assertion failed repeatedly at approximately 324-370 ms average against a 300 ms threshold. The test was blocked by the manager fixture for 29 of 30 days.
- Full existing suite: started, but the long run was stopped without an aggregate summary. Output showed failures in `office-finance.test.ts` (4 tests), the AI adapter underdog assertion, transfer-month performance, and match-integration performance. Do not interpret this as a clean full-suite pass.
- Lint: nonzero. The repository contains broad existing Prettier and explicit-`any` violations; no automatic bulk formatting was applied.
- Production build: intentionally not run, per the task instruction.

## Remaining Limitations

### Confirmed unresolved issues

- Five-season mature Advance Day remains unusably slow. The baseline reached 199 seconds for one day.
- Mature event processing is the dominant subsystem, but the current group timing still combines many `events` registrations. Individual-hook timing was added, but the follow-up mature probe was stopped before it produced a day result.
- Mature fixture processing is also a major cost due to repeated scans and full match-engine setup across the large fixture collection.
- The full suite is not green in this environment.

### Future optimization opportunities

- Add a persistent date-to-fixture index maintained when fixtures are generated or results are recorded.
- Split individual `events` registrations in mature profiling and optimize the worst owner first, likely event-to-inbox conversion or event consequence processing.
- Replace repeated relationship `.find()` scans with an indexed relationship lookup if profiling confirms it as a major event-hook contributor.
- Add a realistic save-load stress fixture so mature testing does not depend on the expensive five-season setup path.
- Establish a development-only performance budget report that records slow hooks without skipping gameplay.

### Environment/testing limitations

- The workspace path has no Git metadata, so no diff/status comparison was available.
- Browser-level measurements against the running application were not available from the current terminal-only environment.
- The five-season setup is itself expensive and the post-change 30-day mature run was stopped before completion; therefore no after-result is claimed for mature careers.

## Files Changed

- `src/state/calendar.ts`
- `src/state/ai-world-scheduler.ts`
- `src/state/ai-transfers.ts`
- `src/state/events-engine.ts`
- `src/state/performance-monitor.ts`
- `src/state/reducer.ts`
- `src/state/finance.ts`
- `src/state/world-history.ts`
- `src/state/inbox.ts`
- `src/state/ai-contracts.ts`
- `scripts/phase-1-baseline-measurements.ts`
- `ADVANCE-DAY-PERFORMANCE-OPTIMIZATION-REPORT.md`

No production build was generated.
