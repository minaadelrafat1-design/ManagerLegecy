import { describe, expect, it } from "vitest";
import { buildInitialState } from "./seed";
import { generateAIManager } from "./ai-manager";
import { generateReplacementManager } from "./ai-evolution";

function clubInput(state: ReturnType<typeof buildInitialState>) {
  const club = Object.values(state.clubs).find((item) => item.aiManager)!;
  return {
    id: club.id,
    name: club.name,
    formation: club.formation,
    reputation: club.reputation,
    facilities: club.facilities,
  };
}

describe("AI manager career identity", () => {
  it("is deterministic for the same seed, club, and generation", () => {
    const state = buildInitialState("identity-seed");
    const input = clubInput(state);
    const first = generateAIManager(input, { worldSeed: "identity-seed", generation: 4 });
    const second = generateAIManager(input, { worldSeed: "identity-seed", generation: 4 });
    expect(second).toEqual(first);
  });

  it("changes identity when the appointment generation changes", () => {
    const state = buildInitialState("identity-seed");
    const input = clubInput(state);
    const first = generateAIManager(input, { worldSeed: "identity-seed", generation: 1 });
    const replacement = generateAIManager(input, { worldSeed: "identity-seed", generation: 2 });
    expect(replacement.careerId).not.toBe(first.careerId);
    expect(replacement.id).not.toBe(first.id);
    expect(JSON.stringify(replacement)).not.toBe(JSON.stringify(first));
  });

  it("changes identity when the world seed changes", () => {
    const state = buildInitialState("identity-seed");
    const input = clubInput(state);
    const first = generateAIManager(input, { worldSeed: "world-a", generation: 1 });
    const second = generateAIManager(input, { worldSeed: "world-b", generation: 1 });
    expect(second.careerId).not.toBe(first.careerId);
    expect(second.name).not.toBe(first.name);
  });

  it("builds different initial manager worlds for different seeds", () => {
    const firstState = buildInitialState("world-a");
    const secondState = buildInitialState("world-b");
    const firstManager = Object.values(firstState.clubs).find((club) => club.aiManager)?.aiManager;
    const secondManager = Object.values(secondState.clubs).find(
      (club) => club.aiManager,
    )?.aiManager;
    expect(firstManager?.careerId).not.toBe(secondManager?.careerId);
  });

  it("replacement appointment does not reuse the old manager", () => {
    const state = buildInitialState("replacement-seed");
    const club = Object.values(state.clubs).find((item) => item.aiManager)!;
    const oldManager = club.aiManager!;
    const replacement = generateReplacementManager(state, {
      ...club,
      aiManager: { ...oldManager, patience: 10, reputation: 10 },
    });
    expect(replacement).toBeDefined();
    expect(replacement?.careerId).not.toBe(oldManager.careerId);
    expect(replacement?.generation).toBe((oldManager.generation ?? 1) + 1);
  });

  it("preserves career identity through save-shaped serialization", () => {
    const state = buildInitialState("save-identity-seed");
    const manager = Object.values(state.clubs).find((club) => club.aiManager)?.aiManager;
    const restored = JSON.parse(JSON.stringify(manager));
    expect(restored.careerId).toBe(manager?.careerId);
    expect(restored.generation).toBe(manager?.generation);
  });
});
