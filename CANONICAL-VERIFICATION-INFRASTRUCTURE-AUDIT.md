# Canonical Verification Infrastructure Audit

**Date:** 2026-08-20  
**Scope:** Audit only. No gameplay, AI, scheduler, match, transfer, training, or development code was modified.

## Executive Conclusion

The repository has useful typed invariant helpers and several good focused tests, but the canonical long-term verification infrastructure does **not** reliably prove all requested claims.

The most important failure is structural: `canonical-simulation-audit.ts` summarizes each season **after** season transition/pruning. As a result, the recorded 30-season quick regression reports:

- `fixturesScheduled=0`
- `matchesPlayed=0`
- `goals=0`
- `seasonsCompleted=30`
- `invariantViolations=0`

That output is accepted by `final-d2.1-regression.ts` in quick mode because its fixture/match requirement only applies to full mode. Therefore a quick canonical run can pass while proving nothing about match or goal production.

The recorded regression output also says `Same-seed reproducibility: NOT RUN`, because it was invoked with `--no-repeat`.

## Classification Summary

| Claim | Classification | Reason |
|---|---|---|
| Per-season fixture counts | **FAIL** | Counted after season transition/pruning; quick output is zero for every season. |
| Per-season match counts | **FAIL** | Same post-transition state problem; no independent ledger of completed matches. |
| Goals | **FAIL** | Goals are summed from retained played fixtures after pruning; quick output is zero. |
| Completed transfers | **PARTIAL** | Typed `TRANSFER_COMPLETED` events are counted, but retained event history and per-season aggregation are not guaranteed complete. |
| Transfer attempts | **PARTIAL** | Per-season only, based on `event.type === "transfer"`; not included in final aggregate and does not cover every negotiation representation. |
| Promotions/relegations | **PARTIAL** | Typed events are counted, but counts depend on retained events and are not independently reconciled with table movement. |
| Retirements | **PARTIAL** | Uses events plus current player status, but event counts are retention-sensitive and no complete historical ledger is required. |
| Youth generation | **PARTIAL** | Typed events are preferred, with a weak current-state fallback based on initial IDs and age. Historical retention can undercount. |
| Manager changes | **PARTIAL** | Still depends partly on description/action text and retained events. |
| Determinism | **PARTIAL** | Focused unit tests prove deterministic components; canonical same-seed proof is optional, only one case, and was disabled in the recorded run. |
| Full-world simulation | **FAIL** | The default regression path is representative; quick mode intentionally has no real match simulation. |
| Invariant integrity | **PARTIAL** | Many useful checks exist, but they inspect the final retained state and current-season events, not a complete transition ledger. |
| Performance | **UNVERIFIED** | Elapsed time is recorded but no performance budget or pass/fail criterion is enforced. Existing long-term tests avoid full simulation. |

## Infrastructure Reviewed

- `scripts/canonical-simulation-audit.ts`
- `scripts/final-d2.1-regression.ts`
- `src/state/event-invariants.ts`
- `src/state/fixture-maintenance.ts`
- `src/state/multi-season.test.ts`
- `src/state/maintenance-integration.test.ts`
- `src/state/season-lifecycle.test.ts`
- `src/state/player-lifecycle.invariants.test.ts`
- `src/state/ai-fixture-calendar.test.ts`
- `src/state/realistic-season-calendar.test.ts`
- Existing long-term scripts and recorded regression output

## Detailed Findings

### 1. Per-season fixture counts — FAIL

**Source:** `scripts/canonical-simulation-audit.ts`, `summarizePerSeason()`.

The function computes:

```ts
const fixturesInSeason = state.fixtures.filter((f) => f.season === seasonLabel);
```

but it is called after `simulateSeason()` or `simulateSeasonQuick()` has completed and advanced the world. Both season paths remove or replace prior-season fixtures. The full season path explicitly prunes completed fixtures; the quick path filters the previous season and then generates the next season's fixtures.

The existing `fixture-maintenance.ts` helper also exists only as an exported utility. It is imported by `season.ts` but has no call site in that file, so its reports do not establish that production season simulation retains a complete fixture history.

**Evidence:** recorded `outputs/final-d2.1-regression-30-seed-0-1.json` reports zero fixtures in quick mode for all seasons.

### 2. Per-season match counts — FAIL

**Source:** `canonical-simulation-audit.ts`, `captureMetrics()` and `summarizePerSeason()`.

Matches are inferred from `fixture.status === "played"` in the current `state.fixtures`. There is no separate cumulative match ledger passed through the season loop. Once completed fixtures are pruned, the audit cannot recover how many matches were played.

`event-invariants.ts` has `countMatchesPlayed()`, but it also falls back to the current retained fixtures and is not used to build the canonical per-season summaries.

### 3. Goals — FAIL

**Source:** `canonical-simulation-audit.ts`, `summarizePerSeason()` and final aggregation.

Goals are summed from the retained played fixtures:

```ts
played.reduce((sum, f) => sum + f.scoreHome + f.scoreAway, 0)
```

This is valid only if all played fixtures for the season remain available at measurement time. The canonical measurement occurs after transition/pruning, so the metric is not a reliable historical total. The quick 30-year report proving zero goals is direct evidence that this claim is not established.

### 4. Completed transfers — PARTIAL

**Source:** `event-invariants.ts`, `countCompletedTransfers()`.

The preferred source is explicit `TRANSFER_COMPLETED` event type, which is substantially better than text parsing. The focused invariant test confirms that a negotiation-start event is not counted as completed.

Weaknesses:

- The count reads `state.events`, which is a retained/pruned collection rather than an immutable historical ledger.
- `summarizePerSeason()` separately counts lowercase `transfer` events whose description contains `"moved"`, which is a different and weaker definition.
- No reconciliation proves that every actual player movement has exactly one completion event across all seasons.
- The final report does not expose transfer attempts, only completed transfers.

### 5. Transfer attempts — PARTIAL

**Source:** `canonical-simulation-audit.ts`, `summarizePerSeason()`.

The metric is:

```ts
seasonEvents.filter((e) => e.type === "transfer").length
```

This is not a complete attempt definition. It may include listings and other transfer notifications, while typed negotiation/session events may not use the lowercase `transfer` type. It is only present in `SeasonSummary`; `SimulationReport` has no cumulative `transferAttempts` field.

Therefore the infrastructure cannot reliably answer the requested total transfer-attempt question.

### 6. Promotions and relegations — PARTIAL

**Source:** `event-invariants.ts` and `canonical-simulation-audit.ts`.

Explicit `PROMOTION` and `RELEGATION` event types are a good source. Unique-club helpers use `Set` and validate event metadata presence.

Weaknesses:

- The final count is event-based and retention-sensitive.
- `detectPromotionWithoutDivisionChange()` and its relegation counterpart check only current-season events because historical clubs may have moved again. That means they intentionally do not verify historical transitions.
- Canonical validation checks only that a club is not both promoted and relegated in the same season and that event count per club is not greater than one. It does not independently derive expected movement from final standings and compare the result.
- The tests do not run a full multi-season promotion/relegation simulation and reconcile every division movement.

### 7. Retirements — PARTIAL

**Source:** `event-invariants.ts`, `countRetirements()`.

The helper takes the maximum of explicit `PLAYER_RETIRED` events and current players with `status === "retired"`. This is a useful defensive fallback.

Weaknesses:

- Event history may be pruned, while current retired-player state is retained; taking the maximum does not prove event/state one-to-one correspondence.
- Duplicate retirement detection is limited to current-season events.
- The long-term tests mostly check structural properties and do not prove an exact expected retirement count per season.

### 8. Youth generation — PARTIAL

**Source:** `event-invariants.ts`, `countYouthGenerated()` and youth invariant checks.

Explicit `YOUTH_GENERATED` events with `playerId`, age, and DOB checks are reliable for events that remain in state. The lifecycle tests verify malformed youth events are detected, and youth ID uniqueness is tested.

Weaknesses:

- The fallback counts players absent from the initial ID set and age `<= 21`, which is not equivalent to generation and can include players created by other systems or aged/modified records.
- Current-season invariant checks intentionally exclude historical youth events.
- No cumulative immutable youth-generation ledger is used by the canonical report.

### 9. Manager changes — PARTIAL

**Source:** `event-invariants.ts`, `countManagerChanges()` and `canonical-simulation-audit.ts`.

Explicit `manager` events are counted, but milestone/board events are classified with text checks for `manager`, `sacked`, `appointed`, or `change`. This directly violates a fully authoritative typed-metric standard.

Because event retention is finite, historical manager changes can disappear from the count. There is also no reconciliation against manager identity/tenure history.

### 10. Determinism — PARTIAL

**Reliable parts:**

- `ai-manager-identity.test.ts` proves identical inputs/generation produce identical manager identity.
- `ai-fixture-calendar.test.ts` proves repeated fixture resolution produces the same score and is exactly once.
- `final-d2.1-regression.test.ts` proves repeated match-engine calls with the same seed produce the same final score.
- `final-d2.1-regression.ts` can compare a repeated canonical report.

**Weaknesses:**

- Same-seed canonical rerun is optional and can be disabled with `--no-repeat`.
- The recorded 30-year regression explicitly reports `Same-seed reproducibility: NOT RUN`.
- When enabled, only the first requested year/seed case is repeated, not every case.
- It compares `JSON.stringify(report)`, not full final state, event ordering, fixture ordering, player/club records, or all side effects.
- Different-seed divergence is not a determinism proof; it only checks that selected summary fields differ.
- Several harnesses perturb dates from a common seed rather than exercising independent seeded initial worlds, which complicates interpretation of seed behavior.

### 11. Full-world simulation — FAIL

**Source:** `final-d2.1-regression.ts`.

The script defines:

```ts
const representative = !process.argv.includes("--full-world");
```

Therefore the default regression run is representative, not full-world. For 30-year runs it selects only 2 clubs per league. The recorded output states:

```text
World scope: representative
Representative density: 2 clubs per league
```

`buildRepresentativeState()` removes clubs, players, fixtures, matches, and many transfer listings before simulation. Results from this mode cannot prove full-world counts or integrity.

Quick mode is an additional limitation: `simulateSeasonQuick()` does not simulate real fixtures, and the recorded quick report has zero fixtures, matches, and goals.

The full-world option exists, but there is no evidence in the reviewed output that the required full-world runs were completed and validated.

### 12. Invariant integrity — PARTIAL

**Source:** `event-invariants.ts`, `checkAllInvariants()`.

The invariant suite covers meaningful local consistency checks:

- duplicate transfer completion events
- transfer completion references/movement
- current-season promotion/relegation division mismatch
- retirement state and duplicate retirement events
- youth event validity and player creation
- match event/result consistency
- player duplication
- age validity/drift
- squad references
- negative manager-club balance

Focused lifecycle tests prove several detectors can identify deliberately malformed states.

Weaknesses:

- `checkAllInvariants()` runs once on the final state, not after every transition or every season.
- Many checks intentionally restrict themselves to current-season or retained events.
- It does not verify fixture count expectations, complete match count, goal totals, or complete transfer-attempt accounting.
- It cannot detect historical corruption after event/fixture pruning.
- A zero final violation count means only that the retained final snapshot passed these checks, not that the entire simulation history was valid.

### 13. Performance — UNVERIFIED

**Source:** `final-d2.1-regression.ts`, `scripts/long-term-sim.ts`, and existing tests.

The canonical regression records `elapsedMs`, but no threshold is checked and no performance result affects `checks` or process exit status. `scripts/long-term-sim.ts` prints no elapsed timings at all.

The existing `multi-season.test.ts` explicitly states that full simulation tests are skipped because a season can take 120+ seconds. The performance-focused tests use seeded or representative states and local day windows, not a full-world long-career budget.

Therefore the infrastructure can collect timing in some paths, but it does not reliably prove a performance claim.

## Event Text / Description Dependencies

The following requested metrics still depend on text or semi-structured descriptions:

- **Completed transfers in per-season summaries:** `event.type === "transfer"` plus `description.includes("moved")`.
- **Manager changes:** typed `manager` events are supplemented by text checks for `manager`, `sacked`, `appointed`, and `change` in descriptions/actions.
- **Older long-term harnesses:** `scripts/simulate-world.ts` and `scripts/simulate-world-fast.ts` count transfers, promotions, relegations, and manager changes using event type, `meta.action`, or description regexes.
- **Maintenance tests:** transaction verification uses descriptions containing `"stadium maintenance"` and `"training ground maintenance"`; this is acceptable for those focused tests but is not an authoritative simulation metric.

Typed event metrics in `event-invariants.ts` are preferable, but they do not eliminate text dependency from the canonical per-season summaries or legacy harnesses.

## Retained / Pruned State Dependencies

| Metric | Retained/pruned dependency |
|---|---|
| Fixtures | Directly dependent on `state.fixtures`; completed seasons are removed/replaced before canonical summarization. |
| Matches | Dependent on retained played fixtures; event fallback is also retained-state dependent. |
| Goals | Dependent on retained played fixtures and their scores. |
| Completed transfers | Dependent on retained `TRANSFER_COMPLETED` events. |
| Transfer attempts | Dependent on retained lowercase `transfer` events. |
| Promotions/relegations | Dependent on retained typed events; historical invariant checks intentionally exclude old seasons. |
| Retirements | Events may be pruned; current player status is retained and used as a fallback. |
| Youth | Events may be pruned; fallback uses current player set versus initial IDs. |
| Manager changes | Dependent on retained events and their descriptions. |
| Invariants | Mostly inspect the final retained snapshot and current-season events. |

The quick compaction path further prunes events, news, inbox, player career history, career history, and season reports. It therefore cannot be used as proof of historical completeness.

## Representative vs Full-World Separation

**Classification: PARTIAL at the infrastructure level, FAIL as evidence in the recorded run.**

The code has an explicit `--full-world` switch and records the `representative` flag in JSON. That separation is clear in code.

However:

- Representative mode is the default in `final-d2.1-regression.ts`.
- 30-year representative density is only 2 clubs per league.
- `buildRepresentativeState()` filters the initial world before simulation.
- The recorded regression output used representative mode.
- Quick mode produces no real fixture/match/goal evidence.

Thus the modes are named clearly, but the standard recorded result is not evidence about the full world.

## Whether Existing Tests Prove Their Claims

### What tests do prove

- Fixture generation has date-window, home/away balance, duplicate-date, and scheduling-shape checks in `realistic-season-calendar.test.ts`.
- Today's AI fixture is processed once, future fixtures remain scheduled, and manager fixtures remain untouched in `ai-fixture-calendar.test.ts`.
- Season initialization occurs once at August 1 and remains stable after save/load in `season-lifecycle.test.ts`.
- Several lifecycle invariant detectors identify deliberately malformed states in `player-lifecycle.invariants.test.ts`.
- Same-input match simulation is deterministic in `final-d2.1-regression.test.ts`.
- Scheduler metadata is cadence-limited and bounded at the tested representative scale.
- Basic state shape and one-day/7-day/30-day advancement work in `multi-season.test.ts`.

### What tests do not prove

- They do not prove complete per-season fixture totals across a full simulation.
- They do not prove complete per-season match totals or goals.
- They do not prove full-world transfer attempts or completed transfers.
- They do not prove exact historical promotion/relegation, retirement, youth, or manager-change totals after pruning.
- They do not prove full-world determinism across final state and all event/fixture orderings.
- They do not prove a long-career performance budget; the multi-season suite explicitly avoids full simulation.
- They do not prove that zero invariant violations means the entire historical run was valid.

## Final Audit Status

The current infrastructure is suitable for **focused component regression and local invariant checks**. It is not yet a reliable canonical oracle for complete long-term world claims.

The strongest current claims are:

- selected fixture-generation rules
- selected exactly-once fixture behavior
- selected deterministic pure functions
- selected final-snapshot invariants
- selected state-shape and lifecycle guards

The following claims remain unproven or invalid under the current canonical setup:

- complete per-season fixtures, matches, and goals
- complete full-world transfer/attempt counts
- complete historical lifecycle totals after pruning
- full-world simulation behavior from the recorded default regression
- unconditional deterministic reproduction
- performance budget compliance

**Audit stopped here. No code changes were made.**
