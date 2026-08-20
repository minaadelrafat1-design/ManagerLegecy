# Step 6A AI World and Manager Ecosystem Audit

## Scope

This diagnostic-only audit focused on AI scheduling, AI decision integrity, manager identity/replacement, and bounded multi-season AI stability.

It did not re-audit competitions, player lifecycle, transfers, contracts, loans, or finance mechanics except where AI actions touched their state references.

No production changes were made.

## Final findings

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 1
- **PASS:** 6

### LOW. Full accepted job-offer transition was not forced

- **File:** [src/state/jobs.ts](src/state/jobs.ts)
- **Functions:** `generateJobOffers`, `acceptJob`
- **Behavior:** Job offers and acceptance are implemented, but the bounded audit did not force a seeded offer to appear and be accepted. Manager replacement identity and generation were directly verified.
- **Impact:** Full player-manager departure/appointment interaction remains partially unverified.
- **Recommendation:** Use a known accepted-offer fixture in a future focused audit. No behavior was invented in Step 6A.

## Scheduler coverage

### Full-world population

The current generated world contained:

- AI clubs: `1,736`
- daily cap observed: `4`
- periodic batch size: `4`
- measurement window: `12,000` days
- AI clubs covered: `1,736`
- permanently uncovered clubs: `0`

The periodic scheduler therefore eventually covers the full AI population under quiet-day conditions. The measured maximum daily plan size never exceeded the configured cap.

### Scheduler behavior

The scheduler was checked through [src/state/ai-world-scheduler.ts](src/state/ai-world-scheduler.ts):

- periodic reviews use a deterministic date/club seeded order;
- upcoming matches, transfer windows, injuries, manager changes, transfer events, and financial problems can add reasons;
- priority sorting is deterministic;
- the final daily plan is capped at four clubs;
- same-day repeated execution is guarded by `lastRunDate`;
- scheduler metadata remains bounded.

No duplicate, skipped-forever, or permanently unscheduled club was observed in the full-world coverage measurement.

## Bounded multi-season results

The bounded scenario used six clubs, five AI clubs, a fixed seed, and three 90-day seasonal windows.

| Season | Days | Processed AI clubs | AI managers | Negotiations | Completed transfers | Invalid state findings |
|---|---:|---:|---:|---:|---:|---:|
| 2026/27 | 90 | 5 | 5 | 17 | 0 | 0 |
| 2027/28 | 90 | 5 | 5 | 17 | 0 | 0 |
| 2028/29 | 90 | 5 | 5 | 17 | 0 | 0 |

No uncontrolled population growth, invalid squad reference, duplicate manager identity, or duplicate event ID was found.

## Verified categories

### AI scheduler correctness

**PASS**

The daily cap remained four, repeated same-day runs were guarded, and full-world periodic coverage reached all `1,736` AI clubs in the measurement window.

Production anchor: [src/state/ai-world-scheduler.ts](src/state/ai-world-scheduler.ts), `planAiWorldWork` and `runAiWorldScheduler`.

### AI decision integrity

**PASS**

For all five bounded AI clubs:

- decision contexts were created;
- priorities returned valid top priorities;
- training recommendations returned valid focus/intensity values;
- AI actions executed without invalid player or club references;
- AI ledgers remained present where initialized;
- training and strategy state remained structurally valid.

Production anchors: [src/state/ai-decisions.ts](src/state/ai-decisions.ts), `buildClubDecisionContext` and `evaluateClubPriorities`; [src/state/ai-actions.ts](src/state/ai-actions.ts), `runAiActions`.

### Manager generation and replacement

**PASS**

The direct replacement check produced a new deterministic manager ID and incremented generation:

```text
old: aimgr-westport-united-g1
new: aimgr-westport-united-g2
generation: 2
```

No duplicate manager IDs were found in the bounded state.

Production anchors: [src/state/ai-manager.ts](src/state/ai-manager.ts), `generateAIManager`; [src/state/ai-evolution.ts](src/state/ai-evolution.ts), `generateReplacementManager`.

### Manager/job lifecycle

**PARTIAL / LOW limitation**

Replacement generation was verified. Job offer generation and acceptance APIs were inspected, but no seeded offer was forced and accepted in the bounded run. No defect is claimed.

Production anchor: [src/state/jobs.ts](src/state/jobs.ts), `generateJobOffers`, `acceptJob`, and `evaluateJobSecurity`.

### AI interaction with shared state

**PASS for bounded coverage**

AI actions touched shared squad, player, training, negotiation, ledger, memory, facility, and event state without producing:

- invalid player references;
- invalid club pointers;
- players in multiple squads;
- duplicate manager identities;
- duplicate event IDs.

Existing transfer hardening and player/finance invariants were used as dependency checks rather than re-audited wholesale.

### Same-seed determinism

**PASS**

Two complete bounded three-season runs with seed `step-6a-seed` produced identical scheduler metadata, managers, AI ledgers, negotiations, events, squad state, and final fingerprint.

Final same-seed fingerprint length: `148,403` characters.

### Different-seed divergence

**PASS**

The different seed `step-6a-different-seed` diverged in bounded AI state.

Same-seed fingerprint length: `148,403` characters.
Different-seed fingerprint length: `144,912` characters.

## Tests and commands

### TypeScript

```text
npx tsc --noEmit
```

Result: **PASS**.

### Relevant AI tests

```text
npx vitest run src/state/ai-world-scheduler.test.ts src/state/ai-manager-identity.test.ts src/state/final-d2.1-regression.test.ts --reporter=dot
```

Result:

- `3` test files passed
- `18` tests passed

### Bounded audit

```text
npx tsx scripts/step-6a-ai-world-manager-audit.ts
```

Result:

- full-world scheduler coverage: `1,736/1,736`
- bounded seasons: `3`
- daily cap observed: `4`
- critical/high/medium findings: `0`
- low findings: `1`
- same-seed determinism: passed
- different-seed divergence: passed

## Production fixes

None.

## Regression tests added

None. No reproducible production defect was found.

## Changed files

- [scripts/step-6a-ai-world-manager-audit.ts](scripts/step-6a-ai-world-manager-audit.ts)
- [STEP-6A-AI-WORLD-MANAGER-AUDIT.md](STEP-6A-AI-WORLD-MANAGER-AUDIT.md)

No production source files were modified.

## Remaining unverified areas

- A fully forced accepted player-manager job offer and club transition.
- Long-run AI manager churn beyond the bounded replacement identity check.
- Full-world multi-season AI action correctness; only full-world scheduler coverage was measured.
- AI intelligence/quality, which was explicitly outside this audit’s correctness scope.

## Stop point

Step 6A is complete. No Step 6B work or unrelated refactoring was started.
