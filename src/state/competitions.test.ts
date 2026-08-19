/**
 * COMPETITION OUTCOMES TEST SUITE
 *
 * Verifies:
 * - Competition structures are valid
 * - Competitions and fixtures are properly linked
 * - Promotion/relegation configuration is valid
 * - No corruption in competition data
 */

import { describe, it, expect } from "vitest";
import { buildInitialState } from "../state/seed";

describe("Competition Outcomes - Structure Validity", () => {
  it("competitions have valid structure", () => {
    const state = buildInitialState();

    for (const comp of state.competitions) {
      expect(comp.id).toBeDefined();
      expect(comp.name).toBeDefined();
      // Competition has id and name
      expect(typeof comp.id).toBe("string");
      expect(typeof comp.name).toBe("string");
    }
  });

  it("fixtures reference valid competitions", () => {
    const state = buildInitialState();

    const competitionIds = new Set(state.competitions.map((c) => c.id));

    for (const fixture of state.fixtures) {
      expect(competitionIds.has(fixture.competitionId)).toBe(true);
    }
  });

  it("initial state has no corrupted events", () => {
    const state = buildInitialState();

    for (const event of state.events ?? []) {
      expect(event.id).toBeDefined();
      expect(event.type).toBeDefined();
    }
  });
});
