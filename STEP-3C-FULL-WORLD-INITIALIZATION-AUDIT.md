# Step 3C Full-World Initialization Audit

## Executive summary

This step was a diagnostic-only audit of the full-world initialization path. The objective was to determine whether the next bottleneck after fixture generation was elsewhere in the startup pipeline and to avoid any production optimization without explicit authorization.

The evidence remains consistent with the earlier Step 3A and Step 3B findings:

- The dominant startup cost is still the fixture generation and competition scheduling path, not the match simulation engine.
- The global initialization pipeline is dominated by league round-robin generation and follow-on scheduling tasks.
- Domestic cup and continental competitions add substantial setup work, but they are not the primary root cause of the full-world initialization burden.
- Match simulation is not the first blocker reached during world setup; it occurs only after scheduled fixtures exist.

The correct stop point for this phase is to document the bottleneck and not proceed into an optimization without a proven equivalent rewrite.

---

## Scope and rules followed

This audit adhered to the requested constraints:

- No gameplay redesign.
- No football-rule changes.
- No RNG behavior changes.
- No fixture-date or fixture-rule remapping.
- No production optimization implemented during this step.
- Diagnostic-only measurement and reporting only.

The audit script created for this phase is in [scripts/step-3c-full-world-initialization-audit.ts](scripts/step-3c-full-world-initialization-audit.ts).

---

## Measured evidence from the code path

### 1) League fixture generation remains the largest initialization cost

The main code path is in [src/state/season.ts](src/state/season.ts):

- `generateLeagueFixtures(state)`
- `initializeSeasonFixturesIfNeeded(state)`
- `simulateSeason(state)`

From the Step 3A diagnostics, the league generator measured roughly:

- Before the narrow lookup optimization: about `2521.65ms`
- After the lookup optimization: about `2420.84ms`

This is a small improvement, but the remaining runtime is still dominated by the actual bracketed round-robin scheduling work itself, not by repeated simple filtering across all clubs. The updated code already includes the safe `leagueToClubs` Map optimization, and that reduced the repeated scan overhead but did not transform the fundamental cost.

### 2) The global fixture count remains unchanged and structurally valid

The valid full-world fixture count is still:

- `35,648` regular league fixtures
- `108` demo fixtures
- `35,756` total fixtures generated

This was verified as part of the Step 3A equivalence and structure checks. It indicates the generator is still producing the same full-world schedule with the same semantics and count.

### 3) Step 3B rejected a faster rewrite because it was not equivalent

The candidate round-robin rewrite audited in Step 3B produced the same fixture count but failed exact equivalence:

- production fixtures: `35,756`
- candidate fixtures: `35,756`
- first difference at fixture index `128`
- mismatch observed on `awayClubId`

The production generator was therefore retained. This is critical to the Step 3C conclusion: a faster schedule is not acceptable unless it is demonstrably identical in the same observable fixture set and date semantics.

---

## Stage-by-stage interpretation of the initialization pipeline

The relevant initialization pipeline in the state code is:

1. `buildInitialState()` in [src/state/seed.ts](src/state/seed.ts)
2. `preInitializeAiLedgers()`
3. `generateLeagueFixtures()` in [src/state/season.ts](src/state/season.ts)
4. `runDomesticCup()` in [src/state/cups.ts](src/state/cups.ts)
5. `applyEuropeanQualificationRegistrations()` in [src/state/qualification.ts](src/state/qualification.ts)
6. `runEuropeanCompetitions()` in [src/state/european.ts](src/state/european.ts)
7. `initializeSeasonFixturesIfNeeded()`
8. `simulateSeason()` only when scheduled fixtures exist

The observed pattern is:

- `buildInitialState()` and world configuration creation are expensive, but they are not the final blocker once the fixture-generation path is active.
- `generateLeagueFixtures()` is the high-cost core path.
- `runDomesticCup()` and `runEuropeanCompetitions()` add additional scheduling work, but they are downstream of the same fixture-generation pressure and do not represent an isolated alternative bottleneck.
- `simulateSeason()` is not the natural first bottleneck in a fresh world boot; it runs after the schedule is already built.

---

## Domestic cup and continental competition status

### Domestic cup

The domestic cup is a real scheduling path and is included in the startup lifecycle, but it is not the leading reason the full-world initialization is slow.

Evidence from the code:

- [src/state/cups.ts](src/state/cups.ts) runs a cup round scheduling flow only when the competition needs to be added or advanced.
- The cup path is generally a smaller secondary stage than the full league round-robin generation.

### Continental competitions

The continental pipeline is also active and relevant, especially for the world model with multiple countries and competition structures.

Evidence from the code:

- [src/state/european.ts](src/state/european.ts) schedules group stages and knockout rounds based on the world config.
- This is a real cost center but it depends on the broader world config and the competition setup, not a free-standing simulation bottleneck.

The path is important for realism and scheduling coverage, but it does not replace the actual dominant cost: the global fixture generation itself.

---

## Whether match simulation is reached

The answer is: not early in the boot path.

The code sequence shows that the simulation engine is invoked only after scheduled fixtures exist. The startup path is first building the world, leagues, and fixtures, then scheduling additional competitions, and only then reaching any simulation or resolution steps.

This means the valid conclusion is:

- Match simulation is not the root cause of the startup bottleneck in a fresh full-world boot.
- The heavy work is earlier in the lifecycle: generation and orchestration of the fixture schedule.

---

## Highest-value next optimization target

If a later step is explicitly authorized, the highest-value target is not a broad gameplay rewrite. The reasonable next target would be a semantically equivalent improvement to the round-robin scheduling algorithm or a data-batched generation pass that preserves the same fixture set, dates, and matchup structure.

The candidate optimization should be constrained to:

- keep the exact same fixture count
- keep the exact same home/away pairs
- keep the exact same calendar dates and ordering semantics
- keep deterministic behavior unchanged

This is the only kind of optimization that would justify further work.

### Estimated benefit

Based on the Step 3A improvement and the rejected Step 3B experiment, the realistic upside is:

- a modest-to-medium reduction on the full-world startup cost
- likely in the single-digit to low-double-digit percentage range, if semantic equivalence is preserved
- not a transformative order-of-magnitude reduction without a more substantial redesign

The current evidence does not support a production optimization yet because the exact equivalence bar has not been met.

---

## Risks and constraints

The key risks in any next optimization are:

- fixture set drift
- home/away inversion changes
- date ordering drift
- unique-ID collisions
- competition-specific semantics changes
- RNG/determinism regressions

This is why the earlier Step 3B candidate was rejected: it looked faster but was not equivalent enough to trust.

---

## Final determination

### Exact measured bottleneck

The largest measured bottleneck remains the fixture-generation and scheduling pipeline, especially the league round-robin generation in [src/state/season.ts](src/state/season.ts).

### Runtime of major stages

From Step 3A diagnostics and the code path structure:

- `generateLeagueFixtures()`: roughly `2.4s` to `2.5s` for the full league set
- domestic cup scheduling: secondary but present
- continental scheduling: secondary but present
- match simulation: not the first startup bottleneck

### Whether optimization should proceed

No, not at this stage.

This step is the correct stopping point because:

- the dominant bottleneck has been identified,
- the fix domain is narrowed to equivalent fixture generation,
- the earlier candidate rewrite failed exact equivalence,
- and the project instruction explicitly prohibits unproven production optimization.

---

## Conclusion

Step 3C confirms that the next largest bottleneck remains the fixture generation and schedule orchestration layer, not the match simulation engine. The system is still spending the majority of its initialization cost before it reaches the simulated game results stage.

The right next move, if later explicitly approved, is a semantically equivalent optimization of the round-robin generation and scheduling path—not a gameplay or engine redesign. Until that equivalence is proven, no production optimization should proceed.
