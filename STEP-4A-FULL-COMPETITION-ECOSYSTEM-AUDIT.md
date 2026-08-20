# Step 4A Full Competition Ecosystem Audit

## Scope

This was a diagnostic-only audit. No production gameplay, competition, fixture, RNG, or performance code was modified.

The audit script is [scripts/step-4a-competition-ecosystem-audit.ts](scripts/step-4a-competition-ecosystem-audit.ts). It exercised configuration, generated fixtures, registration, standings, determinism, and multi-season state persistence.

## Executive summary

The audited competition ecosystem is structurally coherent for the tested initial state. The direct audit produced:

- `0` critical findings
- `0` high findings
- `1` medium finding
- `0` low findings
- `14` passing checks

The one reproducible issue is qualification persistence: applying European qualification registration twice appends duplicate logical registration entries.

The audit also found a coverage limitation: the existing full multi-season European simulation script exceeded five minutes during Season 1 and was stopped before completion. Therefore, full end-to-end continental completion across multiple simulated seasons is not claimed as verified by this audit.

## Findings by severity

### CRITICAL

None observed in the direct audit.

### HIGH

None observed in the direct audit.

### MEDIUM

#### M1. European qualification registration is not idempotent

- **File:** [src/state/qualification.ts](src/state/qualification.ts)
- **Function:** `applyEuropeanQualificationRegistrations`
- **Behavior:** The function builds a fresh `registrations` array from the existing metadata, then appends newly resolved entries without deduplicating by `competitionId` and `clubId`.
- **Why it matters:** Re-running registration for the same season can retain multiple logical registrations for the same club and competition. This can contaminate later participation setup and makes the state contract less clear.
- **Gameplay/realism impact:** A club can appear registered more than once for one continental competition. The current fixture generator may still avoid duplicate fixtures in the tested path, but downstream qualification and participation logic has duplicate state to interpret.
- **Reproduction evidence:** The audit applied `applyEuropeanQualificationRegistrations` twice to the same state. The second result contained `5` duplicate logical registration keys.
- **Recommended fix:** Make registration replacement explicitly keyed by season, competition, and club. Before persisting, deduplicate by `competitionId:clubId` and ensure old-season entries are removed using an explicit season field rather than date/event inference.
- **Determinism risk:** Medium. Deduplication should be deterministic, but changing persistence can alter registration ordering and future continental fixture generation. Add same-seed and multi-season equivalence checks before merging.

### LOW

None observed.

## Verified systems

### League structures and divisions

**PASS**

- `generateSampleWorld` produced `16` countries, `80` generated divisions, `81` runtime leagues including the demo league, and `1,737` clubs.
- Each generated country had a five-tier adjacent hierarchy.
- Production anchors: [src/state/worldgen.ts](src/state/worldgen.ts), `generateSampleWorld`; [src/state/seed.ts](src/state/seed.ts), `buildInitialState`.

### Promotion and relegation configuration

**PASS**

- Every generated division pointed to the adjacent promotion and relegation tier.
- Top tiers had no promotion target.
- Bottom tiers had no relegation target.
- This verifies configuration shape, not a complete simulated-season movement audit.
- Production anchor: [src/state/worldgen.ts](src/state/worldgen.ts), `generateSampleWorld`.

### League fixture generation

**PASS**

- Generated fixture total: `35,756`.
- Each generated league passed the expected appearance-count check.
- No generated fixture referenced an unknown club or competition.
- No self-matches or duplicate fixture IDs were found.
- Production anchor: [src/state/season.ts](src/state/season.ts), `generateLeagueFixtures`.

### Home/away balance

**PASS**

- Generated leagues passed home/away balance checks.
- The nine-club demo league is intentionally treated as its configured special case.
- Production anchor: [src/state/season.ts](src/state/season.ts), `generateLeagueFixtures`.

### Scheduling conflicts and dates

**PASS for the initial generated schedule**

- No scheduled fixture gave a club two fixtures on the same calendar date in the audited initial state.
- Fixture dates were valid ISO dates.
- This does not prove conflict freedom after every cup and continental round is dynamically appended through a full season.
- Production anchors: [src/state/season.ts](src/state/season.ts), `generateLeagueFixtures`; [src/state/cups.ts](src/state/cups.ts), `calculateCupFixtureDate`.

### Domestic cups

**PASS for first-round scheduling**

- Domestic cup scheduling created valid knockout fixtures from eligible entrants in the exercised state.
- The direct probe generated `4` cup fixtures.
- Full cup elimination progression and completion were not independently completed within the five-minute multi-season simulation limit.
- Production anchor: [src/state/cups.ts](src/state/cups.ts), `runDomesticCup`.

### Continental formats

**PASS for configuration consistency**

- `2` continental competitions were checked.
- Group capacity, qualification slots, and first knockout-round team counts were internally consistent.
- This verifies configured structure, not every possible played-stage transition.
- Production anchor: [src/state/worldgen.ts](src/state/worldgen.ts), `generateSampleWorld`.

### Continental registration and fixture setup

**PASS with M1 qualification-persistence caveat**

- Initial registrations were unique, referenced configured continental competitions, and referenced existing clubs.
- Direct continental scheduling produced `4` fixtures when valid registrations were present.
- Repeated registration exposes M1.
- Production anchors: [src/state/qualification.ts](src/state/qualification.ts), `applyEuropeanQualificationRegistrations`; [src/state/european.ts](src/state/european.ts), `runEuropeanCompetitions`.

### Standings, points, and tie-breakers

**PASS for the audited initial table**

- The audited table assigned sequential positions.
- Points followed standard `3/1/0` scoring.
- Existing standings code uses points, goal difference, goals scored, then deterministic club ID fallback.
- Production anchor: [src/state/standings.ts](src/state/standings.ts), `computeStandings` and `computeLeagueTable`.

### Season transition persistence

**PASS for direct world progression**

- Three direct calls to `applyWorldSeasonProgression` preserved all club IDs and the total club count.
- Observed labels/dates: `2027/28@2027-08-01`, `2028/29@2028-08-01`, `2029/30@2029-08-01`.
- This is direct metadata progression, not a complete simulated competition season.
- Production anchor: [src/state/world.ts](src/state/world.ts), `applyWorldSeasonProgression`.

### Historical records

**PARTIALLY VERIFIED, not a full PASS**

- Historical record infrastructure exists in [src/state/world-history.ts](src/state/world-history.ts), including deterministic IDs and unique keys.
- The direct Step 4A harness did not complete a full season-long validation of league champions, cup winners, European winners, promotions, relegations, and historical records together.
- Existing scripts cover portions of this behavior, but full end-to-end completion remained unverified because the multi-season European script exceeded the execution limit.

### Determinism

**PASS for same-seed initial competition state**

- Two `buildInitialState("step-4a-determinism")` calls produced the same competition-state fingerprint.
- Fingerprint length was `4,265,972` characters.
- This does not prove every multi-season path is deterministic.
- Production anchor: [src/state/seed.ts](src/state/seed.ts), `buildInitialState`.

## Validation commands and results

### TypeScript

Command:

```text
npx tsc --noEmit
```

Result: **PASS**.

### Focused tests

Command:

```text
npx vitest run src/state/competitions.test.ts src/state/league-pyramid.test.ts src/state/standings.test.ts src/state/season-lifecycle.test.ts src/state/realistic-season-calendar.test.ts src/state/test-season-calendar-separation.test.ts src/state/multi-season.test.ts --reporter=dot
```

Result:

- `39` tests passed across `6` files.
- `1` test file failed to load: `src/state/test-season-calendar-separation.test.ts` imports missing `./build`.
- The failure is a test/repository wiring issue, not a production change made by this audit.

### Targeted diagnostic audit

Command:

```text
npx tsx scripts/step-4a-competition-ecosystem-audit.ts
```

Result:

- `0` critical
- `0` high
- `1` medium
- `0` low
- `14` pass checks
- `35,756` generated fixtures
- `4` cup fixtures exercised
- `4` continental fixtures exercised

### Multi-season European simulation

Command:

```text
npx tsx scripts/test-multi-season.ts
```

Result: exceeded five minutes during Season 1 before completion. The process was stopped. No end-to-end multi-season European completion pass is claimed.

## Recommended fix order

1. Fix qualification registration idempotency and explicitly key registrations by season, competition, and club.
2. Add a focused regression test that applies registration twice and asserts identical registration state.
3. Add a full-season but bounded continental progression test covering group completion, knockout scheduling, final completion, and winner persistence.
4. Repair the missing `src/state/build` test import or update that test to the canonical seed builder, separately from competition changes.
5. Re-run deterministic same-seed comparisons after any qualification or progression fix.
6. Only then consider any competition behavior changes.

## Production readiness

**Not fully production-ready for the competition ecosystem audit.**

The structural ecosystem is in good shape and no critical or high issue was found in the direct checks. However:

- qualification persistence has a reproducible medium defect;
- full multi-season European completion was not verified within the available execution window;
- one focused test file has a missing-module failure;
- full promotion/relegation persistence and historical records remain only partially exercised end to end.

## Estimated AAA realism impact

The current direct evidence supports a strong structural realism score for leagues, fixture integrity, basic cups, configuration, standings, and deterministic initialization. The medium registration defect and incomplete end-to-end verification justify a provisional deduction of approximately **5-10 percentage points** from the competition-ecosystem realism score until qualification persistence and full continental progression are verified.

This is an audit estimate, not a gameplay metric.

## Final stop point

No production code was changed. No automatic fix was applied. The audit is complete and stops here as requested.
