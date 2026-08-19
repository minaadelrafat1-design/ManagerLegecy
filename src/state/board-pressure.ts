/**
 * Board pressure constraints.
 * When board confidence is low, they impose spending caps and tactical restrictions.
 * These functions are called by the UI/reducer to enforce board-imposed limits.
 */

import type { GameState } from "./types";

/** Calculate the maximum transfer budget the board will allow.
 * Low confidence = tight purse strings. */
export function getBoardTransferBudgetLimit(state: GameState): number {
  const boardConfidence = state.board?.confidence ?? 50;
  const managerCredit = state.manager?.credit ?? 50;
  const baselinebudget =
    parseInt((state.finances?.transferBudget ?? "€0").replace(/[^0-9]/g, ""), 10) || 0;

  // Board confidence affects what percentage of budget manager can use
  // 80+: can spend freely (100%)
  // 60-79: restricted to 80%
  // 40-59: restricted to 60%
  // 20-39: restricted to 40%
  // <20: restricted to 20%
  let percentageAllowed = 1.0;
  if (boardConfidence < 80) percentageAllowed = 0.8;
  if (boardConfidence < 60) percentageAllowed = 0.6;
  if (boardConfidence < 40) percentageAllowed = 0.4;
  if (boardConfidence < 20) percentageAllowed = 0.2;

  // Manager credit can increase allowance (good track record gets more freedom)
  const creditBonus = (managerCredit - 50) / 1000; // +/-0.5% per point of credit
  percentageAllowed = Math.max(0.1, Math.min(1.0, percentageAllowed + creditBonus));

  return Math.round(baselinebudget * percentageAllowed);
}

/** Check if manager is under board pressure (confidence < 50). */
export function isUnderBoardPressure(state: GameState): boolean {
  const boardConfidence = state.board?.confidence ?? 50;
  return boardConfidence < 50;
}

/** Get a descriptive message about current board pressure level. */
export function getBoardPressureMessage(state: GameState): string {
  const confidence = state.board?.confidence ?? 50;
  if (confidence >= 80) return "Board is very confident in your management";
  if (confidence >= 60) return "Board is supportive of your decisions";
  if (confidence >= 40) return "Board is concerned about recent results";
  if (confidence >= 20) return "Board is seriously questioning your management";
  return "Board may dismiss you if results don't improve";
}

/** Get wage budget constraints from board. */
export function getBoardWageBudgetLimit(state: GameState): number {
  const boardConfidence = state.board?.confidence ?? 50;
  const currentWages =
    parseInt((state.finances?.wageBudget ?? "€0").replace(/[^0-9]/g, ""), 10) || 0;

  // Similar scaling as transfer budget
  let percentageAllowed = 1.0;
  if (boardConfidence < 80) percentageAllowed = 0.9;
  if (boardConfidence < 60) percentageAllowed = 0.8;
  if (boardConfidence < 40) percentageAllowed = 0.7;
  if (boardConfidence < 20) percentageAllowed = 0.6;

  return Math.round(currentWages * percentageAllowed);
}
