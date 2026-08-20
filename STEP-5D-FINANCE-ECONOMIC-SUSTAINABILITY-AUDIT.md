# Step 5D Finance, Economic and Club Sustainability Audit

## Scope

This audit used a bounded three-season finance scenario with deterministic revenue, wage, transfer-fee, budget, and weekly-finance operations.

No economy redesign, transfer-rule change, contract-rule change, RNG change, match-engine change, AI change, competition change, or performance optimization was performed.

## Final findings

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 1
- **LOW:** 1
- **PASS:** 6

### Resolved CRITICAL. Same-seed finance initialization diverged

- **Root cause:** [src/state/seed.ts](src/state/seed.ts), `buildInitialState`, passed the module-level `homeClub` object directly into the state. `initializeAllEnhancedRevenueSystems` mutates that object. The first initialization populated enhanced-revenue fields and transactions; a repeated same-seed build then skipped initialization because the shared object was already populated.
- **Fix:** Clone the managed club, its player IDs, and academy prospect IDs into the new state before enhanced-revenue initialization.
- **Result:** Same-seed financial state and final fingerprint are now identical.
- **Regression:** [src/state/transfer-finance-ledger.test.ts](src/state/transfer-finance-ledger.test.ts) verifies repeated same-seed enhanced-revenue initialization.

### Resolved production defect. Transfer ledger entries were missing

- **Root cause:** The `RECORD_TRANSFER` branch in [src/state/reducer.ts](src/state/reducer.ts) updated transfer/wage budgets and expense snapshots but did not append `transfer_fee` or `player_salary` transactions.
- **Fix:** The reducer now uses `recordTransaction` to append a negative transfer-fee transaction and annualized negative wages (`weekly wage * 52`) when applicable.
- **Regression:** [src/state/transfer-finance-ledger.test.ts](src/state/transfer-finance-ledger.test.ts) verifies both entries.
- **Result:** Transfer-fee, wage, budget, and finance integration expectations now pass.

### MEDIUM. Complete transaction-to-balance reconciliation is unverified

- **Evidence:** `recordTransaction` appends office ledger entries, while `applyWeeklyFinanceTick` calculates balance from finance snapshots and separately emits some transactions. Transfer ledger entries do not themselves mutate `finances.balance`.
- **Classification:** This is an accounting-boundary limitation, not an invented defect. The current architecture has a transaction history and a finance snapshot, but the audit found no authoritative double-entry reconciliation operation.
- **Recommendation:** Document the snapshot/ledger boundary or introduce a separately specified accounting operation in a future authorized step.

### LOW. Insufficient-funds and contract-finance edge cases are unverified

The bounded scenario used valid finance inputs. No single authoritative operation was found for contract expiry/release payments or a complete insufficient-funds transfer-finance lifecycle. These were not simulated through ad hoc mutations.

## Three-season results

| Season | Balance before/after tick | Revenue transactions | Expense transactions | Transfer fees | Annualized wages | Total transactions | Duplicate IDs | Transfer budget |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026/27 | €61,200,000 -> €18,200,000 | 4 | 3 | €1,000,000 | €620,000 | 7 | 0 | €23,500,000 |
| 2027/28 | €18,200,000 -> €18,200,000 | 1 | 3 | €1,000,000 | €620,000 | 11 | 0 | €22,500,000 |
| 2028/29 | €18,200,000 -> €18,200,000 | 1 | 3 | €1,000,000 | €620,000 | 15 | 0 | €21,500,000 |

## Verified categories

### Club finances and sustainability

**PASS for bounded coverage**

Balances remained finite and budgets remained non-negative across three seasonal finance states and weekly finance ticks. No unexplained transaction IDs or invalid currency values were observed.

### Player and contract finance

**PASS for transfer ledger ownership**

Transfer completion through `RECORD_TRANSFER` now records the transfer fee and annualized wage expense. Full contract expiry, release, and renewal payment lifecycle remains unverified.

### Financial transactions

**PASS for bounded transaction integrity**

Final invariant checks found:

- NaN/Infinity balances: `0`
- invalid transaction amounts: `0`
- invalid transaction dates: `0`
- incomplete transaction records: `0`
- duplicate transaction IDs: `0`

### Budget and balance persistence

**PASS**

Transfer budgets remained finite and non-negative. Balance arithmetic remained finite across all three bounded seasons.

### Determinism

**PASS**

Two complete three-season runs with seed `step-5d-seed` produced identical financial state and final fingerprint.

Final same-seed fingerprint length: `2,946` characters.

A different seed diverged in the bounded economic state. The different final fingerprint length was `2,945` characters.

## `office-finance.test.ts` investigation

The test suite was run before and after the transfer-ledger fix.

### Stale/setup assumptions

The test `should initialize with empty financial transactions` expects `[]`, but `buildInitialState()` intentionally initializes three enhanced-revenue transactions:

- merchandise system initialization
- season-ticket system initialization
- youth-academy system initialization

This is a stale test expectation, not a current production defect.

The transaction-count tests also expect `recordTransaction` to operate on an empty ledger, while production initialization starts with those three entries. Those count assertions are stale relative to current setup.

### Real production defect fixed

The transfer-impact tests expecting `transfer_fee` and `player_salary` transactions initially failed because `RECORD_TRANSFER` did not write them. The reducer fix made those assertions pass.

### Remaining broader test status

After the fix, `office-finance.test.ts` still has stale initial/count assumptions because it expects no pre-existing enhanced-revenue transactions. The transfer-impact and integration behavior now pass.

## Tests and commands

### TypeScript

```text
npx tsc --noEmit
```

Result: **PASS**.

### Focused finance regression

```text
npx vitest run src/state/transfer-finance-ledger.test.ts --reporter=dot
```

Result: `2/2` passed.

### Focused transfer/finance suite

```text
npx vitest run src/state/office-finance.test.ts src/state/transfer-finance-ledger.test.ts --reporter=dot
```

Result:

- transfer ledger regression: passed
- `office-finance.test.ts`: `30` passed, `6` stale setup/count assertions failed

### Broader relevant finance/transfer suite

Earlier relevant run:

```text
npx vitest run src/state/transfer-ecosystem.test.ts src/state/transfer-integration.test.ts src/state/staged-transfer-negotiation.test.ts src/state/office-finance.test.ts --reporter=dot
```

The transfer and negotiation files passed. The finance file had four failures before the reducer fix; after the fix, the transfer-impact failures passed, leaving stale initialization/count expectations.

### Bounded audit

```text
npx tsx scripts/step-5d-finance-economic-audit.ts
```

Result:

- three seasons completed
- zero CRITICAL/HIGH findings
- one MEDIUM reconciliation limitation
- one LOW unverified edge-case group
- same-seed determinism passed
- different-seed divergence passed

## Files changed

- [src/state/seed.ts](src/state/seed.ts)
- [src/state/reducer.ts](src/state/reducer.ts)
- [src/state/transfer-finance-ledger.test.ts](src/state/transfer-finance-ledger.test.ts)
- [scripts/step-5d-finance-economic-audit.ts](scripts/step-5d-finance-economic-audit.ts)
- [STEP-5D-FINANCE-ECONOMIC-SUSTAINABILITY-AUDIT.md](STEP-5D-FINANCE-ECONOMIC-SUSTAINABILITY-AUDIT.md)

## Remaining unverified areas

- Full double-entry transaction-to-balance reconciliation.
- Contract expiry, release, termination, and associated payments.
- Dedicated insufficient-funds transfer rejection through an authoritative economic operation.
- Full-world multi-season club sustainability.
- Complete loan/finance interaction beyond existing loan debt utilities.

## Stop point

Step 5D is complete. No Step 5E work or unrelated refactoring was started.
