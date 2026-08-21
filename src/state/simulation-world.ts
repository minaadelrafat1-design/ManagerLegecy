import type {
  EventLogEntry,
  Fixture,
  GameState,
  NegotiationSession,
  Player,
} from "./types";

export interface SimulationWorldIndexes {
  fixturesByDate: Record<string, Fixture[]>;
  fixturesByClub: Record<string, Fixture[]>;
  playersByClub: Record<string, Player[]>;
  eventsByDueDate: Record<string, EventLogEntry[]>;
  negotiationsByPlayer: Record<string, NegotiationSession[]>;
}

export class SimulationWorld {
  public readonly gameState: GameState;
  public readonly fixturesByDate: Record<string, Fixture[]>;
  public readonly fixturesByClub: Record<string, Fixture[]>;
  public readonly playersByClub: Record<string, Player[]>;
  public readonly eventsByDueDate: Record<string, EventLogEntry[]>;
  public readonly negotiationsByPlayer: Record<string, NegotiationSession[]>;

  constructor(gameState: GameState, indexes: SimulationWorldIndexes) {
    this.gameState = gameState;
    this.fixturesByDate = indexes.fixturesByDate;
    this.fixturesByClub = indexes.fixturesByClub;
    this.playersByClub = indexes.playersByClub;
    this.eventsByDueDate = indexes.eventsByDueDate;
    this.negotiationsByPlayer = indexes.negotiationsByPlayer;
  }

  static fromGameState(state: GameState): SimulationWorld {
    return buildSimulationWorld(state);
  }

  toGameState(): GameState {
    return this.gameState;
  }

  getFixturesForDate(date: string): Fixture[] {
    const fixtures = this.fixturesByDate[date];
    return fixtures ? [...fixtures] : [];
  }

  getFixturesForClub(clubId: string): Fixture[] {
    const fixtures = this.fixturesByClub[clubId];
    return fixtures ? [...fixtures] : [];
  }

  getFixtureById(fixtureId: string): Fixture | undefined {
    return this.gameState.fixtures.find((fixture) => fixture.id === fixtureId);
  }

  getScheduledFixtures(): Fixture[] {
    return [...(this.gameState.fixtures ?? [])].filter((fixture) => fixture.status === "scheduled");
  }
}

function stableSort<T>(items: T[], selector: (item: T) => string): T[] {
  return [...items].sort((a, b) => selector(a).localeCompare(selector(b)));
}

function buildIndexes(state: GameState): SimulationWorldIndexes {
  const fixturesByDate: Record<string, Fixture[]> = {};
  const fixturesByClub: Record<string, Fixture[]> = {};
  const playersByClub: Record<string, Player[]> = {};
  const eventsByDueDate: Record<string, EventLogEntry[]> = {};
  const negotiationsByPlayer: Record<string, NegotiationSession[]> = {};

  for (const fixture of stableSort(state.fixtures ?? [], (item) => `${item.calendarDate}|${item.id}`)) {
    const group = fixturesByDate[fixture.calendarDate] ?? [];
    group.push(fixture);
    fixturesByDate[fixture.calendarDate] = group;

    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const clubGroup = fixturesByClub[clubId] ?? [];
      clubGroup.push(fixture);
      fixturesByClub[clubId] = clubGroup;
    }
  }

  for (const clubId of Object.keys(fixturesByClub)) {
    const clubFixtures = fixturesByClub[clubId] ?? [];
    fixturesByClub[clubId] = stableSort(clubFixtures, (item) => `${item.calendarDate}|${item.id}`);
  }

  for (const date of Object.keys(fixturesByDate)) {
    const dayFixtures = fixturesByDate[date] ?? [];
    fixturesByDate[date] = stableSort(dayFixtures, (item) => item.id);
  }

  for (const player of Object.values(state.players ?? {})) {
    const clubId = player.clubId;
    if (!clubId) continue;
    const clubPlayers = playersByClub[clubId] ?? [];
    clubPlayers.push(player);
    playersByClub[clubId] = clubPlayers;
  }

  for (const clubId of Object.keys(playersByClub)) {
    const clubPlayers = playersByClub[clubId] ?? [];
    playersByClub[clubId] = stableSort(clubPlayers, (item) => item.id);
  }

  for (const event of stableSort(state.events ?? [], (item) => `${item.date}|${item.id}`)) {
    const eventDate = event.date.slice(0, 10);
    const group = eventsByDueDate[eventDate] ?? [];
    group.push(event);
    eventsByDueDate[eventDate] = group;
  }

  for (const session of stableSort(state.negotiations ?? [], (item) => item.id)) {
    const playerGroup = negotiationsByPlayer[session.playerId] ?? [];
    playerGroup.push(session);
    negotiationsByPlayer[session.playerId] = playerGroup;
  }

  return {
    fixturesByDate,
    fixturesByClub,
    playersByClub,
    eventsByDueDate,
    negotiationsByPlayer,
  };
}

export function buildSimulationWorld(state: GameState): SimulationWorld {
  return new SimulationWorld(state, buildIndexes(state));
}

export function createSimulationWorld(state: GameState): SimulationWorld {
  return buildSimulationWorld(state);
}
