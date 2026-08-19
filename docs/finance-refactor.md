**Finance refactor summary**

- **What changed:** Centralized authoritative club financial computation via `computeClubFinancials` in `src/state/club-finance.ts`. `buildWeeklyFinanceSnapshot` in `src/state/finance.ts` remains the weekly estimator used by the authoritative computation. Several AI decision entry points now request modeled profiles (pass `GameState` into `buildFinancialProfile`). `src/state/evolution.ts` now uses `computeClubFinancials` rather than ad-hoc income/expense estimates.
- **Files touched:** `src/state/ai-decisions.ts`, `src/state/ai-transfers.ts`, `src/state/negotiation.ts`, `src/state/evolution.ts`, `src/state/club-finance.ts` (no external API change), plus small patches to hook registration elsewhere.
- **Why:** Remove fragile import-time patching and duplicate finance logic; give AI deterministic, ledger-backed budgets so spending decisions are consistent with world state.
- **Known weaknesses / follow-ups:**
  - `computeClubFinancials` uses a set of heuristics and hard-coded factors; these should be parameterised and exposed as tuning constants or configurable JSON for balance tuning.
  - Loan modelling is simplistic (single default term); add loan fee, partial wage coverage and recall behavior for realism.
  - AI heuristics (risk appetite, multi-season forecasting) remain simple — recommended next step is to add scenario simulators and automated tests to tune thresholds.
  - No dedicated unit tests were added in this change — add scenario tests for at least 4 archetypes (rich, poor, rebuilding, promotion-challenger).

- **Next steps (recommended):**
  1. Add configuration for finance factors (`config/finance.json`) and read it from `buildWeeklyFinanceSnapshot`.
  2. Implement loan product features in `finance.ts` and reflect them in `computeClubFinancials`.
  3. Add scenario tests in `scripts/` and CI job to run them.

Generated on: 2026-08-12
