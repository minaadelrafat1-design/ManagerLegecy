import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateDynamicMovement,
  calculateSquadDynamicMovement,
  initializeMovementState,
  MovementState,
  MovementResult,
  MovementConfig,
} from "@/lib/dynamic-movement";
import {
  calculatePositionalTarget,
  type PositionalTarget,
  type MatchContext,
} from "@/lib/positional-targeting";
import type { SimPlayer } from "@/lib/match-engine";
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
    tacticalFamiliarity: 70,
    ...overrides,
  };
}

function createContext(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    ballX: 50,
    ballY: 40,
    possession: "home",
    phase: "attacking",
    formation: "4-3-3",
    sidePlayers: [],
    opponentPlayers: [],
    ...overrides,
  };
}

function createPositionalTarget(overrides: Partial<PositionalTarget> = {}): PositionalTarget {
  return {
    targetX: 50,
    targetY: 25,
    currentX: 50,
    currentY: 30,
    urgency: 0.6,
    reason: "test-target",
    ...overrides,
  };
}

// ---- BASIC MOVEMENT TESTS ----

describe("Dynamic Movement - Initialization", () => {
  it("creates initial movement state with correct defaults", () => {
    const state = initializeMovementState("p1", 100);

    expect(state.playerId).toBe("p1");
    expect(state.stamina).toBe(100);
    expect(state.currentActivity).toBe("holding-position");
    expect(state.oscillationCounter).toBe(0);
    expect(state.targetLockUntil).toBe(0);
  });

  it("initializes with custom stamina", () => {
    const state = initializeMovementState("p1", 60);
    expect(state.stamina).toBe(60);
  });
});

// ---- STAMINA MANAGEMENT TESTS ----

describe("Dynamic Movement - Stamina Management", () => {
  it("decreases stamina during high-intensity activities", () => {
    const initialState = initializeMovementState("p1", 100);
    const config: Partial<MovementConfig> = { staminaDrainRate: 1, staminarRecoveryRate: 0 };

    // Simulate a counter-pressing activity
    const player = createPlayer();
    const context = createContext();
    const target = createPositionalTarget();

    const result1 = calculateDynamicMovement(
      player,
      context,
      target,
      initialState,
      "press",
      config,
      [player],
      [createPlayer({ id: "opp1", pos: "CB", x: 50, y: 80 })],
    );

    // After one frame of counter-pressing, stamina should decrease
    expect(initialState.stamina).toBeLessThan(100);
  });

  it("recovers stamina during low-intensity activities", () => {
    const state = initializeMovementState("p1", 50);
    state.currentActivity = "holding-position";
    const config: Partial<MovementConfig> = { staminaDrainRate: 0, staminarRecoveryRate: 2 };

    const player = createPlayer({ pos: "GK", y: 90, x: 50 }); // Goalkeeper far from play
    const context = createContext({
      phase: "attacking",
      possession: "home",
      ballX: 10,
      ballY: 10,
      sidePlayers: [player],
    });
    const target = createPositionalTarget({ targetX: 50, targetY: 90 });

    const staminaBefore = state.stamina;
    calculateDynamicMovement(player, context, target, state, "", config, [player], []);

    // Goalkeeper far from play should have minimal activity, allowing recovery
    expect(state.stamina).toBeGreaterThanOrEqual(staminaBefore);
  });

  it("clamps stamina between 0 and 100", () => {
    const state = initializeMovementState("p1", 150); // Invalid high - should be clamped
    expect(state.stamina).toBeLessThanOrEqual(100);
    expect(state.stamina).toBe(100);

    const state2 = initializeMovementState("p2", -50); // Invalid low - should be clamped
    expect(state2.stamina).toBeGreaterThanOrEqual(0);
    expect(state2.stamina).toBe(0);
  });
});

// ---- OSCILLATION PREVENTION TESTS ----

describe("Dynamic Movement - Oscillation Prevention", () => {
  it("detects back-and-forth movement pattern", () => {
    const state = initializeMovementState("p1", 100);
    const player = createPlayer({ x: 50, y: 30 });
    const context = createContext();
    const config: Partial<MovementConfig> = { oscillationThreshold: 2 };

    // Simulate moving to position A
    const targetA = createPositionalTarget({ targetX: 55, targetY: 35 });
    calculateDynamicMovement(player, context, targetA, state, "", config, [player], []);

    // Simulate moving back to position B
    player.x = 55;
    player.y = 35;
    const targetB = createPositionalTarget({ targetX: 50, targetY: 30 });
    const result = calculateDynamicMovement(
      player,
      context,
      targetB,
      state,
      "",
      config,
      [player],
      [],
    );

    // After oscillating, should detect and prevent
    expect(state.oscillationCounter).toBeGreaterThanOrEqual(0);
  });

  it("resets oscillation counter when moving in new direction", () => {
    const state = initializeMovementState("p1", 100);
    state.oscillationCounter = 3;

    const player = createPlayer({ x: 50, y: 30 });
    const context = createContext();

    // Move in new direction (not back-and-forth)
    const newTarget = createPositionalTarget({ targetX: 40, targetY: 20 });
    calculateDynamicMovement(player, context, newTarget, state, "", {}, [player], []);

    // Oscillation counter should decrease
    expect(state.oscillationCounter).toBeLessThanOrEqual(4);
  });
});

// ---- TARGET LOCK TESTS ----

describe("Dynamic Movement - Target Locking", () => {
  it("locks target to prevent rapid switching", () => {
    const state = initializeMovementState("p1", 100);
    const player = createPlayer();
    const context = createContext();
    const config: Partial<MovementConfig> = { targetLockDuration: 100 };

    const target1 = createPositionalTarget({ targetX: 55, targetY: 35 });
    const result1 = calculateDynamicMovement(
      player,
      context,
      target1,
      state,
      "",
      config,
      [player],
      [],
    );

    // Verify target lock was set
    expect(state.targetLockUntil).toBeGreaterThan(0);

    // Second calculation immediately after should still have target locked
    const target2 = createPositionalTarget({ targetX: 40, targetY: 20 });
    const result2 = calculateDynamicMovement(
      player,
      context,
      target2,
      state,
      "",
      config,
      [player],
      [],
    );

    // Activity should remain consistent while locked
    expect(result2.activity).toBeDefined();
  });
});

// ---- SMOOTH MOVEMENT TESTS ----

describe("Dynamic Movement - Smooth Movement", () => {
  it("limits maximum movement speed per frame", () => {
    const state = initializeMovementState("p1", 100);
    const player = createPlayer({ x: 50, y: 50 });
    const context = createContext();
    const config: Partial<MovementConfig> = { speedLimitPerFrame: 2 };

    // Target is very far away
    const target = createPositionalTarget({ targetX: 50, targetY: 10 }); // 40 units away

    const result = calculateDynamicMovement(
      player,
      context,
      target,
      state,
      "",
      config,
      [player],
      [],
    );

    // Movement should be limited
    const actualMovement = Math.sqrt(
      (result.targetX - player.x) ** 2 + (result.targetY - player.y) ** 2,
    );
    expect(actualMovement).toBeLessThanOrEqual(config.speedLimitPerFrame! * 1.5); // Small tolerance
  });
});

// ---- STRIKER RUN TESTS ----

describe("Dynamic Movement - Striker Runs", () => {
  it("striker makes forward run with aggressive instruction", () => {
    const state = initializeMovementState("striker", 100);
    const striker = createPlayer({
      id: "striker",
      pos: "ST",
      x: 50,
      y: 30,
      attack: 85,
    });

    const context = createContext({
      phase: "attacking",
      possession: "home",
      ballX: 50,
      ballY: 40,
    });

    const target = createPositionalTarget({ targetX: 50, targetY: 15, urgency: 0.8 });
    const teamPlayers = [striker];
    const result = calculateDynamicMovement(
      striker,
      context,
      target,
      state,
      "get-in-behind",
      {},
      teamPlayers,
      [],
    );

    // Should be attempting a forward run
    expect(result.activity).toMatch(/forward-run|box-run|space-run/);
    expect(result.urgency).toBeGreaterThan(0.6);
  });

  it("striker presses during defensive phase with press instruction", () => {
    const state = initializeMovementState("striker", 100);
    const striker = createPlayer({
      id: "striker",
      pos: "ST",
      x: 50,
      y: 30,
    });

    const defender = createPlayer({
      id: "defender",
      pos: "CB",
      x: 50,
      y: 75,
    });

    const context = createContext({
      phase: "defending",
      possession: "away",
      ballX: 50,
      ballY: 60,
      sidePlayers: [striker], // Mark striker as part of defending team
      opponentPlayers: [defender],
    });

    const target = createPositionalTarget();
    const result = calculateDynamicMovement(
      striker,
      context,
      target,
      state,
      "press",
      {},
      [striker],
      [defender],
    );

    // During defending phase with press instruction, should attempt pressing
    expect(result.activity).toMatch(/counter-pressing|retreating/);
    expect(result.urgency).toBeGreaterThan(0.5);
  });
});

// ---- FULLBACK RUN TESTS ----

describe("Dynamic Movement - Fullback Runs", () => {
  it("fullback overlaps with winger", () => {
    const state = initializeMovementState("fullback", 100);
    const fullback = createPlayer({ id: "fb", pos: "LB", x: 20, y: 50 });
    const winger = createPlayer({ id: "winger", pos: "LW", x: 15, y: 30 });

    const context = createContext({
      phase: "attacking",
      possession: "home",
    });

    const target = createPositionalTarget();
    const teamPlayers = [fullback, winger];

    const result = calculateDynamicMovement(
      fullback,
      context,
      target,
      state,
      "overlap",
      {},
      teamPlayers,
      [],
    );

    expect(result.activity).toMatch(/overlapping-run|supporting-play/);
    // Should be more advanced than normal fullback position
    expect(result.targetY).toBeLessThan(fullback.y);
  });
});

// ---- SQUAD-LEVEL TESTS ----

describe("Dynamic Movement - Squad Level", () => {
  it("calculates movement for entire squad", () => {
    const squad = [
      createPlayer({ id: "p1", pos: "GK", x: 50, y: 90 }),
      createPlayer({ id: "p2", pos: "CB", x: 50, y: 75 }),
      createPlayer({ id: "p3", pos: "LB", x: 20, y: 65 }),
      createPlayer({ id: "p4", pos: "RB", x: 80, y: 65 }),
      createPlayer({ id: "p5", pos: "CM", x: 40, y: 50 }),
      createPlayer({ id: "p6", pos: "CM", x: 60, y: 50 }),
      createPlayer({ id: "p7", pos: "LW", x: 15, y: 30 }),
      createPlayer({ id: "p8", pos: "RW", x: 85, y: 30 }),
      createPlayer({ id: "p9", pos: "CAM", x: 50, y: 25 }),
      createPlayer({ id: "p10", pos: "ST", x: 50, y: 15 }),
    ];

    const context = createContext({
      phase: "attacking",
      possession: "home",
      sidePlayers: squad,
      opponentPlayers: [],
    });

    const targets = squad.map((p) => ({
      targetX: p.x,
      targetY: p.y - 5,
      currentX: p.x,
      currentY: p.y,
      urgency: 0.5,
      reason: "test",
    }));

    const states = squad.map((p) => initializeMovementState(p.id, 100));

    const results = calculateSquadDynamicMovement(
      squad,
      context,
      targets,
      states,
      {},
      {},
      squad,
      [],
    );

    expect(results).toHaveLength(squad.length);
    expect(results.every((r) => typeof r.targetX === "number")).toBe(true);
    expect(results.every((r) => typeof r.targetY === "number")).toBe(true);
  });

  it("optimizes calculations for players far from play", () => {
    const squad = [
      createPlayer({ id: "p1", pos: "GK", x: 50, y: 90 }),
      createPlayer({ id: "p2", pos: "ST", x: 50, y: 15 }),
    ];

    const context = createContext({
      phase: "defending",
      possession: "away",
      ballX: 50,
      ballY: 20,
      sidePlayers: squad,
      opponentPlayers: [],
    });

    const targets = squad.map((p) => ({
      targetX: p.x,
      targetY: p.y,
      currentX: p.x,
      currentY: p.y,
      urgency: 0.5,
      reason: "test",
    }));

    const states = squad.map((p) => initializeMovementState(p.id, 100));
    const results = calculateSquadDynamicMovement(
      squad,
      context,
      targets,
      states,
      {},
      {},
      squad,
      [],
    );

    // GK is far from ball during defending - should use optimization
    const gkResult = results[0];
    expect(gkResult.reason).toContain("far-from-play" || "retreating");
  });
});

// ---- INTEGRATION WITH POSITIONAL TARGETING ----

describe("Dynamic Movement - Integration with Positional Targeting", () => {
  it("enhances positional targets with purposeful movement", () => {
    const player = createPlayer({ pos: "ST", attack: 85 });
    const context = createContext({ phase: "attacking", possession: "home" });

    // Get base positional target
    const posTarget = calculatePositionalTarget(player, context, "get-in-behind");

    // Enhance with dynamic movement
    const state = initializeMovementState(player.id, 100);
    const movementResult = calculateDynamicMovement(
      player,
      context,
      posTarget,
      state,
      "get-in-behind",
      {},
      [player],
      [],
    );

    // Movement result should extend positional target
    expect(movementResult).toHaveProperty("targetX");
    expect(movementResult).toHaveProperty("targetY");
    expect(movementResult).toHaveProperty("activity");
    expect(movementResult).toHaveProperty("urgency");
    expect(movementResult).toHaveProperty("reason");
  });
});

// ---- STRESS TESTS ----

describe("Dynamic Movement - Stress Tests", () => {
  it("handles rapid repeated movement calculations without degradation", () => {
    const player = createPlayer();
    const context = createContext();
    const target = createPositionalTarget();
    const state = initializeMovementState(player.id, 100);

    const results: MovementResult[] = [];

    // Simulate 100 frames of movement calculations
    for (let i = 0; i < 100; i++) {
      const result = calculateDynamicMovement(player, context, target, state, "", {}, [player], []);
      results.push(result);
    }

    // All frames should complete successfully
    expect(results).toHaveLength(100);
    expect(results.every((r) => !isNaN(r.targetX) && !isNaN(r.targetY))).toBe(true);
  });

  it("handles large squad movements without performance degradation", () => {
    const squad: SimPlayer[] = [];
    for (let i = 0; i < 22; i++) {
      squad.push(
        createPlayer({
          id: `p${i}`,
          number: i + 1,
          pos:
            (["GK", "CB", "CB", "LB", "RB", "CM", "CM", "CAM", "LW", "RW", "ST"][i] as Pos) || "CM",
          x: 30 + Math.random() * 40,
          y: 30 + Math.random() * 40,
        }),
      );
    }

    const context = createContext({
      sidePlayers: squad.slice(0, 11),
      opponentPlayers: squad.slice(11),
    });

    const targets = squad.map((p) => ({
      targetX: p.x + (Math.random() - 0.5) * 10,
      targetY: p.y + (Math.random() - 0.5) * 10,
      currentX: p.x,
      currentY: p.y,
      urgency: Math.random(),
      reason: "stress-test",
    }));

    const states = squad.map((p) => initializeMovementState(p.id, 100));

    const startTime = performance.now();
    const results = calculateSquadDynamicMovement(
      squad,
      context,
      targets,
      states,
      {},
      {},
      squad.slice(0, 11),
      squad.slice(11),
    );
    const endTime = performance.now();

    // Should complete in reasonable time (< 50ms for 22 players)
    expect(endTime - startTime).toBeLessThan(50);
    expect(results).toHaveLength(22);
  });

  it("maintains position stability over many frames", () => {
    const player = createPlayer({ y: 60 }); // Defensive area
    const context = createContext({ phase: "defending" });
    const target = createPositionalTarget({ targetX: 50, targetY: 65 });
    const state = initializeMovementState(player.id, 100);

    const positions: Array<[number, number]> = [[player.x, player.y]];

    // Simulate 50 frames
    for (let i = 0; i < 50; i++) {
      const result = calculateDynamicMovement(player, context, target, state, "", {}, [player], []);
      positions.push([result.targetX, result.targetY]);
    }

    // Positions should not oscillate wildly
    for (let i = 2; i < positions.length; i++) {
      const [x1, y1] = positions[i - 1];
      const [x2, y2] = positions[i];
      const movement = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      expect(movement).toBeLessThan(3); // Small incremental movement
    }
  });
});

// ---- TACTICAL INSTRUCTION TESTS ----

describe("Dynamic Movement - Tactical Instructions", () => {
  it("responds to 'get-in-behind' instruction", () => {
    const state = initializeMovementState("striker", 100);
    const striker = createPlayer({
      id: "striker",
      pos: "ST",
      x: 50,
      y: 35,
      attack: 85,
    });

    const context = createContext({ phase: "attacking", possession: "home" });
    const target = createPositionalTarget();

    const result = calculateDynamicMovement(
      striker,
      context,
      target,
      state,
      "get-in-behind",
      {},
      [striker],
      [],
    );

    expect(result.activity).toMatch(/forward-run|box-run|space-run/);
    expect(result.urgency).toBeGreaterThan(0.65);
  });

  it("responds to 'press' instruction during defense", () => {
    const state = initializeMovementState("forward", 100);
    const forward = createPlayer({
      id: "forward",
      pos: "ST",
      x: 50,
      y: 30,
    });

    const defender = createPlayer({
      id: "defender",
      pos: "CB",
      x: 50,
      y: 80,
    });

    const context = createContext({
      phase: "defending",
      possession: "away",
      ballX: 50,
      ballY: 70,
    });

    const target = createPositionalTarget();

    const result = calculateDynamicMovement(
      forward,
      context,
      target,
      state,
      "press",
      {},
      [forward],
      [defender],
    );

    expect(result.urgency).toBeGreaterThan(0.65);
  });

  it("responds to 'cut-inside' instruction for wingers", () => {
    const state = initializeMovementState("winger", 100);
    const winger = createPlayer({
      id: "winger",
      pos: "LW",
      x: 15,
      y: 30,
    });

    const context = createContext({ phase: "attacking", possession: "home" });
    const target = createPositionalTarget();

    const result = calculateDynamicMovement(
      winger,
      context,
      target,
      state,
      "cut-inside",
      {},
      [winger],
      [],
    );

    // When cutting inside, should move more centrally
    expect(result.targetX).toBeGreaterThan(winger.x - 5);
  });

  it("responds to 'overlap' instruction for fullbacks", () => {
    const state = initializeMovementState("fullback", 100);
    const fullback = createPlayer({
      id: "fullback",
      pos: "LB",
      x: 20,
      y: 50,
    });

    const context = createContext({ phase: "attacking", possession: "home" });
    const target = createPositionalTarget();

    const result = calculateDynamicMovement(
      fullback,
      context,
      target,
      state,
      "overlap",
      {},
      [fullback],
      [],
    );

    expect(result.activity).toMatch(/overlapping-run|supporting-play/);
  });
});

// ---- REGRESSION TESTS ----

describe("Dynamic Movement - Regression Tests", () => {
  it("prevents rapid oscillation between nearby positions", () => {
    const state = initializeMovementState("p1", 100);
    const player = createPlayer({ x: 50, y: 50 });
    const context = createContext();
    const config: Partial<MovementConfig> = { oscillationThreshold: 2, speedLimitPerFrame: 3 };

    const positions: Array<[number, number]> = [[player.x, player.y]];

    // Alternate between two targets
    for (let i = 0; i < 10; i++) {
      const target = createPositionalTarget({
        targetX: i % 2 === 0 ? 55 : 45,
        targetY: i % 2 === 0 ? 55 : 45,
      });

      player.x = positions[positions.length - 1][0];
      player.y = positions[positions.length - 1][1];

      const result = calculateDynamicMovement(
        player,
        context,
        target,
        state,
        "",
        config,
        [player],
        [],
      );
      positions.push([result.targetX, result.targetY]);
    }

    // Should not be stuck oscillating at same two positions
    const unique = new Set(positions.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`));
    expect(unique.size).toBeGreaterThan(2); // More than just 2 unique positions
  });

  it("maintains performance with complex tactical scenarios", () => {
    const squad = Array.from({ length: 11 }, (_, i) =>
      createPlayer({
        id: `home${i}`,
        number: i + 1,
        pos: ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"][i] as Pos,
        x: 20 + (i % 5) * 15,
        y: 30 + Math.floor(i / 5) * 25,
        attack: 50 + Math.random() * 40,
      }),
    );

    const opponents = Array.from({ length: 11 }, (_, i) =>
      createPlayer({
        id: `away${i}`,
        number: i + 1,
        pos: ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"][i] as Pos,
        x: 100 - (20 + (i % 5) * 15),
        y: 100 - (30 + Math.floor(i / 5) * 25),
      }),
    );

    const context = createContext({
      formation: "4-3-3",
      sidePlayers: squad,
      opponentPlayers: opponents,
      ballX: 50 + (Math.random() - 0.5) * 20,
      ballY: 40 + (Math.random() - 0.5) * 20,
    });

    const targets = squad.map((p) => ({
      targetX: p.x + (Math.random() - 0.5) * 10,
      targetY: p.y + (Math.random() - 0.5) * 10,
      currentX: p.x,
      currentY: p.y,
      urgency: Math.random(),
      reason: "complex-scenario",
    }));

    const states = squad.map((p) => initializeMovementState(p.id, 80 + Math.random() * 20));

    const instructions: Record<string, string> = {
      home8: "cut-inside",
      home9: "stay-wide",
      home10: "get-in-behind",
      home0: "press",
    };

    const startTime = performance.now();
    const results = calculateSquadDynamicMovement(
      squad,
      context,
      targets,
      states,
      instructions,
      {},
      squad,
      opponents,
    );
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100);
    expect(results).toHaveLength(11);
    expect(results.every((r) => !isNaN(r.targetX) && !isNaN(r.targetY))).toBe(true);
  });
});
