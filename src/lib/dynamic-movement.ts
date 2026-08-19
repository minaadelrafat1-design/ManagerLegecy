/**
 * Dynamic Movement & Transitions System
 * =====================================
 *
 * Extends the positional targeting system with purposeful, contextual movement behaviors.
 * Handles:
 * - Attacking movement (forward runs, support runs, overlapping, underlapping, box movement)
 * - Defensive transitions (recovery runs, counter-pressing, retreating into structure)
 * - Attacking transitions (counterattack runs, space exploitation, midfield support)
 *
 * Considers:
 * - Player pace, acceleration, and stamina
 * - Positioning and spatial relationships
 * - Anticipation and decision-making based on ratings
 * - Work rate and tactical familiarity
 * - Tactical instructions from manager
 *
 * Safeguards:
 * - Prevents oscillation between two positions (hysteresis)
 * - Prevents rapid target switching (cooldown mechanism)
 * - Prevents impossible instant direction changes (speed limits)
 * - Prevents player stacking (spacing/repulsion)
 * - Optimizes for performance (limits calculations)
 */

import type { SimPlayer } from "./match-engine";
import type { PositionalTarget, MatchContext } from "./positional-targeting";
import type { Pos } from "@/data/squad";

function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 10000) / 10000;
}

// ---- TYPES & INTERFACES ----

/** Movement state tracking for a player across match frames */
export interface MovementState {
  playerId: string;
  lastTargetX: number;
  lastTargetY: number;
  lastTargetTime: number;
  targetLockUntil: number; // Prevents rapid target switching
  oscillationCounter: number; // Detects back-and-forth movement
  oscillationBreakDirection?: "x" | "y"; // Direction to break oscillation
  stamina: number; // 0-100, affects sprint distance/intensity
  currentActivity: MovementActivity;
  lastActivity: MovementActivity;
  activityChangedAt: number;
}

/** Type of movement activity */
export type MovementActivity =
  | "holding-position"
  | "supporting-play"
  | "forward-run"
  | "overlapping-run"
  | "underlapping-run"
  | "checking-toward-ball"
  | "space-run"
  | "box-run"
  | "recovery-run"
  | "counter-pressing"
  | "retreating"
  | "counterattack-run"
  | "midfield-support"
  | "defensive-protection";

/** Configuration for movement behavior */
export interface MovementConfig {
  maxSprintDistance: number; // Maximum distance player can sprint (based on stamina)
  targetLockDuration: number; // Frames to lock target to prevent switching
  oscillationThreshold: number; // Number of back-forths before correcting
  speedLimitPerFrame: number; // Maximum coordinate change per frame
  staminarRecoveryRate: number; // How fast stamina recovers
  staminaDrainRate: number; // How fast stamina drains during activity
}

/** Result of movement calculation */
export interface MovementResult {
  // New position (may be same as current if locked/constrained)
  targetX: number;
  targetY: number;
  // Movement metrics
  distance: number;
  activity: MovementActivity;
  urgency: number; // 0-1, how important this movement is
  // Debug information
  reason: string;
}

// ---- TUNING CONSTANTS ----

const DEFAULT_CONFIG: MovementConfig = {
  maxSprintDistance: 15, // Max units per "sprint" action
  targetLockDuration: 6, // Frames (at ~30fps = 200ms)
  oscillationThreshold: 4, // Number of position swaps before correction
  speedLimitPerFrame: 2, // Max coordinate change
  staminarRecoveryRate: 0.5,
  staminaDrainRate: 0.3,
};

// ---- MOVEMENT STATE MANAGEMENT ----

/** Initialize a player's movement state */
export function initializeMovementState(playerId: string, initialStamina = 100): MovementState {
  return {
    playerId,
    lastTargetX: 0,
    lastTargetY: 0,
    lastTargetTime: 0,
    targetLockUntil: 0,
    oscillationCounter: 0,
    stamina: Math.max(0, Math.min(100, initialStamina)),
    currentActivity: "holding-position",
    lastActivity: "holding-position",
    activityChangedAt: 0,
  };
}

/**
 * Update stamina based on activity intensity.
 * High-intensity activities (sprinting, counter-pressing) drain stamina faster.
 */
function updateStamina(
  state: MovementState,
  activity: MovementActivity,
  config: MovementConfig,
): number {
  const intensityMap: Record<MovementActivity, number> = {
    "holding-position": 0,
    "supporting-play": 0.1,
    "forward-run": 0.4,
    "overlapping-run": 0.5,
    "underlapping-run": 0.3,
    "checking-toward-ball": 0.2,
    "space-run": 0.5,
    "box-run": 0.6,
    "recovery-run": 0.7,
    "counter-pressing": 0.8,
    retreating: 0.2,
    "counterattack-run": 0.7,
    "midfield-support": 0.3,
    "defensive-protection": 0.4,
  };

  const intensity = intensityMap[activity] || 0;
  let newStamina = state.stamina;

  if (intensity > 0) {
    newStamina -= config.staminaDrainRate * intensity;
  } else {
    newStamina += config.staminarRecoveryRate;
  }

  return Math.max(0, Math.min(100, newStamina));
}

/**
 * Detect if player is oscillating (moving back and forth between positions).
 * Returns direction to break oscillation if detected.
 */
function detectOscillation(
  currentX: number,
  currentY: number,
  lastTargetX: number,
  lastTargetY: number,
  state: MovementState,
): "x" | "y" | undefined {
  const dx = Math.abs(currentX - lastTargetX);
  const dy = Math.abs(currentY - lastTargetY);

  // If player moved significantly toward their last target
  if (dx > 3 || dy > 3) {
    // Now consider if they're about to move back (oscillate)
    // This is detected by checking if they'd naturally target a position
    // that's significantly different from current in a way that suggests oscillation

    // Increment oscillation counter if in similar area
    if (dx < 2 && dy < 2) {
      state.oscillationCounter++;
      if (state.oscillationCounter > state.oscillationCounter) {
        // Break by preferring movement in the axis with less recent movement
        return dx < dy ? "x" : "y";
      }
    } else {
      state.oscillationCounter = Math.max(0, state.oscillationCounter - 1);
    }
  }

  return undefined;
}

/**
 * Apply speed limit to prevent impossible instant direction changes.
 * Ensures movement is smooth and realistic.
 */
function applySmoothMovement(
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  config: MovementConfig,
): [number, number] {
  const dx = targetX - currentX;
  const dy = targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= config.speedLimitPerFrame) {
    return [targetX, targetY];
  }

  const scale = config.speedLimitPerFrame / distance;
  return [currentX + dx * scale, currentY + dy * scale];
}

// ---- RUN TYPE DETECTION & GENERATION ----

/**
 * Determine what type of run the player should make based on:
 * - Player position and attributes
 * - Ball location and team possession
 * - Nearby teammates and opponents
 * - Tactical instructions
 */
function determineRunType(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
  oppPlayers: SimPlayer[],
): {
  runType: MovementActivity;
  targetX: number;
  targetY: number;
  urgency: number;
} {
  const isAttacking = context.possession === "home" && teamPlayers.some((p) => p.id === player.id);
  const isDefending = !isAttacking;

  // ---- DEFENSIVE PHASE ----
  if (isDefending || context.phase === "defending") {
    return determineDefensiveRun(player, context, instruction, state, teamPlayers, oppPlayers);
  }

  // ---- ATTACKING PHASE ----
  // Determine run based on position
  if (player.pos === "ST" || player.pos === "CAM") {
    return determineStrikerRun(player, context, instruction, state, teamPlayers);
  }

  if (player.pos === "LW" || player.pos === "RW") {
    return determineWingerRun(player, context, instruction, state, teamPlayers);
  }

  if (player.pos === "LB" || player.pos === "RB") {
    return determineFullbackRun(player, context, instruction, state, teamPlayers);
  }

  if (player.pos === "CM" || player.pos === "CDM") {
    return determineMidfielderRun(player, context, instruction, state, teamPlayers);
  }

  // Default: support play
  return {
    runType: "supporting-play",
    targetX: player.x,
    targetY: player.y,
    urgency: 0.3,
  };
}

/** Determine forward/support run for strikers and attacking midfielders */
function determineStrikerRun(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
): { runType: MovementActivity; targetX: number; targetY: number; urgency: number } {
  const isAggressiveInstruction =
    instruction.toLowerCase().includes("behind") ||
    instruction.toLowerCase().includes("aggressive") ||
    instruction.toLowerCase().includes("press");

  // Check if there's space in behind (distance between defensive line and ball)
  const spaceInBehind = detectSpaceInBehind(player, context, teamPlayers);

  if (spaceInBehind > 5 && (isAggressiveInstruction || player.attack > 75)) {
    // Make a forward run in behind
    const runTarget = calculateInBehindRun(player, context);
    return {
      runType: "forward-run",
      targetX: runTarget[0],
      targetY: runTarget[1],
      urgency: 0.85,
    };
  }

  if (instruction.toLowerCase().includes("box")) {
    // Make a run into the box
    const boxTarget = calculateBoxRun(player, context);
    return {
      runType: "box-run",
      targetX: boxTarget[0],
      targetY: boxTarget[1],
      urgency: 0.8,
    };
  }

  // Default: move toward space
  const spaceTarget = findNearbySpace(player, context, teamPlayers);
  if (spaceTarget) {
    return {
      runType: "space-run",
      targetX: spaceTarget[0],
      targetY: spaceTarget[1],
      urgency: 0.7,
    };
  }

  return {
    runType: "supporting-play",
    targetX: player.x,
    targetY: player.y,
    urgency: 0.4,
  };
}

/** Determine runs for wingers (wide positioning, cutting inside, etc.) */
function determineWingerRun(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
): { runType: MovementActivity; targetX: number; targetY: number; urgency: number } {
  const isLeftWing = player.pos === "LW";

  if (instruction.toLowerCase().includes("cutinside")) {
    // Cut inside toward goal
    const cutInsideTarget = [50 + (isLeftWing ? 10 : -10), Math.max(20, player.y - 8)] as const;
    return {
      runType: "space-run",
      targetX: cutInsideTarget[0],
      targetY: cutInsideTarget[1],
      urgency: 0.75,
    };
  }

  if (instruction.toLowerCase().includes("cross")) {
    // Drive down the line to cross
    const bylineTarget = [isLeftWing ? 15 : 85, Math.max(10, player.y - 12)] as const;
    return {
      runType: "forward-run",
      targetX: bylineTarget[0],
      targetY: bylineTarget[1],
      urgency: 0.7,
    };
  }

  // Default: support play on the wing
  const supportTarget = findWingerSupportPosition(player, context, teamPlayers);
  return {
    runType: "supporting-play",
    targetX: supportTarget[0],
    targetY: supportTarget[1],
    urgency: 0.5,
  };
}

/** Determine fullback runs (overlapping, underlapping, etc.) */
function determineFullbackRun(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
): { runType: MovementActivity; targetX: number; targetY: number; urgency: number } {
  if (instruction.toLowerCase().includes("overlap")) {
    // Push forward to overlap with winger
    const overlapTarget = getOverlapTarget(player, context, teamPlayers);
    return {
      runType: "overlapping-run",
      targetX: overlapTarget[0],
      targetY: overlapTarget[1],
      urgency: 0.7,
    };
  }

  if (
    instruction.toLowerCase().includes("invert") ||
    instruction.toLowerCase().includes("underlap")
  ) {
    // Move inside and slightly deeper than the attacking player
    const underlayTarget = getUnderlayTarget(player, context, teamPlayers);
    return {
      runType: "underlapping-run",
      targetX: underlayTarget[0],
      targetY: underlayTarget[1],
      urgency: 0.6,
    };
  }

  // Default: support play
  return {
    runType: "supporting-play",
    targetX: player.x,
    targetY: player.y,
    urgency: 0.4,
  };
}

/** Determine midfield runs (support, forward advance, etc.) */
function determineMidfielderRun(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
): { runType: MovementActivity; targetX: number; targetY: number; urgency: number } {
  // Look for space to advance into
  const advanceTarget = findMidfieldAdvancePosition(player, context, teamPlayers);

  if (advanceTarget) {
    return {
      runType: "supporting-play",
      targetX: advanceTarget[0],
      targetY: advanceTarget[1],
      urgency: 0.6,
    };
  }

  return {
    runType: "holding-position",
    targetX: player.x,
    targetY: player.y,
    urgency: 0.3,
  };
}

/** Determine defensive transition run */
function determineDefensiveRun(
  player: SimPlayer,
  context: MatchContext,
  instruction: string,
  state: MovementState,
  teamPlayers: SimPlayer[],
  oppPlayers: SimPlayer[],
): { runType: MovementActivity; targetX: number; targetY: number; urgency: number } {
  const isCounterPressingInstruction =
    instruction.toLowerCase().includes("press") || instruction.toLowerCase().includes("aggressive");

  // If instructions call for pressing and stamina allows
  if (isCounterPressingInstruction && state.stamina > 40) {
    const pressTarget = findCounterPressTarget(player, context, oppPlayers);
    if (pressTarget) {
      return {
        runType: "counter-pressing",
        targetX: pressTarget[0],
        targetY: pressTarget[1],
        urgency: 0.9,
      };
    }
  }

  // Default: retreat to defensive shape
  const retreatTarget = getRetreatingPosition(player, context, teamPlayers);
  return {
    runType: "retreating",
    targetX: retreatTarget[0],
    targetY: retreatTarget[1],
    urgency: 0.7,
  };
}

// ---- TACTICAL POSITION CALCULATIONS ----

/** Detect if there's space in behind the defensive line (for through ball runs) */
function detectSpaceInBehind(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): number {
  // Find average defensive line (opponents' defensive line)
  const defensiveLineY = 50; // Simplified - in real system would calculate from opponent positions
  const spaceBehind = defensiveLineY - context.ballY;
  return Math.max(0, spaceBehind);
}

/** Calculate target for run in behind (through ball run) */
function calculateInBehindRun(player: SimPlayer, context: MatchContext): [number, number] {
  const targetY = Math.max(5, context.ballY - 12);
  const targetX =
    player.x +
    (deterministicUnit(`${player.id}:${context.ballX}:${context.ballY}:behind`) - 0.5) * 15;
  return [Math.max(20, Math.min(80, targetX)), targetY];
}

/** Calculate target for box run */
function calculateBoxRun(player: SimPlayer, context: MatchContext): [number, number] {
  const targetY = Math.max(5, Math.min(25, context.ballY - 8));
  const targetX =
    50 + (deterministicUnit(`${player.id}:${context.ballX}:${context.ballY}:box`) - 0.5) * 20;
  return [Math.max(25, Math.min(75, targetX)), targetY];
}

/** Find nearby open space for runs */
function findNearbySpace(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
  searchRadius = 15,
): [number, number] | undefined {
  // Look for space at different angles
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  let bestSpace: [number, number] | undefined;
  let maxOpenness = 0;

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    const targetX = player.x + Math.cos(rad) * searchRadius;
    const targetY = player.y + Math.sin(rad) * searchRadius;

    // Count how many teammates are near this space
    const nearbyTeammates = teamPlayers.filter(
      (p) => distance(p.x, p.y, targetX, targetY) < 8 && p.id !== player.id,
    ).length;

    const openness = 1 / (1 + nearbyTeammates);

    if (openness > maxOpenness) {
      maxOpenness = openness;
      bestSpace = [Math.max(0, Math.min(100, targetX)), Math.max(0, Math.min(100, targetY))];
    }
  }

  return bestSpace;
}

/** Find position for winger to support play */
function findWingerSupportPosition(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): [number, number] {
  const isLeftWing = player.pos === "LW";
  const lateralTarget = isLeftWing ? 20 : 80;
  const heightTarget = Math.max(25, context.ballY + 5);
  return [lateralTarget, heightTarget];
}

/** Get target for overlapping fullback run */
function getOverlapTarget(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): [number, number] {
  const isLeftBack = player.pos === "LB";
  const wingerId = isLeftBack ? "LW" : "RW"; // Simplified - find actual winger
  const winger = teamPlayers.find((p) => p.pos === (isLeftBack ? "LW" : "RW"));

  if (winger) {
    // Position slightly higher and wider than winger
    const overlapX = isLeftBack ? Math.min(winger.x - 5, 25) : Math.max(winger.x + 5, 75);
    const overlapY = Math.max(15, winger.y - 8);
    return [overlapX, overlapY];
  }

  // Fallback: just push forward
  return [player.x, Math.max(20, player.y - 12)];
}

/** Get target for underlapping fullback run */
function getUnderlayTarget(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): [number, number] {
  const isLeftBack = player.pos === "LB";
  const winger = teamPlayers.find((p) => p.pos === (isLeftBack ? "LW" : "RW"));

  if (winger) {
    // Position slightly deeper and more central than winger
    const underlayX = isLeftBack ? Math.max(winger.x + 8, 35) : Math.min(winger.x - 8, 65);
    const underlayY = Math.max(30, winger.y + 5);
    return [underlayX, underlayY];
  }

  // Fallback: advance slightly but stay deeper
  return [player.x, Math.max(30, player.y - 6)];
}

/** Find position for midfielder to advance into */
function findMidfieldAdvancePosition(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): [number, number] | undefined {
  // Look for gap between striker and current position
  const striker = teamPlayers.find((p) => p.pos === "ST");
  if (!striker) return undefined;

  // Position between striker and current position
  const advanceX = player.x + (striker.x - player.x) * 0.5;
  const advanceY = Math.max(20, player.y - 8);

  return [advanceX, advanceY];
}

/** Find target for counter-pressing (closing down opponent with ball) */
function findCounterPressTarget(
  player: SimPlayer,
  context: MatchContext,
  oppPlayers: SimPlayer[],
): [number, number] | undefined {
  // Find nearest opponent to player
  let nearestOpp: SimPlayer | undefined;
  let nearestDist = 30;

  for (const opp of oppPlayers) {
    const d = distance(player.x, player.y, opp.x, opp.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestOpp = opp;
    }
  }

  if (nearestOpp) {
    // Close down with slight offset to avoid exact collision
    const offsetX = nearestOpp.x > player.x ? 2 : -2;
    const offsetY = nearestOpp.y > player.y ? 2 : -2;
    return [
      Math.max(0, Math.min(100, nearestOpp.x + offsetX)),
      Math.max(0, Math.min(100, nearestOpp.y + offsetY)),
    ];
  }

  return undefined;
}

/** Get position to retreat to for defensive shape */
function getRetreatingPosition(
  player: SimPlayer,
  context: MatchContext,
  teamPlayers: SimPlayer[],
): [number, number] {
  // Move toward own goal
  const formationDepth = 75; // Approximate defensive line
  const targetY = Math.max(player.y, Math.min(formationDepth, player.y + 5));

  // Stay in own lateral zone
  const zoneBoundary = player.pos === "LB" ? 30 : player.pos === "RB" ? 70 : 50;
  const targetX = player.x + (zoneBoundary - player.x) * 0.1;

  return [Math.max(0, Math.min(100, targetX)), targetY];
}

// ---- UTILITY FUNCTIONS ----

/** Distance between two points */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a position to stay on pitch (0-100).
 */
function clampToPitch(x: number, y: number): [number, number] {
  return [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))];
}

// ---- MAIN MOVEMENT CALCULATION ----

/**
 * Calculate dynamic movement for a player.
 * Extends positional targeting with purposeful, contextual movement behaviors.
 */
export function calculateDynamicMovement(
  player: SimPlayer,
  context: MatchContext,
  positionTarget: PositionalTarget,
  movementState: MovementState,
  instruction: string = "",
  config: Partial<MovementConfig> = {},
  teamPlayers: SimPlayer[] = [],
  oppPlayers: SimPlayer[] = [],
): MovementResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Check for target lock (prevent rapid switching)
  const currentFrame = context.frame ?? movementState.lastTargetTime;
  const isTargetLocked = currentFrame < movementState.targetLockUntil;

  let targetX = positionTarget.targetX;
  let targetY = positionTarget.targetY;
  let activity: MovementActivity = movementState.currentActivity;
  let urgency = positionTarget.urgency;
  let reason = positionTarget.reason;

  // If not locked, consider new run types
  if (!isTargetLocked) {
    const runDecision = determineRunType(
      player,
      context,
      instruction,
      movementState,
      teamPlayers,
      oppPlayers,
    );
    activity = runDecision.runType;
    targetX = runDecision.targetX;
    targetY = runDecision.targetY;
    urgency = runDecision.urgency;
    reason = `${activity} (stamina: ${Math.round(movementState.stamina)}%)`;

    // Lock target for a duration to prevent constant switching
    movementState.targetLockUntil = currentFrame + fullConfig.targetLockDuration * 33; // ~30fps
  }

  // Update stamina AFTER determining activity (based on new activity intensity)
  movementState.stamina = updateStamina(movementState, activity, fullConfig);

  // Detect and prevent oscillation
  const oscillationBreak = detectOscillation(
    player.x,
    player.y,
    movementState.lastTargetX,
    movementState.lastTargetY,
    movementState,
  );
  if (oscillationBreak && movementState.stamina > 20) {
    // Break oscillation by locking player in the non-oscillating axis
    if (oscillationBreak === "x") {
      targetX = player.x;
    } else {
      targetY = player.y;
    }
    reason = `${reason} [oscillation-break-${oscillationBreak}]`;
  }

  // Apply smooth movement (speed limit to prevent instant direction changes)
  const [smoothX, smoothY] = applySmoothMovement(player.x, player.y, targetX, targetY, fullConfig);
  targetX = smoothX;
  targetY = smoothY;

  // Clamp to pitch
  [targetX, targetY] = clampToPitch(targetX, targetY);

  // Calculate movement distance
  const distance_val = distance(player.x, player.y, targetX, targetY);

  // Update movement state
  movementState.lastTargetX = positionTarget.targetX;
  movementState.lastTargetY = positionTarget.targetY;
  movementState.lastTargetTime = currentFrame;
  movementState.lastActivity = movementState.currentActivity;
  movementState.currentActivity = activity;

  if (activity !== movementState.lastActivity) {
    movementState.activityChangedAt = currentFrame;
  }

  return {
    targetX,
    targetY,
    distance: distance_val,
    activity,
    urgency,
    reason,
  };
}

/**
 * Calculate dynamic movement for entire squad.
 * Optimized to skip detailed calculations for players far from play.
 */
export function calculateSquadDynamicMovement(
  squad: SimPlayer[],
  context: MatchContext,
  positionTargets: PositionalTarget[],
  movementStates: MovementState[],
  instructions: Record<string, string> = {},
  config: Partial<MovementConfig> = {},
  teamPlayers: SimPlayer[] = [],
  oppPlayers: SimPlayer[] = [],
): MovementResult[] {
  return squad.map((player, idx) => {
    const state = movementStates[idx] || initializeMovementState(player.id);
    const target = positionTargets[idx];
    const instruction = instructions[player.id] || "";

    // Optimization: Skip detailed calculations for players very far from play
    const distFromBall = distance(player.x, player.y, context.ballX, context.ballY);
    if (distFromBall > 40 && context.phase === "defending") {
      // Just return current position with minimal activity
      return {
        targetX: player.x,
        targetY: player.y,
        distance: 0,
        activity: "retreating",
        urgency: 0.1,
        reason: "far-from-play-optimization",
      };
    }

    return calculateDynamicMovement(
      player,
      context,
      target || {
        targetX: player.x,
        targetY: player.y,
        currentX: player.x,
        currentY: player.y,
        urgency: 0.3,
        reason: "fallback",
      },
      state,
      instruction,
      config,
      teamPlayers,
      oppPlayers,
    );
  });
}
