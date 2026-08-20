# Step 5C Loans, Contract Lifecycle and Player Movement Audit

## Scope

This audit used a bounded two-club scenario across three consecutive seasons. It focused on the unverified movement areas from Step 5B and called the existing production APIs for atomic transfers, contract ownership, loan-history recording, and monthly development.

No transfer redesign, loan-system invention, contract-rule redesign, match-engine change, AI change, finance change, competition change, RNG change, or performance optimization was made.

## Final findings

- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 2
- **PASS:** 5

### LOW. Complete temporary-club loan lifecycle is unverified

- **File:** [src/state/player-development.ts](src/state/player-development.ts)
- **Function:** `recordPlayerLoan`
- **Evidence:** The operation records `loanHistory`, but does not move the player between `club.playerIds`, expose temporary-club ownership, or provide a loan-return operation.
- **Impact:** Loan creation history is testable, but temporary squad membership, development at the loan club, completion, and return cannot be verified without inventing behavior.
- **Decision:** Reported as UNVERIFIED; no production behavior was invented.

### LOW. Contract expiry and termination are unverified

- **File:** [src/state/types.ts](src/state/types.ts)
- **Contract model:** `Contract`
- **Evidence:** Contract status supports `active`, `expiring`, `negotiating`, and `released`, but no authoritative expiry, release, or termination operation was found that updates player and squad ownership.
- **Impact:** Expiry, renewal completion, release, expired-player transfer, and contract termination remain outside verified coverage.
- **Decision:** Reported as UNVERIFIED; no speculative lifecycle function was added.

## Reproducible defect fixed

### Duplicate identical loan records

- **Root cause:** `recordPlayerLoan` always appended a new history entry using the deterministic ID `loan-${playerId}-${startDate}` without checking whether that ID already existed.
- **Observed result:** Repeating the same operation across three seasons produced `6` duplicate logical loan records.
- **Fix:** Return the original state when the deterministic loan ID is already present in `player.loanHistory`.
- **Regression:** [src/state/loan-history.test.ts](src/state/loan-history.test.ts) verifies repeated identical loan creation leaves exactly one record.
- **Safety:** No squad movement, loan rules, dates, RNG, or contract behavior changed.

## Three-season results

| Season | Transfer | Loan records | Duplicate loans | Active players | Players without club | Contract rows |
|---|---|---:|---:|---:|---:|---:|
| 2026/27 | `vidal` | 1 | 0 | 4 | 0 | 4 |
| 2027/28 | `okafor` | 2 | 0 | 4 | 0 | 4 |
| 2028/29 | `brennan` | 3 | 0 | 4 | 0 | 4 |

## Verified behavior

### Movement invariants

**PASS**

Across three seasons:

- duplicate player IDs: `0`
- players in multiple active squads: `0`
- invalid club references: `0`
- retired players active: `0`
- duplicate contracts: `0`
- orphaned players: `0`

### Transfer and contract ownership

**PASS**

Each transfer retained valid destination ownership and contract rows. `verifyTransferConsistency` passed for every transferred player.

### Loan record uniqueness

**PASS after fix**

Repeating an identical loan operation now produces no duplicate `loanHistory` records. Final audit count: `0` duplicates.

### Multi-season persistence

**PASS for bounded movement state**

Three consecutive seasons retained valid player identity, club pointers, squad membership, contract rows, and monthly development state.

### Same-seed determinism

**PASS**

Two complete three-season runs with the same seed produced identical movement, loan history, contract state, player state, and final fingerprint.

Final same-seed fingerprint length: `16,331` characters.

### Different-seed divergence

**PASS**

The different seed diverged in the bounded movement state. The different final fingerprint length was `16,335` characters.

## Unverified behavior

The following were deliberately not simulated through invented state mutations:

- temporary loan-club squad membership
- parent-club ownership during a loan
- loan development at the temporary club
- loan completion and return
- contract expiry processing
- contract release/termination
- expired-contract transfer behavior
- renewal completion through a full authoritative contract lifecycle
- retirement plus transfer/loan edge cases

Contract renewal/session behavior is covered by existing negotiation tests, but a complete expiry-to-release lifecycle was not found.

## Tests and commands

### TypeScript

```text
npx tsc --noEmit
```

Result: **PASS**.

### Focused tests

```text
npx vitest run src/state/loan-history.test.ts src/state/transfer-ecosystem.test.ts src/state/transfer-integration.test.ts src/state/staged-transfer-negotiation.test.ts --reporter=dot
```

Result:

- `4` test files passed
- `22` tests passed

### Bounded audit

```text
npx tsx scripts/step-5c-loans-contract-lifecycle-audit.ts
```

Result:

- three seasons completed
- duplicate loan records: `0`
- zero CRITICAL/HIGH/MEDIUM findings
- two LOW unverified lifecycle areas
- same-seed determinism passed
- different-seed divergence passed

A broader `office-finance.test.ts` run still has four pre-existing failures around financial initialization and transfer transactions; those are outside this audit and were not changed.

## Files changed

- [src/state/player-development.ts](src/state/player-development.ts)
- [src/state/loan-history.test.ts](src/state/loan-history.test.ts)
- [scripts/step-5c-loans-contract-lifecycle-audit.ts](scripts/step-5c-loans-contract-lifecycle-audit.ts)
- [STEP-5C-LOANS-CONTRACT-LIFECYCLE-AUDIT.md](STEP-5C-LOANS-CONTRACT-LIFECYCLE-AUDIT.md)

## Stop point

Step 5C is complete. No Step 5D work or unrelated refactoring was started.
