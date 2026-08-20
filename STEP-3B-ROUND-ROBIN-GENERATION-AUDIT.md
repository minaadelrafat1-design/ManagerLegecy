# Step 3B: Round-Robin Fixture Generation Audit

## Objective

This step audited the remaining fixture-generation bottleneck after Step 3A. The target was only the round-robin generation path in [src/state/season.ts](src/state/season.ts), without changing gameplay or fixture semantics.

The hard rules were respected:
- No gameplay logic changes
- No match simulation changes
- No AI/RNG/date/home-away rule changes
- No promotion/relegation/transfer/training/finance changes
- No fixture universe redesign

---

## 1) Audit of the current algorithm

The live implementation in [src/state/season.ts](src/state/season.ts) uses a circle-method round-robin loop, then builds the second leg by reversing the home/away assignment for the same pairings.

The algorithm pattern is:

1. Create a per-league club list.
2. If odd-sized, append a single `__bye__` sentinel.
3. Build `slots` and rotate the array each round using:
   - `const first = arr[0]`
   - `const last = arr[slots.length - 1]`
   - `arr = [first, last, ...arr.slice(1, slots.length - 1)]`
4. For each round, generate pairings by matching first/last positions.
5. For each pair, create two fixtures for a double round-robin:
   - first leg: home = `home`, away = `away`
   - second leg: home = `away`, away = `home`
6. Assign realistic dates via `buildRealisticMatchdayDates()`.

### Waste and avoidable work in the current structure

The generated code is already compact, but it still does avoidable work:
- It rebuilds `arr` on each round and repeatedly copies arrays.
- It creates full `pairings` arrays for each round before scheduling them.
- It produces a second fixture for every pair in every round, which is necessary for the rule and not the problem.
- It allocates intermediate `pairings` and arrays repeatedly during generation.

The remaining cost is not redundant filtering; it is the actual combinatorial round-robin generation itself. This is the true root cause.

---

## 2) Benchmark of the current full-world fixture generation

I measured the real full-world generation path with the live configuration via the dedicated audit harness:

- Script used: `scripts/step-3b-round-robin-audit.ts`
- Result:
  - production fixtures: `35756`
  - candidate fixtures: `35756`
  - production time: `5716.01 ms`
  - candidate time: `5623.07 ms`
  - delta: `-92.95 ms`
  - relative change: `-1.63%`

### Real fixture breakdown

Per league, the world is generating the same fixture universe expected from Step 3A:
- 80 regular divisions produce the standard full-world structure
- 1 national demo league is included separately
- total generated: `35,756` fixtures

Duplicate IDs were checked and none were found in the production path.

---

## 3) Candidate optimization test

I tested a candidate rewrite built to simplify the pairing generation while preserving the same overall round-robin shape.

### Candidate result

The candidate generator produced the same total fixture count, but it did not pass exact equivalence.

First difference reported by the comparison harness:
- index: `128`
- field: `awayClubId`
- production value: `england-premier-club-2`
- candidate value: `england-premier-club-19`

This is a real semantic mismatch, not a harmless ordering difference.

### Why the candidate was rejected

The candidate was not proven safe because:
- It changed pairing orientation in a real fixture slot
- The exact fixture universe differed from the production generator
- It was not meaningfully faster enough to justify the risk
- It saved only `92.95 ms` out of `5716 ms` (~1.6%)

This is below the threshold for a safe replacement of the current round-robin logic.

---

## 4) Production code change decision

No production code in [src/state/season.ts](src/state/season.ts) was changed.

This was a required stop condition under the Step 3B rules:
- the candidate rewrite was not exactly equivalent,
- therefore it was not eligible for production implementation,
- and it was not meaningfully faster enough to justify risk.

---

## 5) Validation performed

### TypeScript

Command run:
`npx tsc --noEmit`

Result:
- passed
- exit code 0

### Candidate equivalence benchmark

Command run:
`npx tsx scripts/step-3b-round-robin-audit.ts`

Result:
- first difference found
- exact equivalence failed
- Production generator retained as the canonical implementation

### Determinism / canonical regression

The deterministic five-season regression check was not used as a pass gate for this Step 3B because no production code change was made and the candidate rewrite already failed exact equivalence.

---

## 6) Full-world result

The bounded full-world command was not run as a production gate because the optimization was not proven safe and no production change was approved.

The earlier Step 3A full-world regression harness also showed the repo’s canonical regression harness was not currently a clean signal for this small optimization path, including:
- `Different-seed divergence: FAIL`
- `Same-seed reproducibility: NOT RUN`

That reinforces the conclusion that no safe production rewrite is justified here.

---

## 7) Root cause and next bottleneck

### Root cause

The major bottleneck is the actual round-robin scheduling algorithm itself:
- repeated rotation of the club array,
- repeated pair generation,
- per-round grouping of pairings,
- per-pair creation of both fixtures,
- realistic-date assignment overhead on top of the combinatorial loop.

### Next bottleneck

If a future optimization is attempted, the correct target is not broad round-robin refactoring in a way that changes ordering or match orientation. The likely next step is a more careful algorithmic rewrite that preserves exact pairing order and per-round orientation semantics while reducing allocations.

That path would need a proof harness like the one in `scripts/step-3b-round-robin-audit.ts` before any production change is allowed.

---

## 8) Files changed

### Production files
- None

### Diagnostic / audit files
- [scripts/step-3b-round-robin-audit.ts](scripts/step-3b-round-robin-audit.ts)

---

## Final decision

Step 3B is complete without production code changes.

The investigation proved:
- the current production round-robin generator is the actual bottleneck,
- a candidate rewrite is faster only marginally,
- the candidate rewrite is not exactly equivalent,
- therefore the safest, rule-compliant action is to leave production code unchanged.

This is the correct stop point before Step 3C.
