import { SimulationWorld } from "./simulation-world";
import type { GameState } from "./types";

export type SimulationDueKind = "fixture" | "event" | "negotiation";

export interface SimulationDueItem {
  dueDate: string;
  kind: SimulationDueKind;
  entityId: string;
  priority: number;
}

export class SimulationScheduler {
  public readonly world: SimulationWorld;

  constructor(worldOrState: SimulationWorld | GameState) {
    this.world =
      worldOrState instanceof SimulationWorld ? worldOrState : SimulationWorld.fromGameState(worldOrState);
  }

  getDueQueue(): SimulationDueItem[] {
    const queue: SimulationDueItem[] = [];
    const today = this.world.gameState.time.date;

    for (const [date, fixtures] of Object.entries(this.world.fixturesByDate).sort(([a], [b]) => a.localeCompare(b))) {
      for (const fixture of fixtures) {
        if (fixture.status !== "scheduled") continue;
        if (fixture.calendarDate < today) continue;
        queue.push({
          dueDate: fixture.calendarDate,
          kind: "fixture",
          entityId: fixture.id,
          priority: 100 + (fixture.calendarDate === today ? 50 : 0),
        });
      }
    }

    for (const [date, events] of Object.entries(this.world.eventsByDueDate).sort(([a], [b]) => a.localeCompare(b))) {
      for (const event of events) {
        const eventDate = event.date.slice(0, 10);
        if (eventDate < today) continue;
        queue.push({
          dueDate: eventDate,
          kind: "event",
          entityId: event.id,
          priority: 60,
        });
      }
    }

    for (const [playerId, sessions] of Object.entries(this.world.negotiationsByPlayer).sort(([a], [b]) => a.localeCompare(b))) {
      for (const session of sessions) {
        const entry = session.entries.at(-1);
        const sessionDate = entry?.date?.slice(0, 10) ?? this.world.gameState.time.date;
        if (sessionDate < today) continue;
        queue.push({
          dueDate: sessionDate,
          kind: "negotiation",
          entityId: `${playerId}:${session.id}`,
          priority: 40,
        });
      }
    }

    return queue.sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        b.priority - a.priority ||
        a.kind.localeCompare(b.kind) ||
        a.entityId.localeCompare(b.entityId),
    );
  }
}

export function buildSimulationScheduler(state: GameState): SimulationScheduler {
  return new SimulationScheduler(state);
}

export function createSimulationScheduler(state: GameState): SimulationScheduler {
  return buildSimulationScheduler(state);
}
