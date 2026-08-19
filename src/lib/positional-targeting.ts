/**
 * Player Positional Target System
 * ===============================
 *
 * Generates contextual positional targets for players based on:
 * - Ball location and possession state
 * - Team shape and formation
 * - Tactical role and individual instructions
 * - Nearby teammates and opponents
 * - Match phase (attacking/defending)
 *
 * Does NOT modify player coordinates directly. Instead, provides a target
 * position that can be used by the rendering/animation layer or future
 * position-update logic.
 *
 * Safeguards prevent:
 * - All players rushing toward the ball
 * - Excessive clustering
 * - Leaving tactical zones
 * - Leaving the pitch
 * - Rapid target switching
 */

import type { SimPlayer } from "./match-engine";
import type { Pos } from "@/data/squad";

/**
 * A positional target for a player at a specific moment.
 * Can be used by rendering or future position-update systems.
 */
export interface PositionalTarget {
  /** Target x position (0-100) */
  targetX: number;
  /** Target y position (0-100) */
  targetY: number;
  /** Current x position (0-100) */
  currentX: number;
  /** Current y position (0-100) */
  currentY: number;
  /** How urgently player should move to target (0-1, 1 = high priority) */
  urgency: number;
  /** Reason for this target (for debugging/UI) */
  reason: string;
}

/**
 * Match context passed to positional targeting functions.
 */
export interface MatchContext {
  /** Deterministic simulation frame when movement is evaluated in a match loop. */
  frame?: number;
  /** Ball position (0-100) */
  ballX: number;
  ballY: number;
  /** Which side has possession (home/away) */
  possession: "home" | "away";
  /** Current match phase */
  phase: "attacking" | "defending";
  /** Formation shape (e.g., "4-3-3") */
  formation: string;
  /** Squad data for the player's side */
  sidePlayers: SimPlayer[];
  /** Squad data for the opponent side */
  opponentPlayers: SimPlayer[];
}

// ---- FORMATION TEMPLATES & TACTICAL ZONES -------

/**
 * Nominal positions for each formation, as percentages of the pitch.
 * Base formation template that tactical instructions and match state modify.
 */
const FORMATION_BASE_POSITIONS: Record<string, Record<Pos, [number, number]>> = {
  "4-4-2": {
    GK: [50, 85],
    RB: [75, 65],
    CB: [60, 72],
    LB: [25, 65],
    RW: [80, 45],
    CM: [55, 40],
    LW: [20, 45],
    CDM: [50, 50],
    CAM: [50, 35],
    ST: [50, 15],
  },
  "4-3-3": {
    GK: [50, 85],
    RB: [75, 68],
    CB: [60, 75],
    LB: [25, 68],
    CDM: [50, 55],
    CM: [65, 45],
    CAM: [35, 45],
    RW: [80, 30],
    LW: [20, 30],
    ST: [50, 15],
  },
  "4-2-3-1": {
    GK: [50, 85],
    RB: [75, 70],
    CB: [60, 75],
    LB: [25, 70],
    CDM: [50, 60],
    CM: [50, 45],
    CAM: [50, 30],
    RW: [75, 25],
    LW: [25, 25],
    ST: [50, 12],
  },
  "3-5-2": {
    GK: [50, 85],
    CB: [50, 75],
    RB: [75, 70],
    LB: [25, 70],
    RW: [80, 45],
    CDM: [50, 50],
    CM: [50, 40],
    LW: [20, 45],
    CAM: [50, 30],
    ST: [60, 15],
  },
  "5-3-2": {
    GK: [50, 85],
    CB: [50, 75],
    RB: [80, 65],
    LB: [20, 65],
    CDM: [50, 55],
    CM: [50, 45],
    CAM: [50, 35],
    ST: [60, 15],
    RW: [70, 40],
    LW: [30, 40],
  },
  "3-4-3": {
    GK: [50, 85],
    CB: [50, 75],
    RB: [75, 70],
    LB: [25, 70],
    CM: [65, 50],
    CDM: [35, 50],
    RW: [80, 25],
    LW: [20, 25],
    ST: [50, 12],
    CAM: [50, 35],
  },
};

/**
 * Get the nominal formation position for a player.
 * Returns default if formation not found.
 */
function getNominalPosition(pos: Pos, formation: string): [number, number] {
  const template = FORMATION_BASE_POSITIONS[formation] ?? FORMATION_BASE_POSITIONS["4-3-3"];
  if (!template) return [50, 50]; // fallback to center
  return template[pos] || [50, 50];
}

/**
 * Defines the "tactical zone" for each position.
 * Players should generally stay within their zone (with exceptions).
 */
const POSITION_ZONES: Record<Pos, { minX: number; maxX: number; minY: number; maxY: number }> = {
  GK: { minX: 30, maxX: 70, minY: 75, maxY: 100 },
  CB: { minX: 20, maxX: 80, minY: 55, maxY: 85 },
  LB: { minX: 5, maxX: 40, minY: 45, maxY: 80 },
  RB: { minX: 60, maxX: 95, minY: 45, maxY: 80 },
  CDM: { minX: 30, maxX: 70, minY: 40, maxY: 65 },
  CM: { minX: 20, maxX: 80, minY: 30, maxY: 65 },
  CAM: { minX: 20, maxX: 80, minY: 20, maxY: 55 },
  LW: { minX: 0, maxX: 35, minY: 15, maxY: 50 },
  RW: { minX: 65, maxX: 100, minY: 15, maxY: 50 },
  ST: { minX: 25, maxX: 75, minY: 5, maxY: 35 },
};

/**
 * Get the tactical zone for a position.
 */
function getTacticalZone(pos: Pos): (typeof POSITION_ZONES)[Pos] {
  return POSITION_ZONES[pos];
}

/**
 * Clamp a position to stay within the tactical zone.
 */
function clampToZone(x: number, y: number, pos: Pos): [number, number] {
  const zone = getTacticalZone(pos);
  const clampedX = Math.max(zone.minX, Math.min(zone.maxX, x));
  const clampedY = Math.max(zone.minY, Math.min(zone.maxY, y));
  return [clampedX, clampedY];
}

// ---- BEHAVIOR MODIFIERS -------

/**
 * How a position responds to out-of-possession scenarios.
 * Defensive shape emphasis varies by role.
 */
function getDefensiveShapeAdjustment(
  pos: Pos,
  ballX: number,
  ballY: number,
  nominal: [number, number],
): { x: number; y: number } {
  // Defenders should tighten shape toward ball, especially in their zones
  if (pos === "CB" || pos === "CDM") {
    // Pull in slightly when ball is central to maintain compactness
    if (ballX > 40 && ballX < 60) {
      return { x: nominal[0] * 0.98, y: nominal[1] + 3 };
    }
  }

  // Fullbacks follow ball horizontally to provide cover
  if (pos === "LB" || pos === "RB") {
    const targetX =
      pos === "LB" ? Math.min(nominal[0], ballX + 5) : Math.max(nominal[0], ballX - 5);
    return { x: targetX, y: nominal[1] };
  }

  return { x: nominal[0], y: nominal[1] };
}

/**
 * How a position responds to in-possession scenarios.
 * Attacking shapes spread and look to create space.
 */
function getAttackingShapeAdjustment(
  pos: Pos,
  ballX: number,
  ballY: number,
  nominal: [number, number],
  instruction: string = "",
): { x: number; y: number } {
  // Forwards push higher up
  if (pos === "ST" || pos === "CAM") {
    // Get in behind if instruction present
    if (
      instruction.toLowerCase().includes("behind") ||
      instruction.toLowerCase().includes("aggressive")
    ) {
      return { x: nominal[0], y: Math.max(5, nominal[1] - 8) };
    }
    // Else stay central but higher
    return { x: nominal[0], y: Math.max(10, nominal[1] - 3) };
  }

  // Wingers widen out
  if (pos === "LW" || pos === "RW") {
    if (instruction.toLowerCase().includes("cut") && instruction.toLowerCase().includes("inside")) {
      // Cut inside = move more central (toward center of pitch)
      return {
        x: pos === "LW" ? Math.min(nominal[0] + 12, 50) : Math.max(nominal[0] - 12, 50),
        y: nominal[1],
      };
    }
    // Stay wide (default)
    return {
      x: pos === "LW" ? nominal[0] - 5 : nominal[0] + 5,
      y: nominal[1],
    };
  }

  // Fullbacks can push forward
  if (pos === "LB" || pos === "RB") {
    if (instruction.toLowerCase().includes("overlap")) {
      return { x: nominal[0], y: Math.max(20, nominal[1] - 15) };
    }
    if (instruction.toLowerCase().includes("invert")) {
      // Move inside and up
      return {
        x: pos === "LB" ? nominal[0] + 10 : nominal[0] - 10,
        y: Math.max(35, nominal[1] - 10),
      };
    }
    // Balanced - advance slightly
    return { x: nominal[0], y: Math.max(25, nominal[1] - 8) };
  }

  // Midfielders get more advanced
  if (pos === "CM" || pos === "CDM") {
    if (pos === "CDM") {
      // Stay deeper but advance slightly
      return { x: nominal[0], y: Math.max(40, nominal[1] - 3) };
    }
    // CM gets more advanced
    return { x: nominal[0], y: Math.max(30, nominal[1] - 5) };
  }

  return { x: nominal[0], y: nominal[1] };
}

// ---- DISTANCE CALCULATIONS -------

/**
 * Calculate distance between two points.
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the nearest teammate to a player.
 */
function findNearestTeammate(
  player: SimPlayer,
  teammates: SimPlayer[],
  maxDistance: number = 20,
): SimPlayer | undefined {
  let nearest: SimPlayer | undefined;
  let nearestDistance = maxDistance;

  for (const teammate of teammates) {
    if (teammate.id === player.id) continue;
    const dist = distance(player.x, player.y, teammate.x, teammate.y);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearest = teammate;
    }
  }

  return nearest;
}

/**
 * Find the nearest opponent to a player.
 */
function findNearestOpponent(
  player: SimPlayer,
  opponents: SimPlayer[],
  maxDistance: number = 25,
): SimPlayer | undefined {
  let nearest: SimPlayer | undefined;
  let nearestDistance = maxDistance;

  for (const opponent of opponents) {
    const dist = distance(player.x, player.y, opponent.x, opponent.y);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearest = opponent;
    }
  }

  return nearest;
}

/**
 * Check if a region is too crowded (too many players nearby).
 * Used to prevent clustering.
 */
function isRegionCrowded(
  x: number,
  y: number,
  players: SimPlayer[],
  radius: number = 10,
  maxCount: number = 3,
): boolean {
  let count = 0;
  for (const player of players) {
    if (distance(player.x, player.y, x, y) <= radius) {
      count++;
    }
  }
  return count > maxCount;
}

// ---- MAIN POSITIONAL TARGET CALCULATION -------

/**
 * Generate a positional target for a player based on match context.
 *
 * The target balances:
 * 1. Maintaining formation shape (nominal position)
 * 2. Responding to ball position
 * 3. Following tactical instructions
 * 4. Supporting teammates / marking opponents
 * 5. Staying within tactical zone
 */
export function calculatePositionalTarget(
  player: SimPlayer,
  context: MatchContext,
  instruction: string = "",
): PositionalTarget {
  const isTeamAttacking = context.possession === "home" ? true : false;
  const isPlayerOnAttacking =
    (context.possession === "home" && context.sidePlayers.some((p) => p.id === player.id)) ||
    (context.possession === "away" && context.opponentPlayers.some((p) => p.id === player.id));

  const nominalPos = getNominalPosition(player.pos, context.formation);
  let targetX = nominalPos[0];
  let targetY = nominalPos[1];
  let reason = "formation-base";
  let urgency = 0.3; // Default low urgency

  // ---- GOALKEEPER: SPECIAL CASE ----
  if (player.isGK) {
    // GK mostly stays in goal, but may come out slightly if team is attacking
    if (isPlayerOnAttacking && context.phase === "attacking") {
      targetY = Math.min(nominalPos[1], 80);
      reason = "gk-distribution";
      urgency = 0.2;
    } else {
      reason = "gk-default";
      urgency = 0.1;
    }
    return {
      targetX,
      targetY,
      currentX: player.x,
      currentY: player.y,
      urgency,
      reason,
    };
  }

  // ---- DEFENDERS: MAINTAIN SHAPE / FOLLOW BALL ----
  if (player.pos === "CB" || player.pos === "CDM" || player.pos === "LB" || player.pos === "RB") {
    if (!isPlayerOnAttacking || context.phase === "defending") {
      // Out of possession: maintain defensive shape
      const def = getDefensiveShapeAdjustment(player.pos, context.ballX, context.ballY, nominalPos);
      targetX = def.x;
      targetY = def.y;
      reason = "defensive-shape";
      urgency = 0.5;
    } else {
      // In possession: advance and create width
      const att = getAttackingShapeAdjustment(
        player.pos,
        context.ballX,
        context.ballY,
        nominalPos,
        instruction,
      );
      targetX = att.x;
      targetY = att.y;
      reason = "defensive-push-forward";
      urgency = 0.4;
    }
  }

  // ---- MIDFIELDERS: LINK PLAY / COVER SPACE ----
  else if (player.pos === "CM" || player.pos === "CAM") {
    if (isPlayerOnAttacking && context.phase === "attacking") {
      // In possession: advance and create passing options
      const att = getAttackingShapeAdjustment(
        player.pos,
        context.ballX,
        context.ballY,
        nominalPos,
        instruction,
      );
      targetX = att.x;
      targetY = att.y;
      reason = "midfield-advance";
      urgency = 0.6;
    } else {
      // Out of possession: cover space, maintain shape
      targetX = nominalPos[0];
      targetY = nominalPos[1];
      reason = "midfield-defensive-shape";
      urgency = 0.5;
    }
  }

  // ---- WINGERS: CREATE WIDTH / CUT INSIDE ----
  else if (player.pos === "LW" || player.pos === "RW") {
    const att = getAttackingShapeAdjustment(
      player.pos,
      context.ballX,
      context.ballY,
      nominalPos,
      instruction,
    );
    targetX = att.x;
    targetY = att.y;
    reason = isPlayerOnAttacking ? "winger-attacking" : "winger-defensive";
    urgency = isPlayerOnAttacking ? 0.7 : 0.4;
  }

  // ---- STRIKERS: GET FORWARD / PRESS ----
  else if (player.pos === "ST") {
    if (isPlayerOnAttacking && context.phase === "attacking") {
      // In possession: make runs in behind
      const att = getAttackingShapeAdjustment(
        player.pos,
        context.ballX,
        context.ballY,
        nominalPos,
        instruction,
      );
      targetX = att.x;
      targetY = att.y;
      reason = "striker-attacking";
      urgency = 0.8;
    } else {
      // Out of possession: press defenders or hold position
      if (instruction.toLowerCase().includes("press")) {
        // Move toward nearest defender to press them
        const nearestDefender = findNearestOpponent(player, context.opponentPlayers, 30);
        if (nearestDefender) {
          // Move closer but not exactly on them
          const offsetX = nearestDefender.x > player.x ? 5 : -5;
          const offsetY = nearestDefender.y > player.y ? 5 : -5;
          targetX = Math.max(0, Math.min(100, nearestDefender.x + offsetX));
          targetY = Math.max(0, Math.min(100, nearestDefender.y + offsetY));
          reason = "striker-press-defender";
          urgency = 0.7;
        } else {
          // No defender to press, hold position
          targetX = nominalPos[0];
          targetY = nominalPos[1];
          reason = "striker-press-hold";
          urgency = 0.5;
        }
      } else {
        // Default defensive position
        targetY = nominalPos[1] + 5; // Slightly deeper
        targetX = nominalPos[0];
        reason = "striker-defensive";
        urgency = 0.4;
      }
    }
  }

  // ---- SAFEGUARD: AVOID CLUSTERING ----
  const allPlayers = [...context.sidePlayers, ...context.opponentPlayers];
  if (isRegionCrowded(targetX, targetY, allPlayers, 12, 2)) {
    // Move away from crowded region
    // Calculate vector away from nearby players
    let awayX = 0;
    let awayY = 0;
    let playerCount = 0;

    for (const other of allPlayers) {
      if (distance(other.x, other.y, targetX, targetY) <= 15) {
        // Vector away from this player
        const dx = targetX - other.x;
        const dy = targetY - other.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        awayX += dx / len;
        awayY += dy / len;
        playerCount++;
      }
    }

    if (playerCount > 0) {
      targetX += (awayX / playerCount) * 4;
      targetY += (awayY / playerCount) * 4;
      reason = `${reason} [spread-avoid-crowd]`;
      urgency = Math.max(urgency, 0.6);
    }
  }

  // ---- SAFEGUARD: STAY WITHIN TACTICAL ZONE ----
  [targetX, targetY] = clampToZone(targetX, targetY, player.pos);

  // ---- SAFEGUARD: STAY ON PITCH ----
  targetX = Math.max(0, Math.min(100, targetX));
  targetY = Math.max(0, Math.min(100, targetY));

  return {
    targetX,
    targetY,
    currentX: player.x,
    currentY: player.y,
    urgency,
    reason,
  };
}

/**
 * Calculate positional targets for an entire squad.
 */
export function calculateSquadPositionalTargets(
  squad: SimPlayer[],
  context: MatchContext,
  instructions: Record<string, string> = {},
): PositionalTarget[] {
  return squad.map((player) => {
    const instruction = instructions[player.id] || "";
    return calculatePositionalTarget(player, context, instruction);
  });
}

/**
 * Get the distance a player needs to move to reach their target.
 */
export function getMovementDistance(target: PositionalTarget): number {
  return distance(target.currentX, target.currentY, target.targetX, target.targetY);
}

/**
 * Check if a target position is "too different" from current position
 * (safeguard against rapid position switching).
 */
export function isTargetStable(
  target: PositionalTarget,
  previousTarget: PositionalTarget | undefined,
  maxDelta: number = 8,
): boolean {
  if (!previousTarget) return true;
  // Check if the change between previous target and current target is small
  const delta = distance(
    previousTarget.targetX,
    previousTarget.targetY,
    target.targetX,
    target.targetY,
  );
  return delta <= maxDelta;
}
