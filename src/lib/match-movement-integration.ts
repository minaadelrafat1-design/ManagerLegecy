/**
 * Match Movement Integration
 * ==========================
 *
 * Integrates the dynamic movement and positional targeting systems
 * directly into match simulation. This module handles:
 *
 * - Updating player positions based on calculated movement targets
 * - Managing movement state across match frames
 * - Applying tactical instructions to movement decisions
 * - Handling performance optimization for live simulation
 *
 * This is the bridge between the movement systems and the actual match engine.
 */

import type { SimPlayer, TeamTactics } from "./match-engine";
import { seededUnit } from "@/state/utils";
import type { MatchContext } from "./positional-targeting";
import { calculatePositionalTarget, calculateSquadPositionalTargets } from "./positional-targeting";
import {
  calculateDynamicMovement,
  calculateSquadDynamicMovement,
  initializeMovementState,
  type MovementState,
  type MovementResult,
  type MovementConfig,
} from "./dynamic-movement";

/** Per-player movement tracking throughout a match */
export interface MatchMovementState {
  playerId: string;
  name: string;
  position: { x: number; y: number };
  movement: MovementState;
  lastMovementResult: MovementResult | null;
  activityHistory: Array<{ activity: string; timestamp: number; duration: number }>;
}

/** Squad-wide movement state for a team */
export interface SquadMovementState {
  teamName: string;
  players: MatchMovementState[];
  lastUpdatedFrame: number;
  averageStamina: number;
}

/**
 * Initialize movement state for an entire squad at start of match.
 */
export function initializeSquadMovementState(
  squad: SimPlayer[],
  teamName: string,
): SquadMovementState {
  return {
    teamName,
    players: squad.map((player) => ({
      playerId: player.id,
      name: player.shortName,
      position: { x: player.x, y: player.y },
      movement: initializeMovementState(player.id, player.baseFitness),
      lastMovementResult: null,
      activityHistory: [],
    })),
    lastUpdatedFrame: 0,
    averageStamina: squad.reduce((sum, p) => sum + p.baseFitness, 0) / squad.length,
  };
}

/**
 * Update squad positions based on movement calculations.
 * This is called each frame/tick of the match to move players toward their targets.
 */
export function updateSquadPositions(
  squad: SimPlayer[],
  squadState: SquadMovementState,
  context: MatchContext,
  tactics: TeamTactics,
  instructions: Record<string, string> = {},
  config: Partial<MovementConfig> = {},
  frame: number = 0,
): { updatedSquad: SimPlayer[]; newSquadState: SquadMovementState } {
  // Get positional targets for the squad
  const posTargets = calculateSquadPositionalTargets(squad, context, instructions);

  // Get movement states
  const movementStates = squadState.players.map((p) => p.movement);

  // Calculate dynamic movement for all players
  const movementResults = calculateSquadDynamicMovement(
    squad,
    context,
    posTargets,
    movementStates,
    instructions,
    config,
    context.sidePlayers,
    context.opponentPlayers,
  );

  // Apply movement results to player positions
  const updatedSquad = squad.map((player, idx) => {
    const result = movementResults[idx];
    if (!result) return player;

    // Gradually move toward target (don't teleport instantly)
    const moveSpeed = 0.3; // Adjust for desired smoothness
    const newX = player.x + (result.targetX - player.x) * moveSpeed;
    const newY = player.y + (result.targetY - player.y) * moveSpeed;

    return {
      ...player,
      x: newX,
      y: newY,
    };
  });

  // Update squad state
  const updatedSquadState: SquadMovementState = {
    ...squadState,
    lastUpdatedFrame: frame,
    players: squadState.players.map((playerState, idx) => {
      const result = movementResults[idx] ?? null;
      const updatedPlayer = updatedSquad[idx];
      const movement = movementStates[idx] ?? initializeMovementState(playerState.playerId);

      // Track activity history
      let activityHistory = playerState.activityHistory;
      const lastActivity = playerState.activityHistory[playerState.activityHistory.length - 1];

      if (result && (!lastActivity || lastActivity.activity !== result.activity)) {
        // New activity started
        activityHistory = [
          ...playerState.activityHistory.slice(-9), // Keep last 10 activities
          {
            activity: result.activity,
            timestamp: frame,
            duration: 0,
          },
        ];
      } else {
        // Update duration of current activity
        activityHistory = activityHistory.map((act, i) =>
          i === activityHistory.length - 1 && lastActivity
            ? { ...act, duration: frame - act.timestamp }
            : act,
        );
      }

      return {
        playerId: playerState.playerId,
        name: playerState.name,
        position: { x: updatedPlayer?.x ?? 0, y: updatedPlayer?.y ?? 0 },
        movement,
        lastMovementResult: result,
        activityHistory,
      };
    }),
    averageStamina: movementStates.reduce((sum, m) => sum + m.stamina, 0) / squad.length,
  };

  return {
    updatedSquad,
    newSquadState: updatedSquadState,
  };
}

/**
 * Get a summary of current movement activities across the squad.
 * Useful for understanding tactical patterns during a match.
 */
export function getSquadMovementSummary(squadState: SquadMovementState): {
  activitiesByType: Record<string, number>;
  averageStamina: number;
  highActivityPlayers: string[];
  fatigueRisk: string[];
} {
  const activitiesByType: Record<string, number> = {};
  const playerStamina: Array<{ playerId: string; stamina: number }> = [];

  for (const player of squadState.players) {
    if (player.lastMovementResult) {
      const activity = player.lastMovementResult.activity;
      activitiesByType[activity] = (activitiesByType[activity] || 0) + 1;
    }
    playerStamina.push({ playerId: player.playerId, stamina: player.movement.stamina });
  }

  const highActivityPlayers = squadState.players
    .filter((p) => p.lastMovementResult && p.lastMovementResult.urgency > 0.7)
    .map((p) => p.playerId);

  const fatigueRisk = playerStamina.filter((p) => p.stamina < 30).map((p) => p.playerId);

  return {
    activitiesByType,
    averageStamina: squadState.averageStamina,
    highActivityPlayers,
    fatigueRisk,
  };
}

/**
 * Apply fatigue effects to player stats based on stamina depletion.
 * Lower stamina reduces effectiveness in key attributes.
 */
export function applyFatigueToPlayer(
  player: SimPlayer,
  staminaPercent: number, // 0-100
): SimPlayer {
  // Stamina below 50% reduces attribute effectiveness
  if (staminaPercent >= 50) {
    return player; // No fatigue effect
  }

  const fatigueMultiplier = 0.5 + (staminaPercent / 100) * 0.5; // 0.5 to 1.0

  return {
    ...player,
    attack: Math.round(player.attack * fatigueMultiplier),
    defend: Math.round(player.defend * fatigueMultiplier),
    playmaking: Math.round(player.playmaking * fatigueMultiplier),
  };
}

/**
 * Check if a player needs to be substituted due to fatigue.
 */
export function shouldSubstitutePlayer(
  playerState: MatchMovementState,
  minStamina: number = 20, // Substitute if below 20%
): boolean {
  return playerState.movement.stamina < minStamina;
}

/**
 * Simulate a full match with detailed movement tracking.
 * Used for stress testing and match replay/analysis.
 */
export function simulateMatchMovement(
  homeSquad: SimPlayer[],
  awaySquad: SimPlayer[],
  homeTactics: TeamTactics,
  awayTactics: TeamTactics,
  matchDurationFrames: number = 2700, // ~90 minutes at 30fps
  config: Partial<MovementConfig> = {},
): {
  homeMovementHistory: SquadMovementState[];
  awayMovementHistory: SquadMovementState[];
  totalFrames: number;
  averageFrameTime: number;
} {
  const homeMovement = initializeSquadMovementState(homeSquad, "Home");
  const awayMovement = initializeSquadMovementState(awaySquad, "Away");
  const homeHistory: SquadMovementState[] = [];
  const awayHistory: SquadMovementState[] = [];

  let currentHome = homeSquad;
  let currentAway = awaySquad;
  let totalTime = 0;

  for (let frame = 0; frame < matchDurationFrames; frame++) {
    const frameStartTime = performance.now();

    // Create match context (simplified)
    const contextSeed = `${homeSquad.map((player) => player.id).join(",")}:${awaySquad.map((player) => player.id).join(",")}:${frame}`;
    const ballX = 50 + (seededUnit(`${contextSeed}:ball-x`) - 0.5) * 20;
    const ballY = 40 + (seededUnit(`${contextSeed}:ball-y`) - 0.5) * 30;
    const possession = seededUnit(`${contextSeed}:possession`) > 0.5 ? "home" : "away";

    const context: MatchContext = {
      ballX,
      ballY,
      possession,
      phase: seededUnit(`${contextSeed}:phase`) > 0.3 ? "attacking" : "defending",
      frame,
      formation: "4-3-3",
      sidePlayers: possession === "home" ? currentHome : currentAway,
      opponentPlayers: possession === "home" ? currentAway : currentHome,
    };

    // Update home team
    const { updatedSquad: updatedHome, newSquadState: newHomeState } = updateSquadPositions(
      currentHome,
      homeMovement,
      context,
      homeTactics,
      {},
      config,
      frame,
    );
    currentHome = updatedHome;
    Object.assign(homeMovement, newHomeState);

    // Update away team
    const { updatedSquad: updatedAway, newSquadState: newAwayState } = updateSquadPositions(
      currentAway,
      awayMovement,
      { ...context, possession: possession === "home" ? "away" : "home" },
      awayTactics,
      {},
      config,
      frame,
    );
    currentAway = updatedAway;
    Object.assign(awayMovement, newAwayState);

    // Record every 30 frames (1 second at 30fps)
    if (frame % 30 === 0) {
      homeHistory.push(JSON.parse(JSON.stringify(homeMovement)));
      awayHistory.push(JSON.parse(JSON.stringify(awayMovement)));
    }

    const frameEndTime = performance.now();
    totalTime += frameEndTime - frameStartTime;
  }

  return {
    homeMovementHistory: homeHistory,
    awayMovementHistory: awayHistory,
    totalFrames: matchDurationFrames,
    averageFrameTime: totalTime / matchDurationFrames,
  };
}
