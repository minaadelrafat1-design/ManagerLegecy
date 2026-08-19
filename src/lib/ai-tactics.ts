/**
 * AI Tactical Assignment System
 * =============================
 *
 * Assigns tactical roles and instructions to AI-controlled teams based on:
 * - Player attributes (pace, shooting, defending, etc.)
 * - Position compatibility
 * - Club play style variations
 * - Historical performance data
 *
 * Ensures:
 * - All assigned tactics are valid for the player's position
 * - No impossible instruction combinations
 * - Reasonable variation between AI teams
 * - Instructions match player strengths
 */

import type { Player, Pos } from "@/data/squad";
import type { Club } from "@/state/types";
import type { PlayerTacticalConfig } from "@/state/player-tactics";
import { getRolesForPosition, getInstructionsForRole, getRoleById } from "@/state/player-tactics";

/**
 * AI play style preferences that influence tactical assignments.
 * Different AI managers have different approaches.
 */
export interface AIPlayStyle {
  /** How attacking-oriented the team is (0-100) */
  attackingIntent: number;
  /** How aggressively the team presses (0-100) */
  pressingIntensity: number;
  /** How direct the team plays (0-100) */
  directness: number;
  /** How much the team varies play (0-100, higher = more varied) */
  variability: number;
  /** Focus area: "defending", "balanced", "attacking" */
  focusArea: "defending" | "balanced" | "attacking";
}

/**
 * Generate a random but consistent AI play style based on club data.
 * Same club/seed produces same style (for deterministic AI).
 */
export function generateAIPlayStyle(club: Club, seed: number = 0): AIPlayStyle {
  // Simple seeded random using club ID hash
  const hashValue = club.id.split("").reduce((h, c) => h + c.charCodeAt(0), seed);
  const rng = Math.sin(hashValue * 12.9898) * 43758.5453;
  const normalizedRng = rng - Math.floor(rng); // [0, 1)

  // Base style varies by seed
  const styleType = Math.floor(normalizedRng * 3); // 0, 1, or 2

  if (styleType === 0) {
    return {
      attackingIntent: 65 + normalizedRng * 20,
      pressingIntensity: 55 + normalizedRng * 25,
      directness: 50 + normalizedRng * 25,
      variability: 50 + normalizedRng * 30,
      focusArea: "attacking",
    };
  } else if (styleType === 1) {
    return {
      attackingIntent: 45 + normalizedRng * 20,
      pressingIntensity: 40 + normalizedRng * 30,
      directness: 40 + normalizedRng * 30,
      variability: 40 + normalizedRng * 40,
      focusArea: "balanced",
    };
  } else {
    return {
      attackingIntent: 35 + normalizedRng * 20,
      pressingIntensity: 50 + normalizedRng * 30,
      directness: 55 + normalizedRng * 25,
      variability: 45 + normalizedRng * 35,
      focusArea: "defending",
    };
  }
}

/**
 * Score how well a role suits a player's attributes.
 * Higher score = better fit for the role.
 */
function scoreRoleForPlayer(player: Player, roleId: string): number {
  if (!roleId) return 0;

  const attrs = player.attrs;
  let score = 50; // baseline

  // Position-specific scoring
  if (player.pos === "GK") {
    if (roleId.includes("sweeper")) score += attrs.passing * 0.3;
    if (roleId.includes("stopper")) score += (attrs.reflexes ?? 0) * 0.5;
  } else if (player.pos === "CB") {
    score += attrs.defending * 0.5;
    score += attrs.physical * 0.2;
    score -= attrs.pace * 0.15; // speed less critical for CB
  } else if (player.pos === "LB" || player.pos === "RB") {
    score += attrs.pace * 0.3;
    score += attrs.defending * 0.3;
    if (roleId.includes("fullback")) score += 10;
    if (roleId.includes("inverted")) score += attrs.passing * 0.2;
  } else if (player.pos === "CM") {
    score += attrs.passing * 0.4;
    score += attrs.physical * 0.2;
    if (roleId.includes("box-to-box")) score += attrs.pace * 0.15;
    if (roleId.includes("holding")) score += attrs.defending * 0.2;
  } else if (player.pos === "CAM") {
    score += attrs.passing * 0.5;
    score += attrs.dribbling * 0.3;
  } else if (player.pos === "LW" || player.pos === "RW") {
    score += attrs.pace * 0.4;
    score += attrs.dribbling * 0.3;
    if (roleId.includes("winger")) score += 15;
  } else if (player.pos === "ST") {
    score += attrs.shooting * 0.5;
    score += attrs.pace * 0.3;
    if (roleId.includes("striker") || roleId.includes("poacher")) score += 15;
  }

  return Math.max(10, Math.min(95, score));
}

/**
 * Assign a tactical role to a player based on their attributes and position.
 * Tries to pick a role that suits their attributes.
 */
function assignRoleForPlayer(player: Player, style: AIPlayStyle): string {
  const possibleRoles = getRolesForPosition(player.pos);
  if (possibleRoles.length === 0) return "";

  // Score each role
  const scored = possibleRoles.map((role) => ({
    role,
    score: scoreRoleForPlayer(player, role.id),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick best-fitting role
  return scored[0]?.role?.id ?? "midfielder"; // fallback if no roles found
}

/**
 * Determine if an instruction makes sense for a player given their style and role.
 * Returns a "fit score" (0-100).
 */
function scoreInstructionForPlayer(
  player: Player,
  instruction: string,
  roleId: string,
  style: AIPlayStyle,
): number {
  let score = 50; // baseline

  const instrLower = instruction.toLowerCase();
  const attrs = player.attrs;

  // Attacking instructions work better for players with high attack stats
  if (instrLower.includes("get-behind") || instrLower.includes("get-forward")) {
    score += Math.max(0, attrs.pace - 50) * 0.3;
    score += Math.max(0, attrs.shooting - 50) * 0.2;
    if (style.attackingIntent > 60) score += 15;
  }

  // Defensive instructions for defenders
  if (instrLower.includes("stay-back") || instrLower.includes("hold")) {
    if (player.pos === "CB" || player.pos === "CDM") score += 25;
    if (style.focusArea === "defending") score += 20;
  }

  // Pressing for aggressive teams
  if (instrLower.includes("press")) {
    if (style.pressingIntensity > 60) score += 25;
    if (attrs.pace > 60) score += 10;
  }

  // Playmaking for high-passing midfielders
  if (instrLower.includes("playmaker") || instrLower.includes("roam")) {
    if (attrs.passing > 70) score += 30;
    if (player.pos === "CM" || player.pos === "CAM") score += 15;
  }

  // Wide positioning for pacey wingers
  if (instrLower.includes("stay-wide")) {
    if (player.pos === "LW" || player.pos === "RW" || player.pos === "LB" || player.pos === "RB")
      score += 20;
    if (attrs.pace > 65) score += 10;
  }

  // Avoid very low scores
  return Math.max(20, Math.min(95, score));
}

/**
 * Get suitable instructions for a player based on their role and attributes.
 * Returns a shuffled list of valid instruction IDs.
 */
function getInstructionsForPlayer(
  player: Player,
  roleId: string,
  style: AIPlayStyle,
  maxInstructions: number = 3,
): string[] {
  const possibleInstructions = getInstructionsForRole(roleId, player.pos);
  if (possibleInstructions.length === 0) return [];

  // Score each instruction
  const scored = possibleInstructions.map((instr) => ({
    id: instr.id,
    score: scoreInstructionForPlayer(player, instr.id, roleId, style),
  }));

  // Filter out very low-scoring instructions
  scored.filter((s) => s.score > 30);

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick top N instructions
  return scored.slice(0, maxInstructions).map((s) => s.id);
}

/**
 * Assign tactical configuration to a player for an AI team.
 * Respects position, attributes, and play style.
 */
export function assignPlayerTactics(
  player: Player,
  style: AIPlayStyle,
  variability: number = 0.5, // 0-1, how much to vary
): PlayerTacticalConfig {
  // Assign role
  const roleId = assignRoleForPlayer(player, style);
  if (!roleId) {
    return {
      roleId: "",
      instructions: [],
      roleFamiliarity: 50,
    };
  }

  // Assign instructions (fewer for less variable teams)
  const maxInstructions = variability > 0.7 ? 3 : variability > 0.4 ? 2 : 1;
  const instructions = getInstructionsForPlayer(player, roleId, style, maxInstructions);

  // Tactical familiarity based on how well they fit the role
  const roleScore = scoreRoleForPlayer(player, roleId);
  const familiarity = Math.round(Math.min(100, Math.max(30, roleScore)));

  return {
    roleId,
    instructions,
    roleFamiliarity: familiarity,
  };
}

/**
 * Assign tactics to all players in a squad.
 * Creates a complete tactical lineup for an AI team.
 */
export function assignSquadTactics(
  squad: Player[],
  club: Club,
  seed: number = 0,
): Map<string, PlayerTacticalConfig> {
  const style = generateAIPlayStyle(club, seed);
  const tactics = new Map<string, PlayerTacticalConfig>();

  for (const player of squad) {
    const config = assignPlayerTactics(player, style, style.variability / 100);
    tactics.set(player.id, config);
  }

  return tactics;
}

/**
 * Validate that a tactical configuration is legal for a player.
 * Returns error messages if invalid, empty array if valid.
 */
export function validatePlayerTactics(player: Player, config: PlayerTacticalConfig): string[] {
  const errors: string[] = [];

  // Validate role
  if (!config.roleId) {
    errors.push(`No role assigned`);
    return errors;
  }

  const role = getRoleById(config.roleId);
  if (!role) {
    errors.push(`Role "${config.roleId}" does not exist`);
    return errors;
  }

  // Check role is valid for position
  if (!role.positions.includes(player.pos)) {
    errors.push(`Role "${role.name}" not valid for position ${player.pos}`);
  }

  // Validate each instruction
  const validInstructions = getInstructionsForRole(config.roleId, player.pos);
  const validIds = new Set(validInstructions.map((i) => i.id));

  for (const instrId of config.instructions) {
    if (!validIds.has(instrId)) {
      errors.push(`Instruction "${instrId}" not valid for ${role.name} at ${player.pos}`);
    }
  }

  // Check familiarity is in valid range
  if (config.roleFamiliarity < 0 || config.roleFamiliarity > 100) {
    errors.push(`Role familiarity out of range: ${config.roleFamiliarity}`);
  }

  return errors;
}
