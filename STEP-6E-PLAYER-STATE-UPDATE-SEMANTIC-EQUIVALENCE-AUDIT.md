# STEP 6E - PLAYER STATE UPDATE PERFORMANCE & SEMANTIC EQUIVALENCE AUDIT

## Status

Diagnostic-only audit complete. No production code was modified.

No Step 6F work was started.

## Goal and scope

Step 6D measured player-state updates and immutable player dictionary work at approximately 91% of the `RECORD_MATCH_RESULT` cost. This audit determines whether that work can be optimized while preserving exact behavior.

The audit covered:

- starter and non-starter behavior;
- rating fallback behavior;
- morale, form, reputation, and market-value updates;
- `lastMatchRating`;
- bounded `matchRatingHistory`;
- player dictionary cloning;
- sequential reducer semantics;
- immutable state and object-identity behavior;
- existing match, integration, retention, and batch-equivalence tests.

## Exact source of the 91% cost

The owning path is `src/state/reducer.ts`, in the `RECORD_MATCH_RESULT` case.

For each result, the reducer calls `applyResultToClub()` twice, once for the home club and once for the away club. Each call traverses every ID in that club's `playerIds` array:

```text
for each player ID in home roster
for each player ID in away roster
```

For every existing player, the path performs all of the following:

1. Reads the current player from `nextPlayers`.
2. Reads the starter flag.
3. Resolves the rating from `action.playerRatings[pid]`, then `p.lastMatchRating`, then `5`.
4. Computes starter/non-starter morale deltas.
5. Applies the loss-only non-starter morale penalty.
6. Applies rating thresholds at `7.5` and `4.5`.
7. Clamps morale to `[0, 100]`.
8. Computes starter/non-starter form deltas.
9. Adds the rounded rating adjustment using `Math.round((rating - 5) * 1.8)`.
10. Clamps form to `[0, 100]`.
11. Computes reputation thresholds at `8` and `4`.
12. Clamps reputation to `[0, 100]`.
13. Computes the age factor with the `[0.75, 1.25]` clamp.
14. Computes and clamps market-value change.
15. Allocates a new rating-history array and retains only the last five ratings.
16. Allocates a new player object with all fields copied and the seven updated fields replaced.
17. Writes the new player into the copied player dictionary.

The player dictionary itself is copied lazily once per result, on the first valid player update:

```ts
if (!playersCopied) {
  nextPlayers = { ...nextPlayers };
  playersCopied = true;
}
```

The dictionary spread is a major allocation, but the Step 6D profile correctly grouped it with the much larger roster traversal and per-player calculation/object/history allocation. The dominant cost is therefore the whole player-update transaction, not only the one dictionary spread.

Step 6D's 1,000-result profile measured:

| Component | Time | Share |
|---|---:|---:|
| Player updates plus player dictionary cloning | 35,175.83 ms | 91.22% |
| Club memory writes | 1,924.09 ms | 4.99% |
| Consequence processing | 1,097.83 ms | 2.85% |
| Repeated fixture/state scans | 119.99 ms | 0.31% |
| Fixture update | 149.00 ms | 0.39% |
| Match/event updates | 9.79 ms | 0.03% |
| Manager confidence/pending-fixture updates | 34.36 ms | 0.09% |

The measured profile is consistent with the code: the expensive work scales with the two participating squad sizes and the number of player object/history allocations, while the match/event arrays and manager updates are comparatively negligible.

## Semantic contract of the current path

### Which players are updated

Every valid player ID listed in both participating clubs' `playerIds` arrays is updated, including starters and non-starters. The code does not restrict updates to the eleven selected players or to players with an explicit rating.

Changing this set would change gameplay behavior and is explicitly prohibited.

### Starter and non-starter behavior

The starter flag is read from the current player object for each result. It affects:

- win morale: `6` starter, `3` non-starter;
- draw morale: `1` starter, `0` non-starter;
- loss morale: `-6` starter, `-3` non-starter, with an additional `-1` non-starter loss penalty;
- win form: `8` starter, `4` non-starter;
- draw form: `2` starter, `1` non-starter;
- loss form: `-8` starter, `-4` non-starter.

A cached starter classification is only exact if it is derived from the current sequential state for every result. A season-level cache could become stale after tactics, AI actions, transfers, injuries, or other player updates.

### Rating fallback behavior

The rating resolution order is exact and state-dependent:

```text
playerRatings[pid] ?? p.lastMatchRating ?? 5
```

The nullish behavior matters. A supplied rating of `0` is accepted, while `undefined` or `null` falls through. Replacing this with truthiness, precomputed defaults, or a batch rating map can change reputation, morale, form, market value, and history.

### Derived player fields

The update changes all of these fields on every valid player visit:

- `morale`;
- `form`;
- `reputation`;
- `marketValue`;
- `lastMatchRating`;
- `matchRatingHistory`.

The calculations use the player's current values at that exact sequential point. A later match must see the previous match's updated values. This makes deferred or batched calculation unsafe unless it is proven to reproduce the same intermediate state for every player.

### Sequential reducer semantics

`applyAiFixtureResults()` calls `gameReducer()` once per result. The next result receives the complete state returned by the preceding reducer call.

This means a future optimization must preserve:

- result order;
- roster lookup order;
- current player values between results;
- current `starter` flags between results;
- current `lastMatchRating` fallback values;
- current rating-history arrays between results;
- object replacement timing observable by consumers.

A batch formula that combines multiple match effects into one final player object is not exact-equivalent by default, even if arithmetic appears additive, because clamping, rounding, fallback ratings, history truncation, and intervening state changes are order-sensitive.

### Immutable state and object identity

The reducer does not mutate the input `state.players` dictionary or the input player objects. It uses copy-on-write for the dictionary and creates a new object for each updated player.

Unchanged players retain their original object references. The returned `players` dictionary is a new object whenever at least one valid participating player exists. The returned state is also rebuilt through the surrounding reducer path.

Any optimization that mutates the existing dictionary, mutates player objects in place, or reuses a player object after changing its fields violates the established immutable-state contract.

## Candidate optimizations and semantic risks

### 1. Update only starters or selected match participants

Potential benefit: large reduction in roster traversal and object allocation.

Risk: not equivalent. The current implementation deliberately updates every player in both club rosters, including non-starters. Existing tests and gameplay behavior rely on squad-wide morale/form effects. This is prohibited by the audit requirements.

Verdict: unsafe.

### 2. Skip players without `playerRatings[pid]`

Potential benefit: avoid most bench-player calculations in AI results.

Risk: not equivalent. The current fallback explicitly updates players with no supplied rating using `lastMatchRating`, then `5`. Skipping them changes morale, form, reputation, market value, last rating, and history.

Verdict: unsafe.

### 3. Cache starter flags or roster partitions

Potential benefit: avoid reading the flag and branching for every player.

Risk: only exact if the cache is rebuilt from the current state before every reducer result and preserves the current `playerIds` order. A broader cache can become stale after transfers, tactics, AI squad decisions, injuries, or other actions. The likely saved work is small compared with the required player object/history allocations.

Verdict: theoretically equivalent only with per-result validation/rebuild; no meaningful safe optimization established.

### 4. Precompute rating-independent deltas

Potential benefit: reduce repeated branch and arithmetic work.

Risk: the rating, starter flag, result, age, and current player values are all inputs. A cache keyed by only player ID or club ID becomes stale when any of those inputs changes. A complete key containing all inputs would add lookup and maintenance work and still would not remove the player object/history allocation.

Verdict: possible in a narrowly controlled microbenchmark, but no exact meaningful gain is proven. Not implemented.

### 5. Reuse or mutate `matchRatingHistory`

Potential benefit: avoid one short array allocation per player.

Risk: mutating the old array violates immutability and can alter prior state snapshots. Reusing an array only when it is provably unshared is incompatible with the reducer's general immutable-state contract and consumer expectations. A copied ring-buffer-like representation would change the observable array shape/order unless carefully normalized, and it would still require a new observable value.

Verdict: unsafe under the current state contract.

### 6. Avoid copying the player dictionary

Potential benefit: remove the large `{ ...state.players }` allocation.

Risk: in-place writes would mutate the input state and make prior state snapshots observe future results. A persistent-map replacement would be a new state architecture, not a local optimization, and could change enumeration, identity, serialization, or consumer behavior.

Verdict: unsafe as a local change.

### 7. Copy the dictionary once for a batch of results

Potential benefit: reduce dictionary cloning from once per result to once per batch.

Risk: this is batching/deferred state mutation and changes reducer sequencing. It can alter object identity timing, intermediate state visibility, and the state observed by consequences or later results. It is explicitly prohibited for Step 6E.

Verdict: unsafe for this step.

### 8. Replace object spread with `Object.assign` or a helper

Potential benefit: potentially lower allocation overhead.

Risk: only exact if property-copy order, own enumerable property behavior, prototypes, field descriptors, and object identity behavior remain equivalent. It would not remove the per-player object allocation or history allocation. Any gain would require measurement and is unlikely to address the dominant work meaningfully.

Verdict: a low-confidence micro-optimization; not justified after Step 6C.

### 9. Hoist stable constants and simplify arithmetic branches

Potential benefit: reduce a few operations per player.

Risk: seemingly harmless rewrites can change JavaScript rounding, nullish fallback, clamp order, or boundary behavior. Even if proven numerically equivalent, the expected gain is small relative to the 91% path and does not remove allocations.

Verdict: potentially exact only with exhaustive boundary tests; not a meaningful Step 6E optimization.

### 10. Change the player dictionary representation

Potential benefit: use a persistent or structurally shared map.

Risk: changes immutable-state semantics, object identity, enumeration, serialization, and the public `GameState` contract. This is a reducer/state architecture redesign, explicitly out of scope.

Verdict: unsafe and out of scope.

## Can any optimization preserve exact behavior?

No meaningful local optimization was proven to preserve exact behavior across all stated requirements.

The only candidates that are plausibly exact are low-level expression or lookup changes whose savings are small and whose equivalence would need boundary-level tests. They do not address the dominant cost: traversing every player and allocating updated player/history objects.

Every candidate with material impact either:

- changes which players are updated;
- changes when or how sequential state is observed;
- mutates or structurally replaces immutable state;
- changes fallback, rounding, clamping, history, or object-identity behavior; or
- introduces the batching/deferred update architecture explicitly prohibited here.

Therefore the correct Step 6E conclusion is that no safe, meaningful optimization is available in the current architecture under the exact-equivalence constraints.

## Recommended smallest safe future architecture

Do not change `RECORD_MATCH_RESULT` semantics directly. A future optimization step should first introduce a separately tested, pure player-transition function with an explicit contract:

```text
(previousPlayer, result, resolvedRating) -> nextPlayer
```

The function must preserve the current calculation order, nullish fallback resolution, starter branching, clamp order, JavaScript rounding, five-item history behavior, and complete player-object copy.

Then, and only then, evaluate an internal immutable update context that:

1. is created fresh for one sequential reducer result;
2. starts from the current `state.players` dictionary;
3. records updates in current `playerIds` order;
4. creates each updated player exactly once;
5. publishes a new dictionary only at the same reducer boundary;
6. never mutates the input dictionary or any input player object;
7. preserves unchanged player references;
8. is validated against deep state equality, object identity, event/match order, idempotency, and sequential/batch equivalence.

This architecture is a testable boundary for future investigation, not an implemented optimization. It may still produce no material gain in JavaScript because the player objects and history arrays remain required allocations. A larger gain would require a product-level decision to change squad-wide semantics or state architecture, neither of which is permitted by the current requirements.

## Validation

TypeScript:

```bash
npx tsc --noEmit
```

Result: passed with no output or errors.

Focused existing suite:

```bash
npx vitest run src/state/error-handling.test.ts src/state/match-integration.test.ts src/state/integration-and-stability.test.ts src/state/match-retention.invariants.test.ts --reporter=dot
```

Result:

- 4 test files passed;
- 74 tests passed;
- invalid fixture handling passed;
- match result and fixture lifecycle behavior passed;
- player morale/form behavior passed;
- player-club reference and roster invariants passed;
- sequential/existing batch equivalence coverage passed;
- match retention invariants passed.

The working-tree reducer change remains the previously completed Step 6C fixture lookup optimization. Step 6E added no production changes or temporary instrumentation that remains in the repository.

## Final conclusion

Step 6E is complete as a diagnostic-only audit.

The 91% cost is the required squad-wide, sequential per-player transition work plus immutable player and history allocations. No material local optimization can currently be proven exactly equivalent under the required gameplay, determinism, sequencing, and immutable-state constraints.

The recommended future direction is a separately specified and tested immutable update context around the existing pure transition semantics, but it must not be implemented without a new equivalence test matrix and benchmark gate.

Stop point reached. No Step 6F work was started.
