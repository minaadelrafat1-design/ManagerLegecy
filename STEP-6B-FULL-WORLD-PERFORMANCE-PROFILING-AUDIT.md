# STEP 6B — FULL-WORLD SIMULATION PERFORMANCE PROFILING

## Scope

This is a diagnostic-only audit of the full-world bottleneck identified in the 30-year full-world run and the prior full-world runtime diagnosis.

- Goal: identify exactly why Season 1 full-world simulation becomes too slow
- Execution path: current production code only, no gameplay or simulation rule changes
- Temporary instrumentation allowed, but no production behavior or canonical simulation altered
- Stop point: profiling only, no fixes

## Executive summary

The measured live full-world path shows that the dominant cost is not the raw match calculation itself. The dominant cost is the result-application path after each match is calculated:

- `simulateAiFixtureViaEngine()` is relatively cheap
- `applyAiFixtureResults()` / `RECORD_MATCH_RESULT` is dramatically more expensive per fixture
- the reducer performs large immutable state rebuilds, per-player morale/form updates, event appends, match appends, club memories, and consequence processing on each result
- at full-world scale, that cost compounds across ~35,000 fixtures per Season 1

This matches the earlier full-world report: the runtime burden is not in the collector, but in the simulation pipeline itself.

## Diagnostic method

The audit used the live canonical production path and direct timing around the real full-world setup stages.

Measured live stages:

1. `buildInitialState()`
2. `generateLeagueFixtures()`
3. `runEnhancedTransferWindow()`
4. `simulateAiFixtureViaEngine()` on live fixtures
5. `applyAiFixtureResults()` on live fixture batches
6. JSON serialization of the resulting state

### Command used

```bash
npx tsx -e "...live profiling script..."
```

The script measured:

- club and player counts
- generated full-world fixture count
- initialization time
- fixture generation time
- transfer-window time
- per-fixture simulation time
- per-fixture result-application time
- serialization time

No production code was modified.

---

## Measured live full-world setup

### World scale

```json
{
  "clubs": 1737,
  "players": 41521,
  "leagues": 81,
  "initialFixtures": 108,
  "generatedFixtures": 35717,
  "scheduledFixtures": 35717
}
```

### Timing snapshot

| Stage | Time |
|---|---:|
| `buildInitialState()` | 15.96 ms |
| `generateLeagueFixtures()` | 2,519.64 ms |
| `runEnhancedTransferWindow()` | 3,725.11 ms |
| Full generated scheduled fixture set | 35,717 fixtures |
| `JSON.stringify(state)` after full-world setup | 226.36 ms |

### Observations

- The world initialization itself is not the bottleneck.
- Fixture generation is significant but not catastrophic on its own.
- The transfer window is also expensive, but still smaller than the per-result state application path measured below.
- The primary cost emerges when scheduled fixtures are converted into applied results and state is rewritten.

---

## Exact bottleneck ranking

### 1) Match result application (`applyAiFixtureResults()` / `RECORD_MATCH_RESULT`)

This is the dominant bottleneck.

Measured live sample (whole result path, not the bare match engine):

| Sample size | `simulateAiFixtureViaEngine` total | `applyAiFixtureResults` total | Per fixture simulated | Per fixture applied |
|---|---:|---:|---:|---:|
| 10 fixtures | ~36.7 ms total | ~360.2 ms total | ~3.67 ms | ~36.0 ms |
| 100 fixtures | ~113.8 ms total | ~3,659.6 ms total | ~1.14 ms | ~36.6 ms |
| 1,000 fixtures | ~1,250.6 ms total | ~36,058.6 ms total | ~1.25 ms | ~36.1 ms |

This is the clearest measured result:

- match generation itself is about 1.1–3.7 ms per fixture
- result application is about 36 ms per fixture
- application is roughly 10x–30x more expensive than simulation

This is not a minor difference. At 35,717 fixtures, that cost pattern translates to a major full-season expense even before any repeated loops or European competitions are included.

### 2) Reducer-level immutable state rewriting

The measured cost is consistent with the actual reducer implementation in [src/state/reducer.ts](src/state/reducer.ts):

- state.fixtures is remapped
- state.players are cloned and updated per club
- state.matches is appended
- state.events is appended
- club memory is appended
- consequence handlers are applied
- manager confidence and pending fixture state may be updated

The reducer does far more than record a score. It rebuilds large parts of the game state for each result.

### 3) Full-world fixture generation

Measured live:

- 2.52 s for generating 35,717 fixtures

This is material, but it is not the full-season bottleneck when compared to the result application cost.

### 4) AI transfer window

Measured live:

- 3.73 s

This is not trivial, but again it is smaller than the cost of the repeated match-result state application across the season.

### 5) Serialization and audit output

Measured live:

- `JSON.stringify(state)` after that setup: 226 ms
- serialized size: ~55.8 MB

This is visible overhead, but not the root cause of the full-season blowup. It is secondary.

---

## Why the bottleneck is not the raw match engine

The raw match calculation is comparatively light:

- `simulateAiFixtureViaEngine()` does a club lookup, builds input teams, runs `simulateMatch()`, and returns a score
- measured cost is roughly 1–3 ms per fixture

By contrast, the result application path does:

- fixture lookup by ID
- `fixtures.map()` over the whole list
- per-club player mutation loops
- match/event append
- consequence resolution
- memory writes and manager confidence updates
- possible pending fixture lock clearing

This is precisely the pattern one would expect from a high-CPU immutable-update pipeline.

---

## Unnecessary repeated work inside the match loop

The following patterns are strong candidates for repeated full-world work:

### A. Whole-fixture-array remapping for each result

In `RECORD_MATCH_RESULT`, the reducer maps the entire `fixtures` array to update one fixture.

- cost grows with total fixtures, not just the current match
- at 35,717 scheduled fixtures, this is repeated repeatedly across the full season

### B. Whole-player-object copies per club

For each match, the reducer mutates player morale/form/market value for both clubs.

- `nextPlayers = { ...nextPlayers }` only happens once per club when needed, but the loop itself still visits every player in the club roster
- this expands with roster size, which is substantial in the full-world state

### C. Match/event append and consequence processing for each fixture

Each applied result adds:

- a `MatchRecord`
- a MATCH_PLAYED event
- club memory items
- consequence side effects

This is valid gameplay logic, but it is a large amount of per-match work at full-world scale.

### D. Repeated full-world scans in the season loop

The main season loop in [src/state/season.ts](src/state/season.ts) repeatedly does:

- collect all scheduled fixtures
- simulate them
- apply them
- rerun cup logic
- rerun European competition loops

That is a broad full-world scan pattern, and it compounds the cost of each result application.

### E. No evidence of a simple historical/audit collector bottleneck

The earlier audit concern was valid, but in this measured live path the collector does not dominate runtime.

The actual cost is in the live simulation state mutation path.

---

## Historical/audit collection contribution

### Direct conclusion

The current historical/audit collection is not the main runtime driver.

Why:

- the canonical collector is separate from the live season simulation path
- the measured slow path is inside the state updates triggered by `RECORD_MATCH_RESULT`
- the earlier performance report showed the collector itself is small relative to the simulation work

The audit layer does add extra memory/serialization overhead when the report is generated, but it is not the primary reason the full-world Season 1 stalls.

---

## Season 1 runtime estimate

A precise full Season 1 runtime cannot be claimed from the bounded profiling run because the full-world season with all 35,717 fixtures was not allowed to finish in the current execution window.

However, the measured behavior gives a reliable lower bound:

- simulated match work: ~1–3 ms each
- applied result work: ~36 ms each
- full-world fixture count: ~35,717

A rough lower-bound estimate from the per-result path alone is:

$$
35{,}717 \times 36\text{ ms} \approx 1.28\text{ s}
$$

That is only the direct application portion, and it is already a dramatic cost relative to the raw simulation work.

In practice, the system also does repeated scans, consequence logic, and additional state updates. The actual full Season 1 runtime is therefore likely to be substantially above this lower bound, which is consistent with the earlier report that the full-world season did not finish within the available runtime window.

### Practical estimate

- likely lower-bound cost for the live result-application path: approximately 1–2 seconds for the pure match-result pass alone
- realistic full Season 1 cost in this environment: at least tens of seconds, and likely much higher once repeated loops, club updates, and consequence logic are included
- prior live observations in the full-world report support a runtime that exceeds two minutes before Season 1 completes

---

## Estimated 30-year runtime

A full 30-year estimate is inherently uncertain without a complete long-run execution, but the structure of the measured costs makes it clear that the runtime problem is systemic rather than isolated.

If the full-world Season 1 is already too slow and the same per-result churn is repeated for each season, then the 30-year path is not a moderate extension; it is a cumulative cost problem.

### Best available estimate

- Full-world Season 1: not completed in the current bounded run
- 30-year full-world total: extrapolation is not trustworthy without a completed long-run trace
- but the current evidence strongly suggests a multi-minute to multi-hour full-world 30-year run, not a short or practical automated validation workload

This is consistent with the earlier conclusion: the current full-world simulation is not practically suitable as a 30-year validation gate without future optimization.

---

## Smallest safe optimization targets for a future step

The goal here is not to fix anything now, only to identify future targets that are likely to be safe and effective.

### Highest-priority future target

1. Reduce per-match immutable state churn in `RECORD_MATCH_RESULT`
   - avoid whole-array remaps where only one fixture changes
   - avoid unnecessary full-state rebuilds during result application

### Second-priority target

2. Separate match-result recording from consequence processing
   - do the minimal state update first
   - then apply consequence processing as batch operations when possible

### Third-priority target

3. Reduce repeated scans in the season loop
   - track scheduled fixtures and results in a compact index
   - update competition caches only when needed

### Fourth-priority target

4. Keep per-player mutation work bounded
   - only update players who actually participated in the fixture
   - avoid unrelated club-wide loops when not required

### Fifth-priority target

5. Keep the historical/audit ledger independent from live state pruning
   - do not make the verification ledger do expensive live-state reconstruction

These are the smallest defensible optimization targets because they target the observed bottleneck directly without altering match outcomes or gameplay rules.

---

## Final conclusion

The live profiling result is clear:

- the bottleneck is not in the collector
- the bottleneck is in the state application path after match simulation
- `RECORD_MATCH_RESULT` and the surrounding immutable reducer updates are the primary cost driver
- the performance problem is real at full-world scale and scales with the number of scheduled fixtures and state mutations
- fixture generation and transfer processing are nontrivial but secondary compared to per-result state application

This means the proper next phase is not a match-engine rewrite based on guesswork. The proper next phase is a focused audit of the reducer and per-match state-update path to identify the smallest safe reduction in churn.

## Stop point

This is the stop point for Step 6B.

No gameplay rule changes, no match-result changes, no RNG changes, no fixture count reductions, no production optimizations, and no canonical-simulation redesign were made.

This file is the complete profiling record.
