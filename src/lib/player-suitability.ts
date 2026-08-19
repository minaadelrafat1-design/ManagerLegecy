/**
 * Player Suitability Scoring for Tactical Roles
 *
 * Evaluates how well a player's attributes match a specific tactical role.
 * Used to show role recommendations and suitability feedback in the UI.
 *
 * Scoring is based on:
 * - Pace for running roles
 * - Strength/Physical for holding/aerial roles
 * - Technical ability for playmaking/creative roles
 * - Defensive ability for defensive roles
 * - Stamina for high-workrate roles
 * - Age/Experience for complex roles
 */

import type { Player as BasePlayer } from "@/data/squad";
import type { TacticalRole } from "@/state/player-tactics";

export interface RoleSuitabilityScore {
  roleId: string;
  roleName: string;
  score: number; // 0-100
  rationale: string; // Explanation of why this score
}

/**
 * Score how suitable a player is for a specific role.
 * Based on player attributes and role behavioral requirements.
 */
export function scorePlayerRoleSuitability(
  player: BasePlayer | null | undefined,
  role: TacticalRole | null | undefined,
): number {
  if (!player || !role) return 50; // neutral score if missing data
  const a = player.attrs;
  const score: number[] = [];

  // Base score: 50 (neutral)
  let baseScore = 50;

  // ========================================================================
  // GOALKEEPER SCORING
  // ========================================================================
  if (role.id === "gk-shot-stopper") {
    // Needs: reflexes, diving, positioning (GK attributes)
    // Estimate from available attributes
    const reflex = a.reflexes ?? 20; // default low for outfielders
    const handl = a.handling ?? 20; // default low for outfielders
    baseScore = reflex * 0.5 + handl * 0.35 + 10;
    if ((a.distribution ?? 20) < 40) baseScore -= 15; // penalize poor distribution
    score.push(baseScore);
  } else if (role.id === "gk-sweeper") {
    // Needs: distribution, rushing out, composure
    baseScore = (a.distribution ?? 20) * 0.4 + (a.handling ?? 20) * 0.2 + 15;
    if ((a.reflexes ?? 20) < 50) baseScore -= 10; // sweepers still need reflexes
    score.push(baseScore);
  }

  // ========================================================================
  // DEFENDER SCORING
  // ========================================================================
  else if (role.id === "cb-defender" || role.id === "cb-stopper") {
    // Core: defending, physical, positioning
    baseScore = a.defending * 0.5 + a.physical * 0.3 + 20;
    if ((a.heading ?? 0) < 45) baseScore -= 10; // CBs need heading
    score.push(baseScore);
  } else if (role.id === "cb-playmaker") {
    // Core: defending, passing, composure
    baseScore = a.defending * 0.35 + a.passing * 0.45 + 15;
    if (a.dribbling < 50) baseScore -= 5; // technical defenders need ball skills
    score.push(baseScore);
  } else if (
    role.id === "fb-fullback" ||
    role.id === "fb-attacking" ||
    role.id === "fb-inverted" ||
    role.id === "fb-wingback"
  ) {
    // Core: defending, pace, stamina (for athletic demands)
    baseScore = a.defending * 0.3 + a.pace * 0.35 + (a.stamina ?? 50) * 0.15 + 15;
    if (role.id === "fb-attacking" || role.id === "fb-wingback") {
      // Attacking fullbacks need crossing
      baseScore += (a.crossing ?? 50) * 0.2;
    }
    if (role.id === "fb-inverted") {
      // Inverted need passing/dribbling
      baseScore += (a.passing ?? 50) * 0.15;
    }
    score.push(baseScore);
  }

  // ========================================================================
  // MIDFIELDER SCORING
  // ========================================================================
  else if (role.id === "cm-box-to-box") {
    // Core: passing, stamina, pace, physical
    baseScore = a.passing * 0.35 + (a.stamina ?? 50) * 0.3 + a.pace * 0.2 + a.physical * 0.15;
    score.push(baseScore);
  } else if (role.id === "cm-playmaker") {
    // Core: passing, vision, composure, dribbling
    baseScore = a.passing * 0.5 + a.dribbling * 0.25 + (a.vision ?? 50) * 0.2 + 5;
    score.push(baseScore);
  } else if (role.id === "cm-mezzala") {
    // Core: dribbling, passing, pace
    baseScore = a.dribbling * 0.4 + a.passing * 0.3 + a.pace * 0.25 + 5;
    score.push(baseScore);
  } else if (role.id === "cm-holding") {
    // Core: defending, positioning, stamina
    baseScore = a.defending * 0.5 + a.physical * 0.25 + (a.stamina ?? 50) * 0.2 + 5;
    score.push(baseScore);
  } else if (role.id === "cdm-dlp") {
    // Core: passing, defending, composure
    baseScore = a.passing * 0.45 + a.defending * 0.35 + (a.vision ?? 50) * 0.15 + 5;
    score.push(baseScore);
  } else if (role.id === "cdm-anchor") {
    // Core: defending, positioning, physical, stamina
    baseScore = a.defending * 0.45 + a.physical * 0.3 + (a.stamina ?? 50) * 0.2 + 5;
    score.push(baseScore);
  }

  // ========================================================================
  // ATTACKING MIDFIELDER / WINGER SCORING
  // ========================================================================
  else if (role.id === "cam-playmaker" || role.id === "cam-shadow-striker") {
    // Core: dribbling, passing, shooting (for shadow), pace
    baseScore =
      a.dribbling * 0.35 +
      a.passing * 0.3 +
      (role.id === "cam-shadow-striker" ? a.shooting * 0.2 : 0) +
      a.pace * 0.15;
    score.push(baseScore);
  } else if (
    role.id === "lw-winger" ||
    role.id === "lw-inside-forward" ||
    role.id === "lw-wide-playmaker"
  ) {
    // Core: dribbling, pace, crossing (or shooting for inside forward)
    const crossingOrShoot =
      role.id === "lw-inside-forward"
        ? a.shooting * 0.25
        : role.id === "lw-wide-playmaker"
          ? (a.crossing ?? 50) * 0.15 + (a.passing ?? 50) * 0.15
          : (a.crossing ?? 50) * 0.25;
    baseScore = a.dribbling * 0.35 + a.pace * 0.3 + crossingOrShoot + 10;
    score.push(baseScore);
  }

  // ========================================================================
  // STRIKER SCORING
  // ========================================================================
  else if (role.id === "st-advanced" || role.id === "st-poacher") {
    // Core: shooting, pace, positioning
    baseScore = a.shooting * 0.5 + a.pace * 0.3 + 15;
    if (role.id === "st-poacher" && (a.positioning ?? 0) < 45) baseScore -= 10; // poachers need positioning
    score.push(baseScore);
  } else if (role.id === "st-target-forward") {
    // Core: strength, heading, physical
    baseScore = a.physical * 0.4 + (a.heading ?? 0) * 0.3 + (a.strength ?? 0) * 0.2 + 10;
    score.push(baseScore);
  } else if (role.id === "st-false-nine") {
    // Core: passing, dribbling, composure
    baseScore = a.passing * 0.35 + a.dribbling * 0.35 + a.shooting * 0.2 + 10;
    score.push(baseScore);
  }

  // Return average of all scores, clamped to 0-100
  if (score.length === 0) {
    baseScore = 50; // neutral if we didn't score anything
  } else {
    baseScore = score.reduce((a, b) => a + b, 0) / score.length;
  }

  return Math.max(0, Math.min(100, Math.round(baseScore)));
}

/**
 * Get suitability feedback text for a role score
 */
export function getRoleSuitabilityFeedback(score: number): string {
  if (score >= 85) return "Excellent fit";
  if (score >= 70) return "Good fit";
  if (score >= 55) return "Moderate fit";
  if (score >= 40) return "Poor fit";
  return "Not suited";
}

/**
 * Score all roles for a player, return sorted by score
 */
export function scoreAllRolesForPlayer(
  player: BasePlayer | null | undefined,
  availableRoles: TacticalRole[],
): RoleSuitabilityScore[] {
  if (!player || availableRoles.length === 0) return [];

  return availableRoles
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
      score: scorePlayerRoleSuitability(player, role),
      rationale: getRoleSuitabilityFeedback(scorePlayerRoleSuitability(player, role)),
    }))
    .sort((a, b) => b.score - a.score);
}
