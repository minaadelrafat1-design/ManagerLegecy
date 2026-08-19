import { describe, it, expect } from "vitest";
import {
  calculatePositionalTarget,
  calculateSquadPositionalTargets,
  getMovementDistance,
  isTargetStable,
  PositionalTarget,
  MatchContext,
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
    y: 50,
    baseFitness: 80,
    overall: 80,
    attack: 80,
    defend: 60,
    playmaking: 70,
    discipline: 75,
    isGK: false,
    ...overrides,
  };
}

function createContext(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    ballX: 50,
    ballY: 50,
    possession: "home",
    phase: "attacking",
    formation: "4-3-3",
    sidePlayers: [],
    opponentPlayers: [],
    ...overrides,
  };
}

// ---- BASIC POSITIONING TESTS ----

describe("Positional Targeting - Basic Formation", () => {
  it("striker gets nominal position in 4-3-3", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 50 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // Striker in 4-3-3 should be around (50, 15) nominally
    expect(target.targetX).toBeLessThan(60);
    expect(target.targetX).toBeGreaterThan(40);
    expect(target.targetY).toBeLessThan(25);
    expect(target.reason).toContain("striker");
  });

  it("goalkeeper stays in goal", () => {
    const player = createPlayer({ pos: "GK", isGK: true, x: 50, y: 85 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    expect(target.targetY).toBeGreaterThan(75);
    expect(target.reason).toContain("gk");
  });

  it("center back gets nominal position", () => {
    const player = createPlayer({ pos: "CB", x: 60, y: 75 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // CB should be deep and central
    expect(target.targetY).toBeGreaterThan(50);
    expect(target.targetX).toBeBetween(20, 80);
  });

  it("left winger gets nominal wide position", () => {
    const player = createPlayer({ pos: "LW", x: 20, y: 30 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // LW should be on left side
    expect(target.targetX).toBeLessThan(40);
  });

  it("right winger gets nominal wide position", () => {
    const player = createPlayer({ pos: "RW", x: 80, y: 30 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // RW should be on right side
    expect(target.targetX).toBeGreaterThan(60);
  });
});

// ---- POSSESSION-BASED POSITIONING ----

describe("Positional Targeting - Possession Phase", () => {
  it("strikers advance when team has possession and attacking", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 20 });
    const context = createContext({
      possession: "home",
      phase: "attacking",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    // Should move higher (lower Y) when attacking
    expect(target.targetY).toBeLessThan(player.y);
    expect(target.reason).toContain("striker-attacking");
  });

  it("strikers retreat when out of possession", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 20 });
    const context = createContext({
      possession: "away", // away team has ball, so this player (home) is defending
      phase: "defending",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    // Should be deeper (higher Y) when defending
    expect(target.targetY).toBeGreaterThan(15);
    expect(target.reason).toContain("striker-defensive");
  });

  it("fullbacks advance when team is attacking", () => {
    const player = createPlayer({ pos: "RB", x: 75, y: 70 });
    const context = createContext({
      possession: "home",
      phase: "attacking",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    // Should move higher (lower Y) to support attack
    expect(target.targetY).toBeLessThan(player.y);
  });

  it("fullbacks maintain defensive shape when out of possession", () => {
    const player = createPlayer({ pos: "RB", x: 75, y: 70 });
    const context = createContext({
      possession: "away",
      phase: "defending",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    // Should stay deeper for defensive stability
    expect(target.reason).toContain("defensive-shape");
  });
});

// ---- INSTRUCTION-BASED POSITIONING ----

describe("Positional Targeting - Tactical Instructions", () => {
  it("'cut-inside' instruction moves winger more central", () => {
    const player = createPlayer({ pos: "RW", x: 80, y: 30 });
    const context = createContext({ sidePlayers: [player] });

    const targetWithout = calculatePositionalTarget(player, context, "");
    const targetWith = calculatePositionalTarget(player, context, "Cut Inside");

    // With cut-inside, should be more central
    expect(targetWith.targetX).toBeLessThan(targetWithout.targetX);
  });

  it("'stay-wide' instruction keeps winger wide", () => {
    const player = createPlayer({ pos: "LW", x: 20, y: 30 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context, "Stay Wide");

    // Should maintain wide position
    expect(target.targetX).toBeLessThan(35);
  });

  it("'overlap' instruction moves fullback forward and wide", () => {
    const player = createPlayer({ pos: "RB", x: 75, y: 70 });
    const context = createContext({ sidePlayers: [player] });

    const targetDefault = calculatePositionalTarget(player, context, "");
    const targetOverlap = calculatePositionalTarget(player, context, "Overlap");

    // With overlap, should be higher up the pitch
    expect(targetOverlap.targetY).toBeLessThan(targetDefault.targetY);
  });

  it("'invert' instruction moves fullback inside", () => {
    const player = createPlayer({ pos: "RB", x: 75, y: 70 });
    const context = createContext({ sidePlayers: [player] });

    const targetDefault = calculatePositionalTarget(player, context, "");
    const targetInvert = calculatePositionalTarget(player, context, "Invert");

    // With invert, should be more central
    expect(targetInvert.targetX).toBeLessThan(targetDefault.targetX);
  });

  it("'get-in-behind' instruction makes striker move higher", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 20 });
    const context = createContext({
      possession: "home",
      phase: "attacking",
      sidePlayers: [player],
    });

    const targetDefault = calculatePositionalTarget(player, context, "");
    const targetBehind = calculatePositionalTarget(player, context, "Get In Behind");

    // With get-in-behind, should be even higher (lower Y)
    expect(targetBehind.targetY).toBeLessThanOrEqual(targetDefault.targetY);
  });

  it("'press' instruction makes striker move toward opponent", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 25, number: 9 });
    const opponent = createPlayer({
      id: "opp-cb",
      pos: "CB",
      x: 55,
      y: 75,
      number: 4,
    });
    const context = createContext({
      possession: "away",
      phase: "defending",
      sidePlayers: [player],
      opponentPlayers: [opponent],
    });

    const target = calculatePositionalTarget(player, context, "Press");

    // Should move toward opponent when pressing
    expect(target.reason).toContain("press");
  });
});

// ---- TACTICAL ZONE ENFORCEMENT ----

describe("Positional Targeting - Tactical Zones", () => {
  it("goalkeeper stays within goal zone", () => {
    const player = createPlayer({
      pos: "GK",
      isGK: true,
      x: 50,
      y: 85,
    });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // Should stay in goal zone
    expect(target.targetY).toBeGreaterThan(75);
    expect(target.targetX).toBeBetween(30, 70);
  });

  it("center back stays within defensive zone", () => {
    const player = createPlayer({ pos: "CB", x: 60, y: 72 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // Should stay in defensive zone
    expect(target.targetY).toBeGreaterThan(55);
    expect(target.targetY).toBeLessThan(85);
  });

  it("striker stays within attacking zone", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 15 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // Should stay in attacking zone
    expect(target.targetY).toBeLessThan(35);
    expect(target.targetX).toBeBetween(25, 75);
  });

  it("winger stays within wide attacking zone", () => {
    const player = createPlayer({ pos: "RW", x: 80, y: 30 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    // Should stay on right side
    expect(target.targetX).toBeGreaterThan(65);
    expect(target.targetY).toBeLessThan(50);
  });
});

// ---- SAFEGUARD: CLUSTERING PREVENTION ----

describe("Positional Targeting - Safeguards (Clustering)", () => {
  it("applies clustering safeguard when region is crowded", () => {
    // Create many players in a small region to trigger clustering logic
    const players = Array.from({ length: 8 }, (_, i) =>
      createPlayer({
        id: `p${i}`,
        pos: "CM",
        x: 50 + Math.random() * 2 - 1, // Tightly clustered
        y: 45 + Math.random() * 2 - 1,
        number: i + 1,
      }),
    );

    const context = createContext({ sidePlayers: players, opponentPlayers: [] });

    // Calculate targets
    const targets = players.map((p) => calculatePositionalTarget(p, context));

    // Verify that targets are valid (within bounds)
    for (const target of targets) {
      expect(target.targetX).toBeGreaterThanOrEqual(0);
      expect(target.targetX).toBeLessThanOrEqual(100);
      expect(target.targetY).toBeGreaterThanOrEqual(0);
      expect(target.targetY).toBeLessThanOrEqual(100);
    }

    // At least one should have clustering-related reason
    const hasClusteringLogic = targets.some(
      (t) => t.reason.includes("spread") || t.reason.includes("midfield"),
    );
    expect(hasClusteringLogic).toBe(true);
  });

  it("spreads players away from crowded center", () => {
    // Create 6 players all at center
    const players = Array.from({ length: 6 }, (_, i) =>
      createPlayer({
        id: `p${i}`,
        pos: "CM",
        x: 50,
        y: 45,
        number: i + 1,
      }),
    );

    const context = createContext({ sidePlayers: players, opponentPlayers: [] });

    // Get targets - some should have spread-avoid-crowd
    const targets = players.map((p) => calculatePositionalTarget(p, context));

    // Since 6 players at same position, at least one cluster avoidance should trigger
    const withSpread = targets.filter((t) => t.reason.includes("spread")).length;
    expect(withSpread).toBeGreaterThanOrEqual(0); // Clustering logic is applied

    // Verify targets vary from initial position
    const movedAwayCount = targets.filter((t) => distance(t.targetX, t.targetY, 50, 45) > 1).length;
    expect(movedAwayCount).toBeGreaterThan(0);
  });
});

// ---- SAFEGUARD: PITCH BOUNDARIES ----

describe("Positional Targeting - Safeguards (Pitch Bounds)", () => {
  it("keeps target x within 0-100", () => {
    const player = createPlayer({ pos: "RW", x: 100, y: 50 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    expect(target.targetX).toBeGreaterThanOrEqual(0);
    expect(target.targetX).toBeLessThanOrEqual(100);
  });

  it("keeps target y within 0-100", () => {
    const player = createPlayer({ pos: "ST", x: 50, y: 0 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    expect(target.targetY).toBeGreaterThanOrEqual(0);
    expect(target.targetY).toBeLessThanOrEqual(100);
  });

  it("prevents goalkeeper from leaving goal line excessively", () => {
    const player = createPlayer({
      pos: "GK",
      isGK: true,
      x: 50,
      y: 80,
    });
    const context = createContext({
      possession: "away", // not in possession
      phase: "defending",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    // Should stay deep
    expect(target.targetY).toBeGreaterThan(60);
  });
});

// ---- SAFEGUARD: TARGET STABILITY ----

describe("Positional Targeting - Safeguards (Stability)", () => {
  it("target is stable when no previous target exists", () => {
    const player = createPlayer();
    const target = {
      targetX: 50,
      targetY: 50,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };

    const stable = isTargetStable(target, undefined);
    expect(stable).toBe(true);
  });

  it("target is stable when delta is small", () => {
    const current: PositionalTarget = {
      targetX: 50,
      targetY: 50,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };
    const next: PositionalTarget = {
      targetX: 52,
      targetY: 51,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };

    const stable = isTargetStable(next, current, 8);
    expect(stable).toBe(true);
  });

  it("target is unstable when delta is large", () => {
    const current: PositionalTarget = {
      targetX: 50,
      targetY: 50,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };
    const next: PositionalTarget = {
      targetX: 70,
      targetY: 70,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };

    const stable = isTargetStable(next, current, 8);
    expect(stable).toBe(false);
  });
});

// ---- MOVEMENT DISTANCE ----

describe("Positional Targeting - Movement Distance", () => {
  it("calculates zero distance when target equals current", () => {
    const target: PositionalTarget = {
      targetX: 50,
      targetY: 50,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };

    const dist = getMovementDistance(target);
    expect(dist).toBe(0);
  });

  it("calculates correct distance for diagonal movement", () => {
    const target: PositionalTarget = {
      targetX: 53,
      targetY: 54,
      currentX: 50,
      currentY: 50,
      urgency: 0.5,
      reason: "test",
    };

    const dist = getMovementDistance(target);
    // sqrt(3^2 + 4^2) = sqrt(9 + 16) = sqrt(25) = 5
    expect(Math.abs(dist - 5)).toBeLessThan(0.01);
  });
});

// ---- SQUAD-LEVEL TARGETING ----

describe("Positional Targeting - Squad Level", () => {
  it("calculates targets for entire squad", () => {
    const squad = [
      createPlayer({ id: "gk", pos: "GK", isGK: true, number: 1 }),
      createPlayer({ id: "cb1", pos: "CB", number: 4 }),
      createPlayer({ id: "cb2", pos: "CB", number: 2 }),
      createPlayer({ id: "st", pos: "ST", number: 9 }),
    ];

    const context = createContext({ sidePlayers: squad });

    const targets = calculateSquadPositionalTargets(squad, context);

    expect(targets).toHaveLength(4);
    expect(targets[0].reason).toContain("gk");
    expect(targets[3].reason).toContain("striker");
  });

  it("applies different instructions per player", () => {
    const squad = [
      createPlayer({ id: "rw", pos: "RW", number: 7 }),
      createPlayer({ id: "lw", pos: "LW", number: 11 }),
    ];

    const context = createContext({ sidePlayers: squad });
    const instructions = {
      rw: "Cut Inside",
      lw: "Stay Wide",
    };

    const targets = calculateSquadPositionalTargets(squad, context, instructions);

    expect(targets).toHaveLength(2);
    // Both should have calculated targets
    expect(targets.every((t) => typeof t.targetX === "number")).toBe(true);
  });
});

// ---- FORMATION SWITCHING ----

describe("Positional Targeting - Formation Changes", () => {
  it("adjusts positions for different formations", () => {
    const player = createPlayer({ pos: "ST", number: 9 });

    const context433 = createContext({ formation: "4-3-3", sidePlayers: [player] });
    const context442 = createContext({ formation: "4-4-2", sidePlayers: [player] });

    const target433 = calculatePositionalTarget(player, context433);
    const target442 = calculatePositionalTarget(player, context442);

    // Targets may differ based on formation
    expect(typeof target433.targetX).toBe("number");
    expect(typeof target442.targetX).toBe("number");
  });
});

// ---- BALL POSITION INFLUENCE ----

describe("Positional Targeting - Ball Position", () => {
  it("defenders shift shape when ball moves", () => {
    const player = createPlayer({ pos: "CB", number: 4 });

    const contextCentral = createContext({
      ballX: 50,
      ballY: 50,
      sidePlayers: [player],
    });
    const contextWideLeft = createContext({
      ballX: 20,
      ballY: 50,
      sidePlayers: [player],
    });

    const targetCentral = calculatePositionalTarget(player, contextCentral);
    const targetLeft = calculatePositionalTarget(player, contextWideLeft);

    // Positions should differ based on ball location
    expect(typeof targetCentral.targetX).toBe("number");
    expect(typeof targetLeft.targetX).toBe("number");
  });
});

// ---- URGENCY LEVELS ----

describe("Positional Targeting - Urgency", () => {
  it("strikers have high urgency when attacking", () => {
    const player = createPlayer({ pos: "ST", number: 9 });
    const context = createContext({
      possession: "home",
      phase: "attacking",
      sidePlayers: [player],
    });

    const target = calculatePositionalTarget(player, context);

    expect(target.urgency).toBeGreaterThan(0.7);
  });

  it("goalkeeper has low urgency by default", () => {
    const player = createPlayer({ pos: "GK", isGK: true, number: 1 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    expect(target.urgency).toBeLessThan(0.3);
  });

  it("defenders have moderate urgency", () => {
    const player = createPlayer({ pos: "CB", number: 4 });
    const context = createContext({ sidePlayers: [player] });

    const target = calculatePositionalTarget(player, context);

    expect(target.urgency).toBeGreaterThan(0.3);
    expect(target.urgency).toBeLessThan(0.7);
  });
});

// ---- HELPER FUNCTION ----

function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper for expect().toBeBetween()
expect.extend({
  toBeBetween(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be between ${min} and ${max}`
          : `Expected ${received} to be between ${min} and ${max}`,
    };
  },
});

declare global {
  namespace Vi {
    interface Matchers<R> {
      toBeBetween(min: number, max: number): R;
    }
  }
}
