import type { Club, Fixture, GameState, WorldCompetitionConfig } from "./types";
import { computeStandings } from "./standings";
import { seededUnit } from "./utils";
import { addDaysISO, getDayOfWeekLabel } from "./calendar";

/** Helper to calculate calendar date for European fixtures.
 * European fixtures are spread throughout the season. */
function calculateEuropeanFixtureDate(state: GameState, fixtureIndex: number): string {
  const preseasonDays = 14;
  // Spread European fixtures starting from matchday 5 onwards
  const europeanMatchday = 5 + Math.floor(fixtureIndex / 8);
  const calendarDate = addDaysISO(
    state.time.seasonStartDate,
    preseasonDays + (europeanMatchday - 1) * 7,
  );
  return calendarDate;
}

/** Helper to format display date from ISO calendar date */
function formatDisplayDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  const weekday = getDayOfWeekLabel(dateISO);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${weekday} ${day} ${month}`;
}

function getCompetitionParticipants(
  state: GameState,
  competition: WorldCompetitionConfig,
): string[] {
  const currentSeason = String(state.time.season);
  const registered =
    state.meta?.europeanQualifications
      ?.filter(
        (entry) => entry.season === currentSeason && entry.competitionId === competition.id,
      )
      .map((entry) => entry.clubId) ?? [];

  if (registered.length > 0) {
    return Array.from(new Set(registered));
  }

  if (!competition.divisionIds || competition.divisionIds.length === 0) {
    return Object.keys(state.clubs);
  }

  return Object.values(state.clubs)
    .filter((club) => club.leagueId && competition.divisionIds?.includes(club.leagueId))
    .map((club) => club.id);
}

function getGroupFixtures(
  state: GameState,
  competition: WorldCompetitionConfig,
  groupId: string,
  teams: string[],
  homeAndAway: boolean,
  nextFixtureIndex: number,
): { fixtures: Fixture[]; nextFixtureIndex: number } {
  const fixtures: Fixture[] = [];
  const ordered = teams.slice();

  for (let i = 0; i < ordered.length; i++) {
    const home = ordered[i]!;
    for (let j = i + 1; j < ordered.length; j++) {
      const away = ordered[j]!;
      const calendarDate1 = calculateEuropeanFixtureDate(state, nextFixtureIndex);
      fixtures.push({
        id: `eu-${String(state.time.season)}-${competition.id}-${groupId}-m${nextFixtureIndex}`,
        competitionId: competition.id,
        season: String(state.time.season),
        homeClubId: home,
        awayClubId: away,
        calendarDate: calendarDate1,
        date: formatDisplayDate(calendarDate1),
        matchday: fixtures.length + 1,
        venue: "H",
        status: "scheduled",
        result: null,
        groupId,
      });
      nextFixtureIndex += 1;

      if (homeAndAway) {
        const calendarDate2 = calculateEuropeanFixtureDate(state, nextFixtureIndex);
        fixtures.push({
          id: `eu-${String(state.time.season)}-${competition.id}-${groupId}-m${nextFixtureIndex}`,
          competitionId: competition.id,
          season: String(state.time.season),
          homeClubId: away,
          awayClubId: home,
          calendarDate: calendarDate2,
          date: formatDisplayDate(calendarDate2),
          matchday: fixtures.length + 1,
          venue: "H",
          status: "scheduled",
          result: null,
          groupId,
        });
        nextFixtureIndex += 1;
      }
    }
  }

  return { fixtures, nextFixtureIndex };
}

function buildGroupStandings(
  state: GameState,
  competition: WorldCompetitionConfig,
  groupId: string,
  teams: string[],
) {
  const groupFixtures = state.fixtures.filter(
    (fixture) => fixture.competitionId === competition.id && fixture.groupId === groupId,
  );
  const clubs = teams
    .map((clubId) => state.clubs[clubId])
    .filter((club): club is Club => Boolean(club));
  return computeStandings(
    clubs,
    groupFixtures,
    competition.id,
    competition.format?.groupStage?.standingsRules,
  );
}

function scheduleKnockoutFixtures(
  state: GameState,
  competition: WorldCompetitionConfig,
  teams: string[],
  round: string,
  twoLegged: boolean,
  nextFixtureIndex: number,
) {
  const fixtures: Fixture[] = [];
  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];
    if (!home || !away) break;

    const calendarDate1 = calculateEuropeanFixtureDate(state, nextFixtureIndex);
    fixtures.push({
      id: `eu-${String(state.time.season)}-${competition.id}-${round}-leg1-${nextFixtureIndex}`,
      competitionId: competition.id,
      season: String(state.time.season),
      homeClubId: home,
      awayClubId: away,
      calendarDate: calendarDate1,
      date: formatDisplayDate(calendarDate1),
      matchday: nextFixtureIndex,
      venue: "H",
      status: "scheduled",
      result: null,
      round,
      leg: 1,
    });
    nextFixtureIndex += 1;

    if (twoLegged) {
      const calendarDate2 = calculateEuropeanFixtureDate(state, nextFixtureIndex);
      fixtures.push({
        id: `eu-${String(state.time.season)}-${competition.id}-${round}-leg2-${nextFixtureIndex}`,
        competitionId: competition.id,
        season: String(state.time.season),
        homeClubId: away,
        awayClubId: home,
        calendarDate: calendarDate2,
        date: formatDisplayDate(calendarDate2),
        matchday: nextFixtureIndex,
        venue: "H",
        status: "scheduled",
        result: null,
        round,
        leg: 2,
      });
      nextFixtureIndex += 1;
    }
  }
  return { fixtures, nextFixtureIndex };
}

function getClubCountryId(state: GameState, clubId: string): string | null {
  const club = state.clubs[clubId];
  if (!club || !state.meta?.worldConfig) return null;
  for (const country of state.meta.worldConfig.countries) {
    for (const division of country.divisions) {
      if (division.id === club.leagueId) return country.id;
    }
  }
  return null;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  return items.slice().sort((a, b) => {
    const aSeed = seededUnit(`${seed}:${JSON.stringify(a)}`);
    const bSeed = seededUnit(`${seed}:${JSON.stringify(b)}`);
    return aSeed - bSeed;
  });
}

function drawGroups(
  teams: string[],
  numGroups: number,
  state: GameState,
  config: WorldCompetitionConfig,
): string[][] {
  if (numGroups <= 0) return [];
  const groupStage = config.format?.groupStage;
  const groups: string[][] = Array.from({ length: numGroups }, () => []);

  // If pots configured, place them into groups by pot order (one per group)
  const pots = groupStage?.pots ?? [];
  if (pots.length > 0) {
    for (const [potIndex, pot] of pots.entries()) {
      if (pot.length !== numGroups) {
        // invalid pot config: fallback to seeded flat draw
        break;
      }
      const seededPot = seededShuffle(pot, `${config.id}:pot-${potIndex}`);
      for (let i = 0; i < seededPot.length; i++) {
        groups[i]!.push(seededPot[i]!);
      }
    }
    return groups;
  }

  const ordered =
    groupStage?.drawSeed === "random"
      ? seededShuffle(teams, `${config.id}:group-draw`)
      : teams
          .slice()
          .sort(
            (a, b) =>
              seededUnit(`${config.id}:seeded-group:${a}`) -
              seededUnit(`${config.id}:seeded-group:${b}`),
          );

  if (groupStage?.countryRestrictions) {
    const countrySets = groups.map(() => new Set<string>());
    for (const team of ordered) {
      const country = getClubCountryId(state, team);
      let placed = false;
      for (let g = 0; g < groups.length; g++) {
        if (groups[g]!.length >= (groupStage.teamsPerGroup ?? 0)) continue;
        if (!country || !countrySets[g]!.has(country)) {
          groups[g]!.push(team);
          if (country) countrySets[g]!.add(country);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // place in first group with space
        const idx = groups.findIndex((gr) => gr.length < (groupStage.teamsPerGroup ?? 0));
        if (idx >= 0) groups[idx]!.push(team);
      }
    }
    return groups;
  }

  ordered.forEach((team, index) => {
    const groupIndex = index % numGroups;
    groups[groupIndex]!.push(team);
  });
  return groups;
}

function pickKnockoutTeamsFromGroups(
  state: GameState,
  competition: WorldCompetitionConfig,
  groups: string[][],
  advancePerGroup: number,
) {
  const qualified: string[] = [];
  for (const [index, teams] of groups.entries()) {
    const groupId = `Group ${String.fromCharCode(65 + index)}`;
    const table = buildGroupStandings(state, competition, groupId, teams);
    for (let j = 0; j < Math.min(advancePerGroup, table.length); j++) {
      const row = table[j];
      if (row) {
        qualified.push(row.clubId);
      }
    }
  }
  return qualified;
}

/**
 * PHASE AAA-REPAIR-3: Validate European competition format is mathematically sound.
 * Returns error message if invalid, empty string if valid.
 */
function validateCompetitionFormat(competition: WorldCompetitionConfig): string {
  const format = competition.format;
  if (!format) return ""; // No format, can't validate

  const groupStage = format.groupStage;
  const knockoutStage = format.knockoutStage;

  if (!groupStage && !knockoutStage) {
    return "Competition has no group stage or knockout stage";
  }

  if (groupStage && knockoutStage) {
    // Validate group stage → knockout transition
    const groupsTotal = groupStage.numGroups ?? 1;
    const teamsPerGroup = groupStage.teamsPerGroup ?? 1;
    const advancePerGroup = groupStage.advancePerGroup ?? 1;
    const qualifiedFromGroups = groupsTotal * advancePerGroup;

    // First knockout round must accept exactly the qualified teams
    const firstRound = knockoutStage.rounds?.[0];
    if (firstRound && (firstRound.teams ?? 0) > 0) {
      if (qualifiedFromGroups !== (firstRound.teams ?? 0)) {
        return `Invalid bracket: group stage qualifies ${qualifiedFromGroups} teams but first knockout round needs ${firstRound.teams} teams`;
      }
    }

    // Validate each knockout round progression
    // N teams in a round produce N/2 winners (each team pair plays 1 match regardless of legs)
    if (knockoutStage.rounds && knockoutStage.rounds.length > 1) {
      for (let i = 0; i < knockoutStage.rounds.length - 1; i++) {
        const thisRound = knockoutStage.rounds[i];
        const nextRound = knockoutStage.rounds[i + 1];
        if (!thisRound || !nextRound) continue;
        const thisRoundTeams = thisRound.teams ?? 0;
        const nextRoundTeams = nextRound.teams ?? 0;

        // N teams → N/2 winners
        const expectedWinners = thisRoundTeams / 2;
        if (expectedWinners !== nextRoundTeams) {
          return `Invalid bracket: ${thisRound.name} (${thisRoundTeams} teams) produces ${expectedWinners} winners but ${nextRound.name} needs ${nextRoundTeams} teams`;
        }
      }
    }
  }

  return ""; // Valid
}

/**
 * PHASE AAA-REPAIR-3: Get knockout teams from previous round winners.
 * Dynamically builds next round bracket from actual previous round results.
 */
function getKnockoutRoundWinners(
  state: GameState,
  competition: WorldCompetitionConfig,
  roundId: string,
): string[] {
  const roundFixtures = state.fixtures.filter(
    (f) => f.competitionId === competition.id && f.round === roundId && f.status === "played",
  );

  const winners: string[] = [];
  const processedPairs = new Set<string>();

  for (const fixture of roundFixtures) {
    // For two-legged ties, only count once
    const pairKey = [fixture.homeClubId, fixture.awayClubId].sort().join("|");
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    if (fixture.scoreHome === null || fixture.scoreAway === null) continue;

    // Single-leg: simple winner
    if (!fixture.leg || fixture.leg === 1) {
      const nextLegFixture = roundFixtures.find(
        (f) =>
          f.leg === 2 && f.homeClubId === fixture.awayClubId && f.awayClubId === fixture.homeClubId,
      );

      if (!nextLegFixture) {
        // Single-leg match
        if ((fixture.scoreHome ?? 0) > (fixture.scoreAway ?? 0)) {
          winners.push(fixture.homeClubId);
        } else if ((fixture.scoreAway ?? 0) > (fixture.scoreHome ?? 0)) {
          winners.push(fixture.awayClubId);
        }
        // Draw in single-leg is unresolved
      } else if (nextLegFixture.scoreHome !== undefined && nextLegFixture.scoreAway !== undefined) {
        // Two-leg aggregate
        const aggregateHome = (fixture.scoreHome ?? 0) + (nextLegFixture.scoreAway ?? 0);
        const aggregateAway = (fixture.scoreAway ?? 0) + (nextLegFixture.scoreHome ?? 0);
        if (aggregateHome > aggregateAway) {
          winners.push(fixture.homeClubId);
        } else if (aggregateAway > aggregateHome) {
          winners.push(fixture.awayClubId);
        } else if (
          (nextLegFixture.penaltyHome ?? 0) !== 0 &&
          (nextLegFixture.penaltyAway ?? 0) !== 0
        ) {
          // Penalties in second leg
          winners.push(
            (nextLegFixture.penaltyHome ?? 0) > (nextLegFixture.penaltyAway ?? 0)
              ? fixture.homeClubId
              : fixture.awayClubId,
          );
        }
        // Otherwise aggregate is tied and unresolved
      }
    }
  }

  return winners;
}

/**
 * Determine the champion of a European competition from actual knockout results.
 * PHASE AAA-REPAIR-3: Explicitly finds the configured FINAL round and verifies it's complete.
 * Returns the winner of the final match, or null if:
 * - No final is configured in the competition format
 * - The final has not been played
 * - The final is incomplete (semifinal winners not yet determined)
 */
export function getEuropeanChampion(state: GameState, competitionId: string): string | null {
  const competition = state.meta?.worldConfig?.competitions.find((c) => c.id === competitionId);
  if (!competition || competition.type !== "continental") return null;

  // Explicit requirement: competition MUST have a knockout stage with a final round configured
  if (!competition.format?.knockoutStage?.rounds) return null;

  // Find the FINAL round from configuration (not just last round with results)
  const finalRound = competition.format.knockoutStage.rounds.find(
    (r) =>
      (r as any).isFinal ||
      r.id?.toLowerCase() === "final" ||
      r.name?.toLowerCase() === "final",
  );

  if (!finalRound) return null;

  // Get fixtures for the configured final round ONLY
  const finalFixtures = state.fixtures.filter(
    (f) => f.competitionId === competitionId && f.round === finalRound.id,
  );

  if (finalFixtures.length === 0) return null;

  // Find all PLAYED final fixtures
  const playedFinalFixtures = finalFixtures.filter((f) => f.status === "played");
  if (playedFinalFixtures.length === 0) return null;

  // Verify: final must have exactly the right number of fixtures for its format
  const expectedFixtures = (finalRound as any).twoLegged ? 2 : 1;
  if (playedFinalFixtures.length < expectedFixtures) return null; // Incomplete final

  // For single-leg finals, the winner is clear
  if (playedFinalFixtures.length === 1) {
    const final = playedFinalFixtures[0]!;
    if (final.scoreHome != null && final.scoreAway != null) {
      return final.scoreHome > final.scoreAway ? final.homeClubId : final.awayClubId;
    }
    return null;
  }

  // For two-legged finals, aggregate the scores
  if (playedFinalFixtures.length === 2) {
    const first = playedFinalFixtures.find((f) => f.leg === 1) ?? playedFinalFixtures[0]!;
    const second = playedFinalFixtures.find((f) => f.leg === 2) ?? playedFinalFixtures[1]!;

    if (
      !first ||
      !second ||
      first.scoreHome == null ||
      first.scoreAway == null ||
      second.scoreHome == null ||
      second.scoreAway == null
    ) {
      return null;
    }

    const teamA = first.homeClubId;
    const teamB = first.awayClubId;
    const aggregateA = first.scoreHome + second.scoreAway;
    const aggregateB = first.scoreAway + second.scoreHome;

    if (aggregateA > aggregateB) return teamA;
    if (aggregateB > aggregateA) return teamB;

    // Aggregate is tied, check for penalties in second leg
    if (second.penaltyHome != null && second.penaltyAway != null) {
      return second.penaltyHome > second.penaltyAway ? teamA : teamB;
    }

    return null;
  }

  return null;
}

export function runEuropeanCompetitions(state: GameState): GameState {
  const worldConfig = state.meta?.worldConfig;
  if (!worldConfig) return state;

  let nextState = { ...state } as GameState;
  let nextFixtureIndex =
    state.fixtures.reduce((max, f) => {
      const match = /^f-(\d+)$/.exec(f.id);
      if (!match) return max;
      return Math.max(max, Number(match[1]));
    }, 0) + 1;

  for (const competition of worldConfig.competitions.filter((c) => c.type === "continental")) {
    const format = competition.format;
    if (!format) continue;

    // PHASE AAA-REPAIR-3: Validate format before using
    const validationError = validateCompetitionFormat(competition);
    if (validationError) {
      console.warn(`[EUROPEAN] Invalid format for ${competition.name}: ${validationError}`);
      continue;
    }

    const existingCompetitionFixtures = nextState.fixtures.filter(
      (f) => f.competitionId === competition.id,
    );
    const hasGroupStageFixtures = existingCompetitionFixtures.some((f) => f.groupId != null);
    const hasKnockoutFixtures = existingCompetitionFixtures.some((f) => f.round != null);
    const participants = getCompetitionParticipants(nextState, competition);

    if (participants.length === 0) continue;

    // Schedule group stage if not yet scheduled
    if (format.groupStage && !hasGroupStageFixtures) {
      if (participants.length !== format.groupStage.numGroups * format.groupStage.teamsPerGroup)
        continue;
      const groups = drawGroups(participants, format.groupStage.numGroups, nextState, competition);
      for (const [i, group] of groups.entries()) {
        const groupId = `Group ${String.fromCharCode(65 + i)}`;
        const { fixtures, nextFixtureIndex: nextIndex } = getGroupFixtures(
          nextState,
          competition,
          groupId,
          group,
          format.groupStage.homeAndAway,
          nextFixtureIndex,
        );
        nextFixtureIndex = nextIndex;
        nextState = { ...nextState, fixtures: [...(nextState.fixtures ?? []), ...fixtures] };
      }
    }

    // PHASE AAA-REPAIR-3: Dynamically generate knockout rounds
    if (format.knockoutStage && !hasKnockoutFixtures) {
      // Wait for group stage to complete if it exists
      if (format.groupStage) {
        const groupFixtures = nextState.fixtures.filter(
          (f) => f.competitionId === competition.id && f.groupId != null,
        );
        if (
          groupFixtures.length === 0 ||
          !groupFixtures.every((fixture) => fixture.status === "played")
        ) {
          continue; // Wait for group stage to finish
        }
      }

      // Get qualified teams for the first knockout round
      const groups = format.groupStage
        ? drawGroups(participants, format.groupStage.numGroups, nextState, competition)
        : [];
      const qualified = format.groupStage
        ? pickKnockoutTeamsFromGroups(
            nextState,
            competition,
            groups,
            format.groupStage.advancePerGroup,
          )
        : participants;

      if (qualified.length > 0) {
        // Schedule ONLY the first knockout round
        const firstRound = format.knockoutStage.rounds?.[0];
        if (firstRound && (firstRound.teams ?? 0) > 0) {
          let teams = qualified.slice(0, firstRound.teams);
          // apply draw seeding if requested on the round
          if ((firstRound as any).drawSeed === "random") {
            teams = seededShuffle(teams, `${competition.id}:${firstRound.id}:draw`);
          } else if ((firstRound as any).drawSeed === "seeded") {
            teams = teams
              .slice()
              .sort(
                (a, b) =>
                  seededUnit(`${competition.id}:seeded:${a}`) -
                  seededUnit(`${competition.id}:seeded:${b}`),
              );
          }
          const { fixtures, nextFixtureIndex: nextIndex } = scheduleKnockoutFixtures(
            nextState,
            competition,
            teams,
            firstRound.id,
            firstRound.twoLegged ?? false,
            nextFixtureIndex,
          );
          nextFixtureIndex = nextIndex;
          nextState = { ...nextState, fixtures: [...(nextState.fixtures ?? []), ...fixtures] };
        }
      }
    } else if (
      format.knockoutStage &&
      hasKnockoutFixtures &&
      format.knockoutStage.rounds &&
      format.knockoutStage.rounds.length > 1
    ) {
      // PHASE AAA-REPAIR-3: Generate next knockout round from previous round winners
      for (let roundIndex = 0; roundIndex < format.knockoutStage.rounds.length - 1; roundIndex++) {
        const thisRound = format.knockoutStage.rounds[roundIndex];
        const nextRound = format.knockoutStage.rounds[roundIndex + 1];
        if (!thisRound || !nextRound) continue;

        // Check if this round is complete
        const thisRoundFixtures = nextState.fixtures.filter(
          (f) => f.competitionId === competition.id && f.round === thisRound.id,
        );

        if (
          thisRoundFixtures.length === 0 ||
          !thisRoundFixtures.every((f) => f.status === "played")
        ) {
          break; // This round not complete, don't schedule next
        }

        // Check if next round already scheduled
        const nextRoundFixtures = nextState.fixtures.filter(
          (f) => f.competitionId === competition.id && f.round === nextRound.id,
        );

        if (nextRoundFixtures.length === 0) {
          // Get winners from this round
          const winners = getKnockoutRoundWinners(nextState, competition, thisRound.id);

          if (winners.length > 0 && (nextRound.teams ?? 0) > 0) {
            let teams = winners.slice(0, nextRound.teams);
            // apply draw seeding if requested on the round
            if ((nextRound as any).drawSeed === "random") {
              teams = seededShuffle(teams, `${competition.id}:${nextRound.id}:draw`);
            } else if ((nextRound as any).drawSeed === "seeded") {
              teams = teams
                .slice()
                .sort(
                  (a, b) =>
                    seededUnit(`${competition.id}:seeded:${a}`) -
                    seededUnit(`${competition.id}:seeded:${b}`),
                );
            }
            const { fixtures, nextFixtureIndex: nextIndex } = scheduleKnockoutFixtures(
              nextState,
              competition,
              teams,
              nextRound.id,
              nextRound.twoLegged ?? false,
              nextFixtureIndex,
            );
            nextFixtureIndex = nextIndex;
            nextState = { ...nextState, fixtures: [...(nextState.fixtures ?? []), ...fixtures] };
          }
        }
      }
    }
  }

  return nextState;
}
