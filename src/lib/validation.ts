/**
 * Validation utilities for game actions and user inputs
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate staff member name
 */
export function validateStaffName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: "Staff name cannot be empty" };
  }
  if (name.length > 50) {
    return { isValid: false, error: "Staff name must be 50 characters or less" };
  }
  return { isValid: true };
}

/**
 * Validate staff member role
 */
export function validateStaffRole(role: string): ValidationResult {
  const validRoles = [
    "Assistant Manager",
    "Coach",
    "Goalkeeper Coach",
    "Fitness Coach",
    "Analyst",
    "Scout",
  ];

  if (!validRoles.includes(role)) {
    return { isValid: false, error: "Invalid staff role" };
  }
  return { isValid: true };
}

/**
 * Validate staff rating
 */
export function validateStaffRating(rating: number): ValidationResult {
  if (rating < 1 || rating > 100) {
    return { isValid: false, error: "Staff rating must be between 1 and 100" };
  }
  return { isValid: true };
}

/**
 * Validate sufficient club balance for action
 */
export function validateSufficientBalance(balance: number, cost: number): ValidationResult {
  if (balance < cost) {
    return { isValid: false, error: "Insufficient club funds for this action" };
  }
  return { isValid: true };
}

/**
 * Validate player exists in system
 */
export function validatePlayerExists(
  playerId: string | undefined,
  playerMap: Record<string, any>,
): ValidationResult {
  if (!playerId || !playerMap[playerId]) {
    return { isValid: false, error: "Player not found" };
  }
  return { isValid: true };
}

/**
 * Validate club exists in system
 */
export function validateClubExists(
  clubId: string | undefined,
  clubMap: Record<string, any>,
): ValidationResult {
  if (!clubId || !clubMap[clubId]) {
    return { isValid: false, error: "Club not found" };
  }
  return { isValid: true };
}

/**
 * Batch validate multiple conditions
 */
export function validateAll(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true };
}
