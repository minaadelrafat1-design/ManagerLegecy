# Manager Legacy Step 2A.1: Match/Fixture Invariant Retention Audit

**Date:** 2026-08-20  
**Scope:** Verification infrastructure only  
**Gameplay behavior changed:** No

## 1. Root Cause of `MATCH_PLAYED_MISSING_FIXTURE`

The original invariant treated `Fixture.id` as a globally unique historical identifier and required every `MATCH_PLAYED` event to resolve to a currently retained fixture.

The actual lifecycle is:

```text
fixture generated
  -> status = scheduled
  -> match executed through RECORD_MATCH_RESULT
  -> fixture status = played with score
  -> MatchRecord appended to state.matches
  -> MATCH_PLAYED event appended with fixtureId, teams, and score
  -> season transition removes completed/previous-season fixtures
  -> MatchRecords and match events remain
  -> final invariant runs against retained fixtures plus historical matches/events
```

Two retention facts matter:

1. A completed fixture can legitimately be absent after season pruning.
2. Fixture IDs are generated from the maximum retained `f-N` ID. After old fixtures are pruned, a later season can reuse an ID such as `f-1`. Therefore a historical `fixtureId` alone is not sufficient to select one MatchRecord.

The initial pruning-aware fix handled missing fixtures by looking for a MatchRecord, but the five-season audit showed that reused IDs caused multiple historical matches/events to be compared against the wrong single record. The final verification contract now matches historical evidence by the complete result identity: fixture ID, played date, home club, away club, and score.

## 2. Classification

`MATCH_PLAYED_MISSING_FIXTURE` was verification corruption in the post-pruning state, not gameplay corruption.

The matches did execute correctly:

- One season: 4,548 MatchRecords and 5,594 goals.
- Five seasons: 22,692 MatchRecords and 47,948 goals.

The original 140,808 violations were false positives from demanding a currently retained fixture for historical matches. The intermediate mismatch violations were also verification defects caused by assuming fixture IDs were globally unique across pruned seasons.

## 3. Exact Lifecycle Discovered

### Fixture creation and scheduling

`src/state/season.ts` generates league fixtures with:

- season
- competition
- home/away clubs
- calendar date
- `scheduled` status
- fixture ID

### Match execution

`src/state/ai-fixture-calendar.ts` selects only eligible fixtures for the current date and season. `src/lib/ai-match-adapter.ts` runs the match engine and passes results to `applyAiFixtureResults()`.

`src/state/reducer.ts` handles `RECORD_MATCH_RESULT`:

- updates the matching scheduled fixture to `played`;
- writes `scoreHome` and `scoreAway`;
- appends a `MatchRecord` to `state.matches`;
- appends a `MATCH_PLAYED` event containing fixture ID, teams, and score;
- rejects an identical replay to preserve exactly-once behavior.

### Pruning

`src/state/season.ts` removes completed/previous-season fixtures during full season transition. `state.matches` and `MATCH_PLAYED` events are not removed by that fixture filter.

### Invariant check

The old invariant searched only `state.fixtures`, so it could not distinguish legitimate pruning from corruption. The new checks use:

- retained fixture evidence when the fixture remains;
- historical `MATCH_PLAYED` event evidence when the fixture is pruned;
- `MatchRecord` evidence for the completed result;
- date, teams, and score to disambiguate reused fixture IDs.

## 4. Correct Verification Contract

The invariant now checks all of the following:

1. Every retained `played` fixture has a matching `MatchRecord` with the same date, teams, and score.
2. Every `MatchRecord` has a fixture ID.
3. Every `MatchRecord` has either a matching retained fixture or matching `MATCH_PLAYED` historical event.
4. Every pruned `MATCH_PLAYED` event has a matching historical `MatchRecord`.
5. Event and MatchRecord teams, date, and scores agree.
6. Mismatched evidence fails explicitly.
7. A fully orphaned MatchRecord/event relationship fails explicitly.
8. Legitimate fixture pruning does not fail.
9. Reused fixture IDs across seasons are matched by complete historical result identity, not ID alone.

## 5. Files Changed

- `src/state/event-invariants.ts`
- `src/state/match-retention.invariants.test.ts`
- `STEP-2A.1-MATCH-FIXTURE-INVARIANT-RETENTION-AUDIT.md`

No gameplay files were changed. No AI, scheduler, transfer, training, development, match simulation, fixture generation, season progression, maintenance, finance, or manager behavior was changed.

## 6. Tests Before

Before the Step 2A.1 change:

```text
src/state/player-lifecycle.invariants.test.ts
src/state/integration-and-stability.test.ts
src/state/ai-fixture-calendar.test.ts

3 files passed
33 tests passed
```

The canonical five-season baseline reported:

```text
invariantViolations: 140808
invariantBreakdown: {
  MATCH_PLAYED_MISSING_FIXTURE: 140808
}
```

## 7. Tests After

TypeScript:

```text
npx tsc --noEmit
PASS
```

Focused tests:

```text
src/state/match-retention.invariants.test.ts
src/state/player-lifecycle.invariants.test.ts
src/state/integration-and-stability.test.ts
src/state/ai-fixture-calendar.test.ts

4 files passed
39 tests passed
```

The new retention suite covers:

- match executes before pruning;
- MatchRecord exists after execution;
- fixture can be absent after pruning;
- historical event and MatchRecord evidence remains valid;
- corrupted historical MatchRecord fails;
- retained played fixture without MatchRecord fails.

## 8. Canonical Results After the Fix

### One season

```text
1 seasons seed 0
fixtures=84
matches=4548
goals=5594
invariants=0
```

The process still exits nonzero because the existing regression command reports a separate different-seed divergence condition when only one seed is supplied. The match/fixture invariant count is zero.

### Five seasons

```text
5 seasons seed 0
fixtures=84
matches=22692
goals=47948
invariants=0
```

Again, the command reports a separate malformed/different-seed status for the single-seed invocation, but the match/fixture invariant count is zero.

## 9. Proof Genuine Corruption Is Still Detected

The new test mutates a historical MatchRecord score from `2` to `9` while keeping the event score at `2-1`. The invariant reports historical result mismatch violations, including:

- `MATCH_PLAYED_HISTORICAL_RESULT_MISMATCH`
- `MATCH_RECORD_RESULT_MISMATCH`

A retained played fixture with no MatchRecord produces:

- `PLAYED_FIXTURE_MISSING_MATCH_RECORD`

A MatchRecord with no fixture and no matching historical event produces:

- `MATCH_RECORD_MISSING_HISTORICAL_EVIDENCE`

Thus the fix does not remove or weaken corruption detection.

## 10. Proof Legitimate Pruning Is Accepted

The new legitimate-pruning test removes the fixture from `state.fixtures` while retaining:

- the completed MatchRecord;
- the matching `MATCH_PLAYED` event;
- identical date, teams, and score.

The test asserts zero violations from both the match-event check and aggregate invariant check. It passes.

The one-season and five-season canonical full-path runs also pass with zero match/fixture invariant violations after normal season pruning.

## 11. Remaining Limitations

- Fixture IDs are reused after pruning. The invariant now handles this by matching date, teams, and score, but a future durable fixture identity would make the contract simpler.
- The canonical regression remains representative by default; full-world execution is separate and expensive.
- The regression command’s single-seed invocation can still exit nonzero for its unrelated different-seed divergence check. This does not indicate a match/fixture invariant failure.
- Historical event and MatchRecord collections are still the available durable evidence. If either is later pruned, the invariant will correctly report missing historical evidence rather than silently accept it.
- This task intentionally did not address historical metric collection, determinism, performance, or broader event retention.

**Step 2A.1 complete. Stopped after the requested invariant retention audit and verification changes.**
