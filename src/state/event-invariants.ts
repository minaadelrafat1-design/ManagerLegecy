/**
 * Event Invariants & Metrics
 *
 * Ensures event log integrity and provides authoritative metrics derived from
 * explicit game-state-transition events, not from text parsing or inference.
 *
 * CRITICAL RULE: "Completed transfer" means actual player movement only.
 * Not: offers, rejections, descriptions containing "transfer" word.
 */

import type { GameState, EventLogEntry } from "./types";

function currentSeasonStart(state: GameState): string {
  const [year = "2020"] = String(state.time?.season ?? "2020/21").split("/");
  return `${year}-08-01`;
}

function isCurrentSeasonEvent(state: GameState, event: EventLogEntry): boolean {
  return event.date.slice(0, 10) >= currentSeasonStart(state);
}

// ---- Invariant Checkers (report anomalies) ----

export interface InvariantViolation {
  type: string;
  severity: "error" | "warning";
  description: string;
  eventId?: string;
  data?: Record<string, unknown>;
}

/**
 * Detect duplicate TRANSFER_COMPLETED events for same player/date.
 * A player should only complete one transfer per day.
 */
export function detectDuplicateTransferCompletions(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const completedTransfers = (state.events ?? []).filter(
    (event) => event.type === "TRANSFER_COMPLETED" && isCurrentSeasonEvent(state, event),
  );

  const seen = new Map<string, EventLogEntry>();
  for (const event of completedTransfers) {
    const playerId = event.meta?.["playerId"] as string | undefined;
    if (!playerId) continue;
    const key = `${playerId}:${event.date}`;
    if (seen.has(key)) {
      violations.push({
        type: "DUPLICATE_TRANSFER_COMPLETION",
        severity: "error",
        description: `Player ${playerId} has multiple TRANSFER_COMPLETED events on ${event.date}`,
        eventId: event.id,
        data: { playerId, date: event.date },
      });
    }
    seen.set(key, event);
  }
  return violations;
}

/**
 * Detect TRANSFER_COMPLETED events without actual player movement.
 * If event says player moved from A to B, verify player.clubId actually changed.
 */
export function detectTransferWithoutMovement(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const completedTransfers = (state.events ?? [])
    .filter((event) => event.type === "TRANSFER_COMPLETED" && isCurrentSeasonEvent(state, event))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const eventsByPlayer = new Map<string, EventLogEntry[]>();

  for (const event of completedTransfers) {
    const playerId = event.meta?.["playerId"] as string | undefined;
    if (!playerId) continue;
    const events = eventsByPlayer.get(playerId) ?? [];
    events.push(event);
    eventsByPlayer.set(playerId, events);
  }

  for (const [playerId, playerEvents] of eventsByPlayer) {
    const player = playerId ? state.players[playerId] : undefined;

    if (!player) {
      if (playerId && !player) {
        violations.push({
          type: "TRANSFER_COMPLETED_MISSING_PLAYER",
          severity: "error",
          description: `TRANSFER_COMPLETED event references non-existent player ${playerId}`,
          ...(playerEvents[0]?.id ? { eventId: playerEvents[0].id } : {}),
          data: { playerId },
        });
      }
      continue;
    }

    let expectedCurrentClub = player.clubId;
    for (const event of playerEvents) {
      const fromClubId = event.meta?.["fromClubId"] as string | undefined;
      const toClubId = event.meta?.["toClubId"] as string | undefined;
      if (!fromClubId || !toClubId || expectedCurrentClub !== toClubId) {
        violations.push({
          type: "TRANSFER_COMPLETED_WITHOUT_MOVEMENT",
          severity: "error",
          description: `TRANSFER_COMPLETED chain for ${playerId} expected ${toClubId ?? "unknown"}, found ${expectedCurrentClub ?? "unknown"}`,
          eventId: event.id,
          data: { playerId, expectedClubId: toClubId, actualClubId: expectedCurrentClub },
        });
      }
      expectedCurrentClub = fromClubId ?? expectedCurrentClub;
    }
  }
  return violations;
}

/**
 * Detect PROMOTION events from the current season without division change.
 * Note: Historical promotions may not match current state if club was later relegated.
 */
export function detectPromotionWithoutDivisionChange(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentSeason = state.time.season;
  // Only check current season promotions, as historical ones may have been undone by relegation
  const promotionEvents = (state.events ?? []).filter(
    (e) => e.type === "PROMOTION" && (e.meta?.["season"] ?? state.time.season) === currentSeason,
  );

  for (const event of promotionEvents) {
    const clubId = event.meta?.["clubId"] as string | undefined;
    const toDivision = event.meta?.["toDivision"] as string | undefined;
    const club = clubId ? state.clubs[clubId] : undefined;

    if (!clubId || !toDivision || !club) continue;
    if (club.leagueId !== toDivision) {
      violations.push({
        type: "PROMOTION_WITHOUT_DIVISION_CHANGE",
        severity: "error",
        description: `PROMOTION event in ${currentSeason} says ${clubId} moved to ${toDivision}, but club.leagueId is ${club.leagueId}`,
        eventId: event.id,
        data: { clubId, expectedDivision: toDivision, actualDivision: club.leagueId },
      });
    }
  }
  return violations;
}

/**
 * Detect RELEGATION events from the current season without division change.
 * Note: Historical relegations may not match current state if club was later promoted.
 */
export function detectRelegationWithoutDivisionChange(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const currentSeason = state.time.season;
  // Only check current season relegations, as historical ones may have been undone by promotion
  const relegationEvents = (state.events ?? []).filter(
    (e) => e.type === "RELEGATION" && (e.meta?.["season"] ?? state.time.season) === currentSeason,
  );

  for (const event of relegationEvents) {
    const clubId = event.meta?.["clubId"] as string | undefined;
    const toDivision = event.meta?.["toDivision"] as string | undefined;
    const club = clubId ? state.clubs[clubId] : undefined;

    if (!clubId || !toDivision || !club) continue;
    if (club.leagueId !== toDivision) {
      violations.push({
        type: "RELEGATION_WITHOUT_DIVISION_CHANGE",
        severity: "error",
        description: `RELEGATION event in ${currentSeason} says ${clubId} moved to ${toDivision}, but club.leagueId is ${club.leagueId}`,
        eventId: event.id,
        data: { clubId, expectedDivision: toDivision, actualDivision: club.leagueId },
      });
    }
  }
  return violations;
}

/**
 * Detect PLAYER_RETIRED events where player.status is not "retired".
 */
export function detectRetirementWithoutRetiredState(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const retirementEvents = (state.events ?? []).filter(
    (event) => event.type === "PLAYER_RETIRED" && isCurrentSeasonEvent(state, event),
  );

  for (const event of retirementEvents) {
    const playerId = event.meta?.["playerId"] as string | undefined;
    const player = playerId ? state.players[playerId] : undefined;

    if (!playerId || !player) continue;
    if (player.status !== "retired") {
      violations.push({
        type: "RETIREMENT_WITHOUT_RETIRED_STATE",
        severity: "error",
        description: `PLAYER_RETIRED event for ${playerId}, but player.status is ${player.status}`,
        eventId: event.id,
        data: { playerId, status: player.status },
      });
    }
  }
  return violations;
}

export function detectAgeDrift(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const [playerId, player] of Object.entries(state.players ?? {})) {
    if (!player.dateOfBirth || player.status === "retired") continue;

    const storedAge = player.age ?? 0;
    const currentDate = state.time?.date ?? "2020-01-01";
    const birthDate = new Date(`${player.dateOfBirth}T00:00:00Z`);
    const current = new Date(`${currentDate}T00:00:00Z`);
    let expectedAge = current.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = current.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && current.getUTCDate() < birthDate.getUTCDate())) {
      expectedAge -= 1;
    }

    // Allow ±1 year drift for DOB rounding/timing issues at season boundaries
    const drift = Math.abs(storedAge - expectedAge);
    if (drift > 1) {
      violations.push({
        type: "PLAYER_AGE_DRIFT",
        severity: "error",
        description: `Player ${playerId} age ${storedAge} differs from DOB-derived age ${Math.max(0, expectedAge)} by ${drift} years`,
        data: {
          playerId,
          storedAge: storedAge,
          derivedAge: Math.max(0, expectedAge),
          dateOfBirth: player.dateOfBirth,
        },
      });
    }
  }

  return violations;
}

export function detectRetiredPlayerInSquad(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const [clubId, club] of Object.entries(state.clubs ?? {})) {
    for (const playerId of club.playerIds ?? []) {
      const player = state.players[playerId];
      if (!player || player.status !== "retired") continue;
      violations.push({
        type: "RETIRED_PLAYER_IN_SQUAD",
        severity: "error",
        description: `Retired player ${playerId} still present in squad for club ${clubId}`,
        data: { clubId, playerId },
      });
    }
  }

  return violations;
}

export function detectDuplicateRetirementEvents(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const seen = new Map<string, string>();

  for (const event of state.events ?? []) {
    if (event.type !== "PLAYER_RETIRED" || !isCurrentSeasonEvent(state, event)) continue;
    const playerId = event.meta?.["playerId"] as string | undefined;
    if (!playerId) continue;
    if (seen.has(playerId)) {
      violations.push({
        type: "DUPLICATE_RETIREMENT_EVENT",
        severity: "error",
        description: `Duplicate PLAYER_RETIRED event for player ${playerId}`,
        eventId: event.id,
        data: { playerId, firstEventId: seen.get(playerId), duplicateEventId: event.id },
      });
      continue;
    }
    seen.set(playerId, event.id ?? "");
  }

  return violations;
}

export function detectInvalidYouthGeneration(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Extract season year from current season (e.g., "2026/27" -> 2026)
  const currentSeasonYear = Number(String(state.time.season).split("/")[0]);
  const eventCutoffDate = new Date(`${currentSeasonYear}-08-01`);

  // Only check YOUTH_GENERATED events from the current season (after August 1)
  // Historical youth players will have aged and no longer meet initial age criteria
  for (const event of state.events ?? []) {
    if (event.type !== "YOUTH_GENERATED") continue;

    const eventDate = new Date(event.date ?? "2020-01-01");
    if (eventDate < eventCutoffDate) continue; // Skip youth from previous seasons

    const playerId = event.meta?.["playerId"] as string | undefined;
    if (!playerId) {
      violations.push({
        type: "YOUTH_GENERATED_INVALID",
        severity: "error",
        description: "YOUTH_GENERATED event missing playerId",
        eventId: event.id,
      });
      continue;
    }

    const player = state.players[playerId];
    if (!player) {
      violations.push({
        type: "YOUTH_GENERATED_INVALID",
        severity: "error",
        description: `YOUTH_GENERATED references missing player ${playerId}`,
        eventId: event.id,
        data: { playerId },
      });
      continue;
    }

    // Check that the player has a DOB and was a valid youth age at generation
    const generatedAge = event.meta?.["age"] as number | undefined;
    if (
      !player.dateOfBirth ||
      generatedAge === undefined ||
      generatedAge < 15 ||
      generatedAge > 18
    ) {
      violations.push({
        type: "YOUTH_GENERATED_INVALID",
        severity: "error",
        description: `YOUTH_GENERATED player ${playerId} had invalid generation age: ${generatedAge ?? "unknown"} or missing DOB`,
        eventId: event.id,
        data: { playerId, generatedAge, hasDOB: !!player.dateOfBirth },
      });
    }
  }

  return violations;
}

/**
 * Detect YOUTH_GENERATED events where player doesn't exist or was corrupted.
 * Only checks current season events to allow historical youth to age naturally.
 */
export function detectYouthEventWithoutPlayerCreation(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Extract season year from current season (e.g., "2026/27" -> 2026)
  const currentSeasonYear = Number(String(state.time.season).split("/")[0]);
  const eventCutoffDate = new Date(`${currentSeasonYear}-08-01`);

  // Only check YOUTH_GENERATED events from the current season
  // Youth from previous seasons have aged and won't meet the initial age range
  const youthEvents = (state.events ?? []).filter((e) => {
    if (e.type !== "YOUTH_GENERATED") return false;
    const eventDate = new Date(e.date ?? "2020-01-01");
    return eventDate >= eventCutoffDate; // Only current season
  });

  for (const event of youthEvents) {
    const playerId = event.meta?.["playerId"] as string | undefined;
    const player = playerId ? state.players[playerId] : undefined;

    if (!playerId) {
      violations.push({
        type: "YOUTH_GENERATED_NO_PLAYER_ID",
        severity: "error",
        description: "YOUTH_GENERATED event missing playerId in meta",
        eventId: event.id,
      });
      continue;
    }

    if (!player) {
      violations.push({
        type: "YOUTH_GENERATED_WITHOUT_PLAYER",
        severity: "error",
        description: `YOUTH_GENERATED references non-existent player ${playerId}`,
        eventId: event.id,
        data: { playerId },
      });
      continue;
    }

    // Current season youth should still be 15-18
    if ((player.age ?? 99) < 15 || (player.age ?? 99) > 18) {
      violations.push({
        type: "YOUTH_GENERATED_WRONG_AGE",
        severity: "warning",
        description: `YOUTH_GENERATED for ${playerId}, but player is ${player.age} years old (expected 15-18)`,
        eventId: event.id,
        data: { playerId, age: player.age },
      });
    }
  }
  return violations;
}

/**
 * Detect MATCH_PLAYED events without valid result.
 */
export function detectMatchEventWithoutResult(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const matchEvents = (state.events ?? []).filter((e) => e.type === "MATCH_PLAYED");
  const matchRecordsByFixture = new Map<string, NonNullable<GameState["matches"]>>();
  for (const match of state.matches ?? []) {
    if (!match.fixtureId) continue;
    const records = matchRecordsByFixture.get(match.fixtureId) ?? [];
    records.push(match);
    matchRecordsByFixture.set(match.fixtureId, records);
  }

  for (const event of matchEvents) {
    const fixtureId = event.meta?.["fixtureId"] as string | undefined;
    const scoreHome = event.meta?.["scoreHome"] as number | undefined;
    const scoreAway = event.meta?.["scoreAway"] as number | undefined;
    const fixture = fixtureId ? state.fixtures.find((f) => f.id === fixtureId) : undefined;
    const matchRecord = (fixtureId ? matchRecordsByFixture.get(fixtureId) : undefined)?.find(
      (match) =>
        match.playedAt === event.date &&
        match.scoreHome === scoreHome &&
        match.scoreAway === scoreAway &&
        match.homeClubId === event.meta?.["homeClubId"] &&
        match.awayClubId === event.meta?.["awayClubId"],
    );

    if (!fixtureId) {
      violations.push({
        type: "MATCH_PLAYED_NO_FIXTURE_ID",
        severity: "error",
        description: "MATCH_PLAYED event missing fixtureId in meta",
        eventId: event.id,
      });
      continue;
    }

    if (!fixture) {
      // Completed fixtures are legitimately pruned after their MatchRecord
      // and MATCH_PLAYED evidence have been retained. Validate that durable
      // evidence before accepting the missing fixture.
      if (matchRecord) {
        if (
          matchRecord.scoreHome !== scoreHome ||
          matchRecord.scoreAway !== scoreAway ||
          matchRecord.homeClubId !== event.meta?.["homeClubId"] ||
          matchRecord.awayClubId !== event.meta?.["awayClubId"]
        ) {
          violations.push({
            type: "MATCH_PLAYED_HISTORICAL_RESULT_MISMATCH",
            severity: "error",
            description: `MATCH_PLAYED historical evidence does not match MatchRecord for fixture ${fixtureId}`,
            eventId: event.id,
            data: { fixtureId },
          });
        }
        continue;
      }
      if (fixtureId && (matchRecordsByFixture.get(fixtureId)?.length ?? 0) > 0) {
        violations.push({
          type: "MATCH_PLAYED_HISTORICAL_RESULT_MISMATCH",
          severity: "error",
          description: `MATCH_PLAYED evidence does not match any MatchRecord for fixture ${fixtureId}`,
          eventId: event.id,
          data: { fixtureId },
        });
        continue;
      }
      violations.push({
        type: "MATCH_PLAYED_MISSING_FIXTURE",
        severity: "error",
        description: `MATCH_PLAYED references non-existent fixture ${fixtureId}`,
        eventId: event.id,
        data: { fixtureId },
      });
      continue;
    }

    if (fixture.status !== "played") {
      violations.push({
        type: "MATCH_PLAYED_FIXTURE_NOT_PLAYED",
        severity: "error",
        description: `MATCH_PLAYED event for fixture ${fixtureId}, but fixture.status is ${fixture.status}`,
        eventId: event.id,
        data: { fixtureId, status: fixture.status },
      });
      continue;
    }

    if (
      scoreHome === undefined ||
      scoreAway === undefined ||
      fixture.scoreHome !== scoreHome ||
      fixture.scoreAway !== scoreAway
    ) {
      violations.push({
        type: "MATCH_PLAYED_SCORE_MISMATCH",
        severity: "error",
        description: `MATCH_PLAYED score (${scoreHome}-${scoreAway}) doesn't match fixture (${fixture.scoreHome}-${fixture.scoreAway})`,
        eventId: event.id,
        data: {
          fixtureId,
          eventScore: `${scoreHome}-${scoreAway}`,
          fixtureScore: `${fixture.scoreHome}-${fixture.scoreAway}`,
        },
      });
    }
  }
  return violations;
}

/**
 * Validate the durable match record against whatever fixture/event evidence
 * remains after fixture pruning. A retained played fixture must still have a
 * MatchRecord; a pruned fixture is valid only when its MatchRecord and
 * MATCH_PLAYED event agree.
 */
export function detectMatchRecordIntegrity(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const fixturesById = new Map((state.fixtures ?? []).map((fixture) => [fixture.id, fixture]));
  const eventsByFixture = new Map<string, EventLogEntry[]>();
  for (const event of state.events ?? []) {
    const fixtureId = event.meta?.["fixtureId"];
    if (event.type !== "MATCH_PLAYED" || !fixtureId) continue;
    const events = eventsByFixture.get(String(fixtureId)) ?? [];
    events.push(event);
    eventsByFixture.set(String(fixtureId), events);
  }
  const matchesByFixture = new Map<string, NonNullable<GameState["matches"]>>();
  for (const match of state.matches ?? []) {
    if (!match.fixtureId) continue;
    const matches = matchesByFixture.get(String(match.fixtureId)) ?? [];
    matches.push(match);
    matchesByFixture.set(String(match.fixtureId), matches);
  }

  for (const fixture of state.fixtures ?? []) {
    if (fixture.status !== "played") continue;
    const match = matchesByFixture.get(fixture.id)?.find(
      (candidate) =>
        candidate.playedAt === fixture.calendarDate &&
        candidate.homeClubId === fixture.homeClubId &&
        candidate.awayClubId === fixture.awayClubId &&
        candidate.scoreHome === fixture.scoreHome &&
        candidate.scoreAway === fixture.scoreAway,
    );
    if (!match) {
      violations.push({
        type: "PLAYED_FIXTURE_MISSING_MATCH_RECORD",
        severity: "error",
        description: `Played fixture ${fixture.id} has no MatchRecord`,
        data: { fixtureId: fixture.id },
      });
    }
  }

  for (const match of state.matches ?? []) {
    if (!match.fixtureId) {
      violations.push({
        type: "MATCH_RECORD_MISSING_FIXTURE_ID",
        severity: "error",
        description: `MatchRecord ${match.id} has no fixtureId`,
        data: { matchId: match.id },
      });
      continue;
    }

    const retainedFixture = fixturesById.get(match.fixtureId);
    const fixture =
      retainedFixture &&
      retainedFixture.calendarDate === match.playedAt &&
      retainedFixture.homeClubId === match.homeClubId &&
      retainedFixture.awayClubId === match.awayClubId &&
      retainedFixture.scoreHome === match.scoreHome &&
      retainedFixture.scoreAway === match.scoreAway
        ? retainedFixture
        : undefined;
    const eventCandidates = eventsByFixture.get(String(match.fixtureId)) ?? [];
    const event = eventCandidates.find(
      (candidate) =>
        candidate.date === match.playedAt &&
        candidate.meta?.["homeClubId"] === match.homeClubId &&
        candidate.meta?.["awayClubId"] === match.awayClubId &&
        candidate.meta?.["scoreHome"] === match.scoreHome &&
        candidate.meta?.["scoreAway"] === match.scoreAway,
    );
    if (!fixture && !event) {
      if (eventCandidates.length > 0) {
        violations.push({
          type: "MATCH_RECORD_RESULT_MISMATCH",
          severity: "error",
          description: `MatchRecord ${match.id} does not match any MATCH_PLAYED event evidence`,
          data: { matchId: match.id, fixtureId: match.fixtureId },
        });
        continue;
      }
      violations.push({
        type: "MATCH_RECORD_MISSING_HISTORICAL_EVIDENCE",
        severity: "error",
        description: `MatchRecord ${match.id} has neither a retained fixture nor MATCH_PLAYED evidence`,
        data: { matchId: match.id, fixtureId: match.fixtureId },
      });
      continue;
    }

    const expectedHomeClubId = fixture?.homeClubId ?? event?.meta?.["homeClubId"];
    const expectedAwayClubId = fixture?.awayClubId ?? event?.meta?.["awayClubId"];
    const expectedScoreHome = fixture?.scoreHome ?? event?.meta?.["scoreHome"];
    const expectedScoreAway = fixture?.scoreAway ?? event?.meta?.["scoreAway"];
    if (
      match.homeClubId !== expectedHomeClubId ||
      match.awayClubId !== expectedAwayClubId ||
      match.scoreHome !== expectedScoreHome ||
      match.scoreAway !== expectedScoreAway
    ) {
      violations.push({
        type: "MATCH_RECORD_RESULT_MISMATCH",
        severity: "error",
        description: `MatchRecord ${match.id} does not match fixture/event evidence`,
        data: { matchId: match.id, fixtureId: match.fixtureId },
      });
    }
  }

  return violations;
}

// ---- Authoritative Metrics (count only valid events) ----

/**
 * Count completed transfers from authoritative TRANSFER_COMPLETED events.
 * NOT: transfer offers, rejections, or text descriptions containing "transfer".
 */
/**
 * Count completed transfers (successful moves).
 * Also counts negotiation activity as transfer attempts.
 */
export function countCompletedTransfers(state: GameState): number {
  return (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED").length;
}

/**
 * Count promotions from authoritative PROMOTION events.
 * NOT: text regex parsing on event descriptions.
 */
export function countPromotions(state: GameState): number {
  return (state.events ?? []).filter((e) => e.type === "PROMOTION").length;
}

/**
 * Count relegations from authoritative RELEGATION events.
 * NOT: text regex parsing on event descriptions.
 */
export function countRelegations(state: GameState): number {
  return (state.events ?? []).filter((e) => e.type === "RELEGATION").length;
}

/**
 * Count player retirements from authoritative PLAYER_RETIRED events.
 * (backup: count players with status === "retired")
 */
export function countRetirements(state: GameState): number {
  const fromEvents = (state.events ?? []).filter((e) => e.type === "PLAYER_RETIRED").length;
  const fromState = Object.values(state.players ?? {}).filter((p) => p.status === "retired").length;
  // Return the higher count (events are authoritative but may lag player state)
  return Math.max(fromEvents, fromState);
}

/**
 * Count youth generated from authoritative YOUTH_GENERATED events.
 * Backup: count players generated in academy (not in initial set and age <= 21)
 */
export function countYouthGenerated(state: GameState, initialPlayerIds?: Set<string>): number {
  const fromEvents = (state.events ?? []).filter((e) => e.type === "YOUTH_GENERATED").length;
  // Backup: count players not in initial set and age <= 21 (academy graduates)
  if (fromEvents > 0) return fromEvents;
  if (!initialPlayerIds || initialPlayerIds.size === 0) return 0;
  const generated = Object.values(state.players ?? {}).filter(
    (p) => !initialPlayerIds.has(p.id) && (p.age ?? 99) <= 21,
  ).length;
  return Math.max(fromEvents, generated);
}

/**
 * Count manager changes from events (board decisions or club churn events).
 * The simulation creates these as either explicit "manager" events or as
 * milestone/board entries with manager semantics; counting only one type
 * under-reports real churn.
 */
export function countManagerChanges(state: GameState): number {
  return (state.events ?? []).filter((e) => {
    if (e.type === "manager") return true;
    if (e.type === "milestone" || e.type === "board") {
      const text = `${e.description ?? ""} ${e.meta?.["action"] ?? ""}`.toLowerCase();
      return (
        text.includes("manager") &&
        (text.includes("sacked") || text.includes("appointed") || text.includes("change"))
      );
    }
    return false;
  }).length;
}

/**
 * Count matches played from authoritative MATCH_PLAYED events.
 * (backup: count fixtures with status === "played")
 */
export function countMatchesPlayed(state: GameState): number {
  const fromEvents = (state.events ?? []).filter((e) => e.type === "MATCH_PLAYED").length;
  const fromFixtures = (state.fixtures ?? []).filter((f) => f.status === "played").length;
  // Return from fixtures (more direct); events may lag
  return fromFixtures;
}

/**
 * Count competition winners from authoritative COMPETITION_WINNER events.
 */
export function countCompetitionWinners(state: GameState): number {
  return (state.events ?? []).filter((e) => e.type === "COMPETITION_WINNER").length;
}

/**
 * Detect player duplication: same player ID in multiple clubs' squads.
 */
export function detectPlayerDuplication(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const playerToClubs: Record<string, string[]> = {};

  for (const [clubId, club] of Object.entries(state.clubs ?? {})) {
    for (const playerId of club.playerIds ?? []) {
      if (!playerToClubs[playerId]) playerToClubs[playerId] = [];
      playerToClubs[playerId].push(clubId);
    }
  }

  for (const [playerId, clubIds] of Object.entries(playerToClubs)) {
    if (clubIds.length > 1) {
      violations.push({
        type: "PLAYER_DUPLICATION",
        severity: "error",
        description: `Player ${playerId} appears in ${clubIds.length} clubs: ${clubIds.join(", ")}`,
        data: { playerId, clubIds },
      });
    }
  }

  return violations;
}

/**
 * Detect invalid player ages.
 */
export function detectInvalidAges(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const [playerId, player] of Object.entries(state.players ?? {})) {
    const age = player.age ?? 0;
    if (age < 0 || age > 120) {
      violations.push({
        type: "INVALID_AGE",
        severity: "error",
        description: `Player ${playerId} has invalid age: ${age}`,
        data: { playerId, age },
      });
    }
  }

  return violations;
}

/**
 * Detect squad consistency: all playerIds in clubs should exist in players.
 */
export function detectSquadConsistency(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const [clubId, club] of Object.entries(state.clubs ?? {})) {
    for (const playerId of club.playerIds ?? []) {
      if (!state.players[playerId]) {
        violations.push({
          type: "SQUAD_MISSING_PLAYER",
          severity: "error",
          description: `Club ${clubId} has playerID ${playerId} in squad, but player doesn't exist`,
          data: { clubId, playerId },
        });
      }
    }
  }

  return violations;
}

/**
 * Detect negative club balances (should be prevented by finance rules).
 */
export function detectNegativeBalances(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Only check the user's club, as AI clubs don't have detailed finances stored
  if (state.currentClub && state.finances) {
    const finance = { balance: state.finances.balance };
    const balanceNum =
      typeof finance.balance === "string" ? Number.parseFloat(finance.balance) : finance.balance;
    if (balanceNum < -5_000_000) {
      // Allow small negative due to accounting; flag major deficits
      violations.push({
        type: "NEGATIVE_BALANCE",
        severity: "warning",
        description: `Club has dangerously negative balance: €${balanceNum}`,
        data: { clubId: state.currentClub.id, balance: finance.balance },
      });
    }
  }

  return violations;
}

/**
 * Run all invariant checks and return violations.
 */
export function checkAllInvariants(state: GameState): InvariantViolation[] {
  return [
    ...detectDuplicateTransferCompletions(state),
    ...detectTransferWithoutMovement(state),
    ...detectPromotionWithoutDivisionChange(state),
    ...detectRelegationWithoutDivisionChange(state),
    ...detectRetirementWithoutRetiredState(state),
    ...detectAgeDrift(state),
    ...detectRetiredPlayerInSquad(state),
    ...detectDuplicateRetirementEvents(state),
    ...detectInvalidYouthGeneration(state),
    ...detectYouthEventWithoutPlayerCreation(state),
    ...detectMatchEventWithoutResult(state),
    ...detectMatchRecordIntegrity(state),
    ...detectPlayerDuplication(state),
    ...detectInvalidAges(state),
    ...detectSquadConsistency(state),
    ...detectNegativeBalances(state),
  ];
}

export default {
  detectDuplicateTransferCompletions,
  detectTransferWithoutMovement,
  detectPromotionWithoutDivisionChange,
  detectRelegationWithoutDivisionChange,
  detectRetirementWithoutRetiredState,
  detectAgeDrift,
  detectRetiredPlayerInSquad,
  detectDuplicateRetirementEvents,
  detectInvalidYouthGeneration,
  detectYouthEventWithoutPlayerCreation,
  detectMatchEventWithoutResult,
  detectMatchRecordIntegrity,
  detectPlayerDuplication,
  detectInvalidAges,
  detectSquadConsistency,
  detectNegativeBalances,
  checkAllInvariants,
  countCompletedTransfers,
  countPromotions,
  countRelegations,
  countRetirements,
  countYouthGenerated,
  countManagerChanges,
  countMatchesPlayed,
};
