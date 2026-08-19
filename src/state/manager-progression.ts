/* =============================================================================
 * Manager progression — reputation vs. credit
 * =============================================================================
 * Phase C2. Two related but distinct numbers live on `Manager`:
 *
 *  REPUTATION — what the football world thinks of this manager. Global,
 *  travels with them to their next job, and is what job opportunities,
 *  player interest and negotiation credibility actually get weighed
 *  against (see the field doc on `Manager.reputation` in `./types`).
 *  Reputation moves slowly — a handful of points a season at most — because
 *  a whole industry's opinion doesn't swing on one result the way a single
 *  boardroom's does.
 *
 *  CREDIT — trust earned specifically at the CURRENT club. It is what
 *  actually moves season-to-season off results (see `CREDIT_DELTA_BY_TIER`
 *  below, using the brief's suggested values), and — critically — it acts
 *  as a buffer: the more of it a manager has banked, the less a single bad
 *  season can take away. That's `applySeasonPerformance`'s whole job: it is
 *  deliberately NOT a flat "subtract the tier's number" — see the
 *  dampening comment inside.
 *
 * This module is pure (no React, no dispatch) — `state/reducer.ts` wires
 * `applySeasonPerformance` into the one action that's allowed to touch
 * `state.manager` for this.
 * ---------------------------------------------------------------------------*/

import type { Manager, SeasonPerformanceTier } from "./types";

export { type SeasonPerformanceTier } from "./types";

export const SEASON_TIER_LABEL: Record<SeasonPerformanceTier, string> = {
  great: "Great Season",
  good: "Good Season",
  expected: "As Expected",
  bad: "Bad Season",
  terrible: "Terrible Season",
};

/** The brief's suggested values, verbatim. This is the RAW delta — what
 * gets applied to `expected`/positive tiers directly, and what
 * `applySeasonPerformance` dampens for negative tiers via the credit
 * buffer below. */
export const CREDIT_DELTA_BY_TIER: Record<SeasonPerformanceTier, number> = {
  great: 10,
  good: 5,
  expected: 0,
  bad: -8,
  terrible: -15,
};

/** Reputation is the slower, global cousin of credit — see the module doc.
 * A season that delights or disgraces one boardroom barely moves what the
 * wider game thinks; it takes a body of work to do that. */
export const REPUTATION_DELTA_BY_TIER: Record<SeasonPerformanceTier, number> = {
  great: 3,
  good: 1,
  expected: 0,
  bad: -2,
  terrible: -4,
};

/** Board confidence: how secure the manager's job is at this club.
 * Starts at 50, affected by season performance and credit buffer.
 * <20 = likely to be fired; >70 = promotion offers incoming. */
export const BOARD_CONFIDENCE_DELTA_BY_TIER: Record<SeasonPerformanceTier, number> = {
  great: 8, // great season: board believes in you
  good: 4, // good season: board satisfied
  expected: 0, // expected: no change in confidence
  bad: -6, // bad season: board concerned
  terrible: -12, // terrible: board loses faith
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export interface SeasonReviewResult {
  tier: SeasonPerformanceTier;
  /** The brief's suggested delta before the credit buffer softened it. */
  rawCreditDelta: number;
  /** What was actually applied to credit, after buffering. */
  creditDelta: number;
  /** How many points the buffer absorbed (rawCreditDelta - creditDelta,
   * always >= 0 — the buffer only ever helps, never hurts). */
  bufferAbsorbed: number;
  creditBefore: number;
  creditAfter: number;
  reputationDelta: number;
  reputationBefore: number;
  reputationAfter: number;
  /** Board confidence change based on season tier. */
  boardConfidenceDelta: number;
  boardConfidenceBefore: number;
  boardConfidenceAfter: number;
}

/** Applies one season's result to a manager's credit and reputation.
 *
 * The buffer mechanic: a negative credit delta is dampened by up to 50%,
 * scaled by how much credit is already banked (`credit / 200`, capped at
 * 0.5). A manager with nothing banked (credit 0) takes the suggested hit
 * in full — there's no goodwill left to spend. A manager who has built
 * maximum credit (100, i.e. several great/good seasons) only takes about
 * half of it — even a genuinely "terrible" -15 season costs them roughly
 * -7 to -8, not -15. That's what keeps one bad season from erasing years
 * of success while still making a bad season sting, and why credit is
 * described as a buffer rather than a simple running total. Positive
 * deltas are never dampened — nothing about the buffer discourages having
 * a good season.
 */
export function applySeasonPerformance(
  manager: Pick<Manager, "credit" | "reputation"> & { boardConfidence?: number },
  tier: SeasonPerformanceTier,
): SeasonReviewResult {
  const rawCreditDelta = CREDIT_DELTA_BY_TIER[tier];
  const creditStart = manager.credit ?? 50;
  const dampening = rawCreditDelta < 0 ? Math.min(0.5, creditStart / 200) : 0;
  const creditDelta = Math.round(rawCreditDelta * (1 - dampening));
  const creditAfter = clamp(creditStart + creditDelta);

  const reputationStart = manager.reputation ?? 50;
  const reputationDelta = REPUTATION_DELTA_BY_TIER[tier];
  const reputationAfter = clamp(reputationStart + reputationDelta);

  // REALISM: Board confidence affects job security
  // Starts at 50; credit buffer softens the hit similarly to credit system
  const boardConfidenceDelta = BOARD_CONFIDENCE_DELTA_BY_TIER[tier];
  const boardConfidenceBefore = manager.boardConfidence ?? 50;
  const boardConfidenceAfter = clamp(boardConfidenceBefore + boardConfidenceDelta);

  return {
    tier,
    rawCreditDelta,
    creditDelta,
    bufferAbsorbed: rawCreditDelta - creditDelta,
    creditBefore: creditStart,
    creditAfter,
    reputationDelta,
    reputationBefore: reputationStart,
    reputationAfter,
    boardConfidenceDelta,
    boardConfidenceBefore,
    boardConfidenceAfter,
  };
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** A one-line human summary for `CareerEvent.summary` — e.g. "Bad Season at
 * Millbrook Town: credit -6 (buffer absorbed 2), reputation -2." */
export function describeSeasonReview(clubName: string, result: SeasonReviewResult): string {
  const bufferNote = result.bufferAbsorbed > 0 ? ` (buffer absorbed ${result.bufferAbsorbed})` : "";
  return (
    `${SEASON_TIER_LABEL[result.tier]} at ${clubName}: ` +
    `credit ${signed(result.creditDelta)}${bufferNote}, ` +
    `reputation ${signed(result.reputationDelta)}.`
  );
}
