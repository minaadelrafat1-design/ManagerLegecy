# Step 5E Financial Reconciliation and Insufficient-Funds Audit

## Scope

This audit used a bounded three-season finance scenario plus isolated staged-transfer payment probes.

It checked ledger IDs, transaction dates and amounts, balance finiteness, budget persistence, weekly finance ticks, same-seed replay, different-seed divergence, and core-state atomicity on a rejected managed-club payment.

No accounting redesign, double-entry model, economic formula change, transfer-rule change, contract-rule change, RNG change, AI change, competition change, or performance optimization was made.

## Final findings

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 1
- **LOW:** 4
- **PASS:** 4

### MEDIUM. Transaction-to-balance reconciliation is not an implemented contract

- **Files:** [src/state/office-finance.ts](src/state/office-finance.ts), [src/state/finance.ts](src/state/finance.ts)
- **Behavior:** `recordTransaction` appends historical office ledger entries. `applyWeeklyFinanceTick` derives balance from income/expense snapshots, recurring costs, loan payments, and transfer expense snapshots.
- **Evidence:** Bounded season ledger net was `-685,000`, while weekly snapshot balance deltas were approximately `17.2M` because recurring finance effects were not represented by the manually appended ledger slice.
- **Classification:** The ledger is historical/reporting data, not a complete authoritative double-entry accounting source.
- **Recommendation:** Document this boundary or define a future accounting contract. No redesign was made in Step 5E.

### LOW. Sufficient-funds payment completion unverified

The synthetic negotiation offer was rejected during negotiation before reaching the payment branch. The audit does not claim sufficient-funds payment completion from this scenario.

### LOW. Exact-balance payment completion unverified

The exact-balance offer was also rejected before the payment branch. Exact-balance behavior remains unverified rather than inferred.

### LOW. Repeated completed payment unverified

Because the bounded offer did not complete, repeated completed-payment behavior was not claimed. Existing transfer hardening tests cover duplicate movement/event protection for the atomic transfer API.

### LOW. Accounting authority boundary

The current architecture intentionally separates transaction history from finance snapshots. Exact double-entry reconciliation is unavailable without a new accounting contract, which was outside scope.

## Three-season reconciliation results

| Season | Balance before/after tick | Ledger net | Snapshot net | Transactions | Duplicate IDs |
|---|---:|---:|---:|---:|---:|
| 2026/27 | €61,200,000 -> €17,700,000 | -€685,000 | €17,199,388 | 7 | 0 |
| 2027/28 | €17,700,000 -> €17,700,000 | -€685,000 | €17,199,823 | 11 | 0 |
| 2028/29 | €17,700,000 -> €17,700,000 | -€685,000 | €17,199,823 | 15 | 0 |

The large ledger/snapshot difference is expected from the current separation of reporting transactions and recurring finance snapshots; it is not treated as a hidden double-counting defect.

## Verified categories

### Ledger invariants

**PASS**

- non-finite transaction amounts: `0`
- non-finite balances: `0`
- invalid transaction IDs: `0`
- duplicate transaction IDs: `0`
- invalid transaction dates: `0`
- incomplete transaction records: `0`

### Three-season persistence

**PASS**

Three bounded seasons completed with stable transaction accumulation, finite balances, and non-negative budgets.

### Determinism

**PASS**

Same-seed runs produced identical financial state and transaction history. Final fingerprint length: `2,891` characters.

A different seed diverged in bounded financial state. Different fingerprint length: `2,889` characters.

### Insufficient-funds core atomicity

**PASS for the reached rejection path**

The bounded insufficient-funds negotiation was rejected before payment and left core financial, player, squad, contract, and ledger state unchanged. Negotiation status/event closure metadata changed as expected for a rejection.

The actual accepted-payment sufficiency branch was not reached by this synthetic negotiation fixture, so no broader payment claim is made.

## `office-finance.test.ts` investigation

The remaining failures are stale setup/count assumptions, not new reconciliation defects:

- `buildInitialState()` intentionally creates three enhanced-revenue initialization transactions, so tests expecting an empty ledger are stale.
- Tests expecting `recordTransaction` to produce exactly one, three, or two total transactions ignore those pre-existing initialization entries.
- Transfer-fee and wage-ledger expectations are now satisfied by the `RECORD_TRANSFER` fix from Step 5D.

No stale test was modified in this step.

## Tests and commands

### TypeScript

```text
npx tsc --noEmit
```

Result: **PASS**.

### Focused finance and transfer tests

```text
npx vitest run src/state/transfer-finance-ledger.test.ts src/state/transfer-ecosystem.test.ts src/state/transfer-integration.test.ts src/state/staged-transfer-negotiation.test.ts --reporter=dot
```

Result: **PASS**, including the new same-seed finance initialization and transfer-ledger regressions.

`office-finance.test.ts` was also investigated. Its remaining failures are stale transaction-count/empty-ledger expectations tied to enhanced-revenue initialization.

### Bounded audit

```text
npx tsx scripts/step-5e-financial-reconciliation-audit.ts
```

Result:

- three seasons completed
- zero CRITICAL/HIGH findings
- one MEDIUM architecture boundary
- four LOW unverified payment/accounting areas
- same-seed determinism passed
- different-seed divergence passed

## Files changed

- [scripts/step-5e-financial-reconciliation-audit.ts](scripts/step-5e-financial-reconciliation-audit.ts)
- [STEP-5E-FINANCIAL-RECONCILIATION-INSUFFICIENT-FUNDS-AUDIT.md](STEP-5E-FINANCIAL-RECONCILIATION-INSUFFICIENT-FUNDS-AUDIT.md)

No production files were modified in Step 5E. The production fixes and regression test referenced in this report were completed in Step 5D.

## Remaining unverified areas

- Full accepted managed-club sufficient-funds payment branch through a production-approved negotiation fixture.
- Exact-balance accepted payment.
- Repeated completed payment through the staged negotiation API.
- Exact transaction-to-balance reconciliation under a formal accounting contract.
- Contract expiry/release payment behavior.

## Stop point

Step 5E is complete. No Step 5F work or unrelated refactoring was started.
