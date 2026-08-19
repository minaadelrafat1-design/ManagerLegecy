import type {
  Competition,
  EuropeanQualificationRule,
  GameState,
  GameStateMeta,
  WorldCompetitionConfig,
} from "./types";
import { computeLeagueTable } from "./standings";
import { getCupChampion } from "./cups";

type QualificationRule = EuropeanQualificationRule;

function getLeagueIdForCompetitionId(state: GameState, competitionId: string): string | null {
  for (const [leagueId, league] of Object.entries(state.leagues)) {
    if (league.competitionId === competitionId) {
      return leagueId;
    }
  }
  return null;
}

function getCompetitionLeagueTable(state: GameState, competitionId: string) {
  const leagueId = getLeagueIdForCompetitionId(state, competitionId);
  if (!leagueId) return [];
  return computeLeagueTable(state, leagueId);
}

function buildQualificationReason(rule: QualificationRule, clubId: string, state: GameState) {
  if (rule.type === "leaguePosition") {
    const positions = rule.positions ?? [];
    return positions.length > 0
      ? `Qualified via ${rule.sourceCompetitionId} position ${positions.join(", ")}`
      : `Qualified via ${rule.sourceCompetitionId}`;
  }

  if (rule.type === "cupWinner") {
    const cupName =
      state.competitions.find((c) => c.id === rule.sourceCompetitionId)?.name ??
      rule.sourceCompetitionId;
    return `Qualified as ${cupName} winner`;
  }

  return `Qualified via ${rule.sourceCompetitionId}`;
}

function resolveLeaguePositionCandidates(
  state: GameState,
  rule: QualificationRule,
  registeredClubIds: Set<string>,
): string[] {
  const table = getCompetitionLeagueTable(state, rule.sourceCompetitionId);
  if (table.length === 0) return [];
  const positions: number[] = rule.positions ?? [];
  if (positions.length === 0) {
    return table.map((row) => row.clubId).filter((clubId) => !registeredClubIds.has(clubId));
  }
  return positions
    .map((position: number) => table.find((row) => row.position === position))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map((row) => row.clubId)
    .filter((clubId) => !registeredClubIds.has(clubId));
}

function resolveCupWinnerCandidate(
  state: GameState,
  rule: QualificationRule,
  registeredClubIds: Set<string>,
): string[] {
  const winner = getCupChampion(state, rule.sourceCompetitionId);
  if (!winner) return [];
  if (!registeredClubIds.has(winner)) {
    return [winner];
  }

  if (!rule.fallbackToCompetitionId) return [];
  const fallbackTable = getCompetitionLeagueTable(state, rule.fallbackToCompetitionId);
  return fallbackTable
    .map((row) => row.clubId)
    .find((clubId) => clubId !== winner && !registeredClubIds.has(clubId))
    ? [
        fallbackTable
          .map((row) => row.clubId)
          .find((clubId) => clubId !== winner && !registeredClubIds.has(clubId))!,
      ]
    : [];
}

function buildQualificationCandidates(
  state: GameState,
  competition: WorldCompetitionConfig,
): { clubIds: string[]; reasons: Record<string, string> } {
  const registeredClubIds = new Set<string>();
  const reasons: Record<string, string> = {};
  const rules: QualificationRule[] = competition.qualificationRules ?? [];

  for (const rule of rules) {
    const candidates =
      rule.type === "leaguePosition"
        ? resolveLeaguePositionCandidates(state, rule, registeredClubIds)
        : resolveCupWinnerCandidate(state, rule, registeredClubIds);

    for (const clubId of candidates) {
      if (registeredClubIds.has(clubId)) continue;
      registeredClubIds.add(clubId);
      reasons[clubId] = buildQualificationReason(rule, clubId, state);
      if (
        competition.qualificationSlots &&
        registeredClubIds.size >= competition.qualificationSlots
      ) {
        break;
      }
    }

    if (
      competition.qualificationSlots &&
      registeredClubIds.size >= competition.qualificationSlots
    ) {
      break;
    }
  }

  return { clubIds: [...registeredClubIds], reasons };
}

function ensureContinentalCompetitionPresent(
  state: GameState,
  competition: WorldCompetitionConfig,
): Competition[] {
  const existing = state.competitions.find((item) => item.id === competition.id);
  if (existing) {
    return state.competitions.map((item) =>
      item.id === competition.id
        ? {
            ...item,
            stage: item.stage || "Qualification",
            status: item.status || "upcoming",
          }
        : item,
    );
  }

  return [
    ...state.competitions,
    {
      id: competition.id,
      name: competition.name,
      type: "continental",
      stage: "Qualification",
      status: "upcoming",
    },
  ];
}

export function applyEuropeanQualificationRegistrations(state: GameState): GameState {
  const worldConfig = state.meta?.worldConfig;
  if (!worldConfig) return state;

  const continentalCompetitions = worldConfig.competitions.filter(
    (comp) => comp.type === "continental",
  );
  if (continentalCompetitions.length === 0) return state;

  const events = [...(state.events ?? [])];
  // PHASE AAA-REPAIR-3: Clear old season qualifications before registering new ones
  // Only keep qualifications from the CURRENT season to prevent historical contamination
  const currentSeason = state.time.season;
  const registrations: GameStateMeta["europeanQualifications"] = (
    state.meta?.europeanQualifications ?? []
  )
    .filter((entry) => {
      const entryDate = entry.registeredAt ?? "";
      // Keep entries from this season only
      // If no season data, parse from date or assume current
      return true; // For now keep all; will clear if from different season
    })
    .filter((entry) => {
      // Check if this is from a previous season by looking at events
      // If a season already completed event exists, clear those registrations
      const seasonCompleteEvent = state.events?.find(
        (e) => e.type === "SEASON_COMPLETED" && (e.meta?.["season"] ?? "") < currentSeason,
      );
      if (!seasonCompleteEvent) return true; // No completed seasons, keep all
      // Clear registrations from before the completed season
      return (entry.registeredAt ?? "") >= seasonCompleteEvent.date;
    });
  let next = { ...state } as GameState;

  for (const competition of continentalCompetitions) {
    const { clubIds, reasons } = buildQualificationCandidates(next, competition);
    if (clubIds.length === 0) continue;

    next = { ...next, competitions: ensureContinentalCompetitionPresent(next, competition) };

    const leagueEntries = clubIds.map((clubId) => {
      const reason = reasons[clubId] ?? `Qualified for ${competition.name}`;
      const registration = {
        competitionId: competition.id,
        clubId,
        reason,
        registeredAt: next.time.date,
        stage: "qualification" as const,
      };
      registrations.push(registration);
      return `${next.clubs[clubId]?.name ?? clubId} (${reason})`;
    });

    if (leagueEntries.length > 0) {
      events.push({
        id: `event-continental-qual-${events.length + 1}`,
        date: next.time.date,
        type: "milestone",
        description: `${competition.name} qualifiers: ${leagueEntries.join(", ")}`,
        meta: { type: "european_qualification", competitionId: competition.id, clubIds },
      } as any);
    }
  }

  next = {
    ...next,
    events,
    meta: {
      ...next.meta,
      europeanQualifications: registrations,
    },
  };

  return next;
}
