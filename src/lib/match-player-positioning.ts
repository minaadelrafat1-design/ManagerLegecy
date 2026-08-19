/**
 * Real Match Player Positioning
 * ==============================
 *
 * Dynamically calculates player positions during a match based on:
 * - Ball location and possession
 * - Player role and formation
 * - Match phase (attacking/defending)
 * - Recent match events
 * - Tactical instructions (width, depth, tempo)
 *
 * Creates believable, fluid movement patterns that respond to live match events.
 */

import type { PitchPlayer, MatchEventType } from "@/components/match-bits";
import type { Pos } from "@/data/squad";

export interface PositioningContext {
  ballX: number;
  ballY: number;
  possession: "home" | "away";
  minute: number;
  attackingTeam: "home" | "away";
  defendingTeam: "home" | "away";
  width: number; // 0-100 tactical width
  depth: number; // 0-100 defensive depth
  tempo: number; // 0-100 pressing intensity
  pressing?: number; // 0-100 team pressing
  mentality?: number; // 0-100 attacking mentality
  formation: string; // e.g. "4-3-3"
  awayFormation?: string;
}

/**
 * Base starting positions for each role (0-100 coordinate system)
 * These are the "home" formation positions (will be mirrored for away team)
 */
const FORMATION_POSITIONS: Record<Pos, { x: number; y: number }> = {
  GK: { x: 50, y: 94 },

  // Defenders
  CB: { x: 50, y: 78 },
  LB: { x: 25, y: 75 },
  RB: { x: 75, y: 75 },

  // Midfielders
  CDM: { x: 50, y: 58 },
  CM: { x: 50, y: 48 },
  CAM: { x: 50, y: 35 },

  // Forwards
  LW: { x: 25, y: 30 },
  RW: { x: 75, y: 30 },
  ST: { x: 50, y: 15 },
};

/**
 * How aggressively each position chases the ball
 * Higher = more aggressive pressure/support
 */
const BALL_CHASE_INTENSITY: Record<Pos, number> = {
  GK: 0.1,

  CB: 0.3,
  LB: 0.5,
  RB: 0.5,

  CDM: 0.7,
  CM: 0.8,
  CAM: 0.9,

  LW: 0.9,
  RW: 0.9,
  ST: 1.0,
};

/**
 * How far each position will venture from their base
 * Higher = more fluid, less structured
 */
const MOVEMENT_RANGE: Record<Pos, number> = {
  GK: 6,

  CB: 8,
  LB: 12,
  RB: 12,

  CDM: 14,
  CM: 16,
  CAM: 18,

  LW: 20,
  RW: 20,
  ST: 22,
};

/**
 * Calculate the attacking shape adjustment based on tactical width
 * width 50 = default, 100 = stretched wide, 0 = narrow
 */
function getWidthAdjustment(pos: Pos, width: number): number {
  // Wide positions spread out more with increased width
  if (pos === "LW" || pos === "RW" || pos === "LB" || pos === "RB") {
    return (width - 50) * 0.3; // 0-30 units spread
  }
  return 0;
}

/**
 * Calculate defensive line height based on tactical depth
 * depth 50 = default, 100 = high press, 0 = deep block
 */
function getDepthAdjustment(pos: Pos, depth: number, isDefending: boolean): number {
  if (!isDefending) return 0;

  const adjustmentMap: Record<Pos, number> = {
    GK: 2,
    CB: 4,
    LB: 3,
    RB: 3,
    CDM: 3,
    CM: 1,
    CAM: 0,
    LW: 0,
    RW: 0,
    ST: 0,
  };

  // depth 50 = no adjustment, 0 = push back 5, 100 = push forward 5
  return ((depth - 50) / 50) * adjustmentMap[pos];
}

/**
 * Calculate how much a player moves toward the ball
 * Attacking players chase harder, defenders mark space
 */
function calculateBallMovement(
  pos: Pos,
  ballX: number,
  ballY: number,
  baseX: number,
  baseY: number,
  isAttacking: boolean,
  tempo: number,
): { x: number; y: number } {
  const intensity = BALL_CHASE_INTENSITY[pos];
  const range = MOVEMENT_RANGE[pos];

  // Calculate direction to ball
  const dx = ballX - baseX;
  const dy = ballY - baseY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 2) {
    // Already at ball
    return { x: 0, y: 0 };
  }

  // Normalize direction
  const dirX = dx / distance;
  const dirY = dy / distance;

  // Tempo affects urgency (0-100)
  const tempoFactor = 0.3 + (tempo / 100) * 0.7; // 0.3-1.0

  // Attacking players move toward ball aggressively
  // Defending players move toward ball from behind
  const aggressionModifier = isAttacking ? intensity * 1.2 : intensity * 0.7;

  // Calculate movement: pull toward ball but stay within range
  const moveDistance = Math.min(range, distance * aggressionModifier * tempoFactor);

  return {
    x: dirX * moveDistance,
    y: dirY * moveDistance,
  };
}

/**
 * Calculate positioning based on team formation and attacking/defending
 */
function calculateFormationOffset(
  pos: Pos,
  isLeftSide: boolean,
  width: number,
  depth: number,
  isDefending: boolean,
): { x: number; y: number } {
  const basePos = FORMATION_POSITIONS[pos];
  let x = basePos.x;
  let y = basePos.y;

  // Apply width adjustment
  const widthAdj = getWidthAdjustment(pos, width);
  if (isLeftSide) {
    x -= widthAdj * 0.5;
  } else {
    x += widthAdj * 0.5;
  }

  // Apply depth adjustment (for defending team)
  const depthAdj = getDepthAdjustment(pos, depth, isDefending);
  y += depthAdj;

  return { x, y };
}

function instructionOffset(
  player: PitchPlayer,
  context: PositioningContext,
): { x: number; y: number } {
  const config = (player as PitchPlayer & { tacticalConfig?: { instructions?: string[] } })
    .tacticalConfig;
  const instructions = (config?.instructions ?? []).map((item) => item.toLowerCase());
  const role = (player.role ?? "").toLowerCase();
  let x = 0;
  let y = 0;

  if (instructions.some((item) => item.includes("stay-wide"))) {
    x += player.pos === "LW" || player.pos === "LB" ? -5 : player.pos === "RW" || player.pos === "RB" ? 5 : 0;
  }
  if (instructions.some((item) => item.includes("cut-inside"))) {
    x += player.pos === "LW" ? 5 : player.pos === "RW" ? -5 : 0;
  }
  if (instructions.some((item) => item.includes("get-behind") || item.includes("forward"))) y -= 5;
  if (instructions.some((item) => item.includes("stay-back") || item.includes("hold-position"))) y += 5;
  if (instructions.some((item) => item.includes("overlap")) && (player.pos === "LB" || player.pos === "RB")) y -= 7;
  if (instructions.some((item) => item.includes("press"))) y += context.possession === "home" ? -2 : 2;
  if (role.includes("attacking") || role.includes("advanced") || role.includes("playmaker")) y -= 2;
  if (role.includes("anchor") || role.includes("defensive") || role.includes("no-nonsense")) y += 2;
  return { x, y };
}

/**
 * Add some natural drift/breathing room so players aren't frozen
 * Varies smoothly over time so it looks like gentle repositioning
 */
function addNaturalDrift(
  baseX: number,
  baseY: number,
  pos: Pos,
  minute: number,
): { x: number; y: number } {
  // Use sine waves with different frequencies for each position
  // so they drift in and out naturally over 10-20 second cycles
  const freq = 0.3 + (MOVEMENT_RANGE[pos] / 25) * 0.3;
  const driftAmount = 1.5;

  const driftX = Math.sin(minute * freq + baseX) * driftAmount;
  const driftY = Math.cos(minute * freq + baseY) * driftAmount;

  return { x: driftX, y: driftY };
}

/**
 * Calculate a player's position during the match
 * This is called every minute to update positions based on live game state
 */
export function calculatePlayerPosition(
  player: PitchPlayer,
  context: PositioningContext,
  isHome: boolean,
): { x: number; y: number } {
  const isAttackingTeam = context.attackingTeam === (isHome ? "home" : "away");
  const isDefendingTeam = context.defendingTeam === (isHome ? "home" : "away");

  // Determine left/right side consistently (always from attacking perspective)
  // For home team: left < 50, right > 50
  // For away team after mirroring: left > 50, right < 50
  let isLeftSide: boolean;
  const pos = player.pos as Pos;

  // Get base formation position (always from home perspective first)
  const baseFormPos = FORMATION_POSITIONS[pos];
  isLeftSide = baseFormPos.x < 50;

  const formation = isHome ? context.formation : (context.awayFormation ?? context.formation);
  const basePos = calculateFormationOffset(
    pos,
    isLeftSide,
    context.width,
    context.depth,
    isDefendingTeam,
  );
  if (formation === "4-2-3-1") {
    if (player.pos === "CDM") basePos.y += 4;
    if (player.pos === "CAM") basePos.y -= 3;
  } else if (formation === "3-5-2") {
    if (player.pos === "CB") basePos.y += 3;
    if (player.pos === "CM" || player.pos === "CDM") basePos.y -= 2;
  } else if (formation === "5-3-2") {
    if (player.pos === "RB" || player.pos === "LB") basePos.y += 4;
    if (player.pos === "ST") basePos.y -= 2;
  }
  const tacticalDepth = (((context.mentality ?? 50) - 50) / 50) * 3 + (((context.pressing ?? 50) - 50) / 50) * 2;
  const localOffset = instructionOffset(player, context);
  basePos.y += isAttackingTeam ? -tacticalDepth : tacticalDepth;
  basePos.x += localOffset.x;
  basePos.y += localOffset.y;

  // Mirror positions for away team
  if (!isHome) {
    basePos.x = 100 - basePos.x;
    basePos.y = 100 - basePos.y;
  }

  // Calculate movement toward ball
  const ballMovement = calculateBallMovement(
    player.pos as Pos,
    isHome ? context.ballX : 100 - context.ballX,
    isHome ? context.ballY : 100 - context.ballY,
    basePos.x,
    basePos.y,
    isAttackingTeam,
    context.tempo,
  );

  // Add natural drift
  const drift = addNaturalDrift(basePos.x, basePos.y, player.pos as Pos, context.minute);

  // Combine all movements
  let finalX = basePos.x + ballMovement.x + drift.x;
  let finalY = basePos.y + ballMovement.y + drift.y;

  // Keep players in bounds with some margin
  finalX = Math.max(3, Math.min(97, finalX));
  finalY = Math.max(3, Math.min(97, finalY));

  return { x: finalX, y: finalY };
}

/**
 * Update all player positions for both teams
 */
export function updateAllPlayerPositions(
  homePlayers: PitchPlayer[],
  awayPlayers: PitchPlayer[],
  context: PositioningContext,
): {
  homePlayers: Array<PitchPlayer & { x: number; y: number }>;
  awayPlayers: Array<PitchPlayer & { x: number; y: number }>;
} {
  const updatedHome = homePlayers.map((p) => {
    const pos = calculatePlayerPosition(p, context, true);
    return { ...p, ...pos };
  });

  const updatedAway = awayPlayers.map((p) => {
    const pos = calculatePlayerPosition(p, context, false);
    return { ...p, ...pos };
  });

  return { homePlayers: updatedHome, awayPlayers: updatedAway };
}

/**
 * Smooth interpolation between positions to avoid teleporting
 */
export function smoothPosition(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  smoothFactor: number = 0.3,
): { x: number; y: number } {
  return {
    x: currentX + (targetX - currentX) * smoothFactor,
    y: currentY + (targetY - currentY) * smoothFactor,
  };
}
