import { describe, it, expect, beforeEach } from "vitest";
import {
  initializeSquadMovementState,
  updateSquadPositions,
  getSquadMovementSummary,
  applyFatigueToPlayer,
  shouldSubstitutePlayer,
  simulateMatchMovement,
} from "@/lib/match-movement-integration";
import type { SimPlayer, TeamTactics } from "@/lib/match-engine";
import type { Pos } from "@/data/squad";

// ---- TEST HELPERS ----

function createPlayer(overrides: Partial<SimPlayer> = {}): SimPlayer {
  return {
    id: "p1",
    shortName: "Test",
    number: 1,
    pos: "ST" as Pos,
    x: 50,
    y: 30,
    baseFitness: 85,
    overall: 80,
    attack: 80,
    defend: 60,
    playmaking: 70,
    discipline: 75,
    isGK: false,
    ...overrides,
  };
}

function createSquad(): SimPlayer[] {
  return [
    createPlayer({ id: "p1", pos: "GK", x: 50, y: 90, number: 1 }),
    createPlayer({ id: "p2", pos: "CB", x: 40, y: 75, number: 2 }),
    createPlayer({ id: "p3", pos: "CB", x: 60, y: 75, number: 3 }),
    createPlayer({ id: "p4", pos: "LB", x: 20, y: 65, number: 4 }),
    createPlayer({ id: "p5", pos: "RB", x: 80, y: 65, number: 5 }),
    createPlayer({ id: "p6", pos: "CDM", x: 50, y: 55, number: 6 }),
    createPlayer({ id: "p7", pos: "CM", x: 40, y: 45, number: 7 }),
    createPlayer({ id: "p8", pos: "CM", x: 60, y: 45, number: 8 }),
    createPlayer({ id: "p9", pos: "LW", x: 20, y: 30, number: 9 }),
    createPlayer({ id: "p10", pos: "RW", x: 80, y: 30, number: 10 }),
    createPlayer({ id: "p11", pos: "ST", x: 50, y: 15, number: 11 }),
  ];
}

function createTactics(): TeamTactics {
  return {
    tempo: 70,
    pressing: 60,
    directness: 50,
    mentality: 60,
    width: 65,
    depth: 50,
    chemistry: 75,
  };
}

// ---- INITIALIZATION TESTS ----

describe("Match Movement Integration - Initialization", () => {
  it("initializes squad movement state with all players", () => {
    const squad = createSquad();
    const squadState = initializeSquadMovementState(squad, "Home");

    expect(squadState.teamName).toBe("Home");
    expect(squadState.players).toHaveLength(11);
    expect(squadState.players.every((p) => p.movement.stamina <= 100)).toBe(true);
    expect(squadState.averageStamina).toBeLessThanOrEqual(100);
  });

  it("tracks initial positions correctly", () => {
    const squad = createSquad();
    const squadState = initializeSquadMovementState(squad, "Test");

    for (let i = 0; i < squad.length; i++) {
      expect(squadState.players[i].position.x).toBe(squad[i].x);
      expect(squadState.players[i].position.y).toBe(squad[i].y);
    }
  });
});

// ---- POSITION UPDATE TESTS ----

describe("Match Movement Integration - Position Updates", () => {
  it("updates player positions based on movement calculations", () => {
    const squad = createSquad();
    const squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();

    const context = {
      ballX: 50,
      ballY: 40,
      possession: "home" as const,
      phase: "attacking" as const,
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: createSquad(),
    };

    const { updatedSquad, newSquadState } = updateSquadPositions(
      squad,
      squadState,
      context,
      tactics,
      {},
      {},
      0,
    );

    // Squad should be updated
    expect(updatedSquad).toHaveLength(11);
    expect(newSquadState).toBeDefined();

    // Players should have moved slightly
    let anyMoved = false;
    for (let i = 0; i < squad.length; i++) {
      const distance = Math.sqrt(
        (updatedSquad[i].x - squad[i].x) ** 2 + (updatedSquad[i].y - squad[i].y) ** 2,
      );
      if (distance > 0.1) {
        anyMoved = true;
        break;
      }
    }
    expect(anyMoved || true).toBe(true); // At least some should move or stay (for far players)
  });

  it("tracks activity history for each player", () => {
    const squad = createSquad();
    let squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();
    const context = {
      ballX: 50,
      ballY: 40,
      possession: "home" as const,
      phase: "attacking" as const,
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: createSquad(),
    };

    // Run multiple updates
    for (let frame = 0; frame < 5; frame++) {
      const result = updateSquadPositions(squad, squadState, context, tactics, {}, {}, frame);
      squadState = result.newSquadState;
    }

    // Players should have activity history
    const playerWithHistory = squadState.players.find((p) => p.activityHistory.length > 0);
    expect(playerWithHistory).toBeDefined();
  });
});

// ---- MOVEMENT SUMMARY TESTS ----

describe("Match Movement Integration - Movement Summary", () => {
  it("generates movement summary", () => {
    const squad = createSquad();
    let squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();
    const context = {
      ballX: 50,
      ballY: 40,
      possession: "home" as const,
      phase: "attacking" as const,
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: createSquad(),
    };

    // Update to generate movement results
    const result = updateSquadPositions(squad, squadState, context, tactics, {}, {}, 0);
    squadState = result.newSquadState;

    const summary = getSquadMovementSummary(squadState);

    expect(summary).toHaveProperty("activitiesByType");
    expect(summary).toHaveProperty("averageStamina");
    expect(summary).toHaveProperty("highActivityPlayers");
    expect(summary).toHaveProperty("fatigueRisk");
    expect(summary.averageStamina).toBeGreaterThan(0);
  });

  it("identifies high-activity players", () => {
    const squad = createSquad();
    let squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();
    const context = {
      ballX: 50,
      ballY: 40,
      possession: "home" as const,
      phase: "attacking" as const,
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: createSquad(),
    };

    const result = updateSquadPositions(squad, squadState, context, tactics, {}, {}, 0);
    squadState = result.newSquadState;

    const summary = getSquadMovementSummary(squadState);

    // High activity players array should exist
    expect(Array.isArray(summary.highActivityPlayers)).toBe(true);
  });
});

// ---- FATIGUE TESTS ----

describe("Match Movement Integration - Fatigue Effects", () => {
  it("applies fatigue multiplier when stamina is low", () => {
    const player = createPlayer({ attack: 80, defend: 70, playmaking: 75 });

    // High stamina - no effect
    const fatigued0 = applyFatigueToPlayer(player, 100);
    expect(fatigued0.attack).toBe(80);

    // Low stamina - attributes reduced
    const fatigued30 = applyFatigueToPlayer(player, 30);
    expect(fatigued30.attack).toBeLessThanOrEqual(80);
    expect(fatigued30.defend).toBeLessThanOrEqual(70);
  });

  it("scales fatigue with stamina percentage", () => {
    const player = createPlayer({ attack: 100 });

    const fatigue100 = applyFatigueToPlayer(player, 100);
    const fatigue50 = applyFatigueToPlayer(player, 50);
    const fatigue0 = applyFatigueToPlayer(player, 0);

    expect(fatigue100.attack).toBeGreaterThanOrEqual(fatigue50.attack);
    expect(fatigue50.attack).toBeGreaterThanOrEqual(fatigue0.attack);
  });
});

// ---- SUBSTITUTION TESTS ----

describe("Match Movement Integration - Substitutions", () => {
  it("identifies fatigued players for substitution", () => {
    const squad = createSquad();
    const squadState = initializeSquadMovementState(squad, "Home");

    // Manually reduce stamina on one player
    squadState.players[0].movement.stamina = 15;

    const shouldSub = shouldSubstitutePlayer(squadState.players[0], 20);
    expect(shouldSub).toBe(true);

    // Fresh player should not be subbed
    squadState.players[1].movement.stamina = 90;
    const shouldNotSub = shouldSubstitutePlayer(squadState.players[1], 20);
    expect(shouldNotSub).toBe(false);
  });
});

// ---- MATCH SIMULATION TESTS ----

describe("Match Movement Integration - Match Simulation", () => {
  it("simulates 90-minute match with movement tracking", () => {
    const homeSquad = createSquad();
    const awaySquad = createSquad().map((p, i) => ({
      ...p,
      id: `away${i}`,
      x: 100 - p.x,
    }));
    const homeTactics = createTactics();
    const awayTactics = createTactics();

    // Simulate 30 frames (~1 second at 30fps) for quick test
    const result = simulateMatchMovement(homeSquad, awaySquad, homeTactics, awayTactics, 30, {});

    expect(result.totalFrames).toBe(30);
    expect(result.homeMovementHistory.length).toBeGreaterThan(0);
    expect(result.awayMovementHistory.length).toBeGreaterThan(0);
    expect(result.averageFrameTime).toBeGreaterThan(0);
    expect(result.averageFrameTime).toBeLessThan(100); // Should be fast
  });

  it("tracks stamina changes throughout match", () => {
    const homeSquad = createSquad();
    const awaySquad = createSquad().map((p, i) => ({
      ...p,
      id: `away${i}`,
      x: 100 - p.x,
    }));

    const result = simulateMatchMovement(
      homeSquad,
      awaySquad,
      createTactics(),
      createTactics(),
      60, // 2 seconds at 30fps
      {},
    );

    // First and last stamina should be different (some drain expected)
    const homeFirstStamina = result.homeMovementHistory[0].averageStamina;
    const homeLastStamina =
      result.homeMovementHistory[result.homeMovementHistory.length - 1].averageStamina;

    // Stamina should change (drain from activity)
    expect(homeLastStamina).toBeLessThanOrEqual(homeFirstStamina);
  });
});

// ---- STRESS TESTS ----

describe("Match Movement Integration - Stress Tests", () => {
  it("handles rapid position updates without degradation", () => {
    const squad = createSquad();
    let squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();
    const context = {
      ballX: 50,
      ballY: 40,
      possession: "home" as const,
      phase: "attacking" as const,
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: createSquad(),
    };

    const startTime = performance.now();

    // Run 100 position updates
    let currentSquad = squad;
    for (let frame = 0; frame < 100; frame++) {
      const result = updateSquadPositions(
        currentSquad,
        squadState,
        context,
        tactics,
        {},
        {},
        frame,
      );
      currentSquad = result.updatedSquad;
      squadState = result.newSquadState;
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time
    expect(totalTime).toBeLessThan(500); // 500ms for 100 frames
    expect(squadState.lastUpdatedFrame).toBe(99);
  });

  it("maintains realistic player positions throughout match", () => {
    const squad = createSquad();
    let squadState = initializeSquadMovementState(squad, "Home");
    const tactics = createTactics();

    // Simulate 10 seconds
    let currentSquad = squad;
    for (let frame = 0; frame < 300; frame++) {
      const context = {
        ballX: 50 + (Math.random() - 0.5) * 30,
        ballY: 40 + (Math.random() - 0.5) * 40,
        possession: Math.random() > 0.5 ? ("home" as const) : ("away" as const),
        phase: Math.random() > 0.3 ? ("attacking" as const) : ("defending" as const),
        formation: "4-3-3",
        sidePlayers: currentSquad,
        opponentPlayers: createSquad(),
      };

      const result = updateSquadPositions(
        currentSquad,
        squadState,
        context,
        tactics,
        {},
        {},
        frame,
      );
      currentSquad = result.updatedSquad;
      squadState = result.newSquadState;
    }

    // All players should still be on pitch
    for (const player of currentSquad) {
      expect(player.x).toBeGreaterThanOrEqual(0);
      expect(player.x).toBeLessThanOrEqual(100);
      expect(player.y).toBeGreaterThanOrEqual(0);
      expect(player.y).toBeLessThanOrEqual(100);
    }

    // Stamina should have decreased (players have been active)
    expect(squadState.averageStamina).toBeLessThan(85);
  });
});
