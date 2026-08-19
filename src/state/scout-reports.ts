import {
  GameState,
  ScoutReport,
  Scout,
  ScoutingAssignment,
  Player,
  ScoutingNetwork,
} from "./types";
import { getScoutTierById } from "./scouting-network";
import { seededUnit, deterministicId } from "./utils";
import { registerDailyHook } from "./calendar";

function seededRandInt(seed: string, min: number, max: number, index: number) {
  const v = seededUnit(`${seed}:${index}`);
  return Math.floor(v * (max - min + 1)) + min;
}

/** Generate a scout report when an assignment completes. */
export function generateScoutReport(
  state: GameState,
  assignment: ScoutingAssignment,
  scout: Scout,
): ScoutReport | null {
  const tier = getScoutTierById(scout.tierId);
  if (!tier) return null;

  // Select a random player from the target country
  const countryClubs = Object.values(state.clubs).filter((club) =>
    club.leagueId?.includes(assignment.targetCountryId),
  );
  if (countryClubs.length === 0) return null;

  // Gather all players from clubs in the target country
  const candidatePlayers: Player[] = [];
  for (const club of countryClubs) {
    for (const playerId of club.playerIds) {
      const player = state.players[playerId];
      if (player && player.age >= 16 && player.age <= 35 && player.status !== "retired") {
        candidatePlayers.push(player);
      }
    }
  }

  if (candidatePlayers.length === 0) return null;

  // Pick based on discovery quality (lower tier = fewer candidates, higher tier = more)
  const reportSeed = `${assignment.id}:${state.time.date}:report`;
  const discoveryCount = Math.min(1, tier.discoveryQuality);
  const selectedIndex = Math.floor(seededUnit(`${reportSeed}:select`) * candidatePlayers.length);
  const selectedPlayer = candidatePlayers[selectedIndex];
  if (!selectedPlayer) return null;

  // Apply scout accuracy to ability estimation
  const accuracyVariance = (100 - tier.scoutingAccuracy) / 2; // Scout tier affects range variance
  const baseAbility = selectedPlayer.overall ?? 70;
  const lowEstimate = Math.max(
    1,
    Math.round(baseAbility - accuracyVariance + seededRandInt(`${reportSeed}:low`, -10, 10, 1)),
  );
  const highEstimate = Math.min(
    99,
    Math.round(baseAbility + accuracyVariance + seededRandInt(`${reportSeed}:high`, -10, 10, 2)),
  );

  // Higher tiers get better potential estimates
  let potentialRange: [number, number] | undefined;
  if (tier.discoveryQuality >= 2) {
    const potential = selectedPlayer.potential ?? selectedPlayer.overall ?? 70;
    const potentialVariance = tier.discoveryQuality === 2 ? 8 : 4;
    potentialRange = [
      Math.max(highEstimate, Math.round(potential - potentialVariance)),
      Math.min(99, Math.round(potential + potentialVariance)),
    ];
  }

  // Scout confidence affects recommendation tone
  const confidence = Math.min(
    100,
    40 + tier.scoutingAccuracy + seededRandInt(`${reportSeed}:conf`, -15, 15, 3),
  );

  // Select key attributes based on scout tier
  const keyAttributeCount = Math.max(3, Math.floor(tier.discoveryQuality * 1.5));
  const allAttrs = [
    { name: "Pace", value: selectedPlayer.attrs?.pace ?? 60 },
    { name: "Shooting", value: selectedPlayer.attrs?.shooting ?? 60 },
    { name: "Passing", value: selectedPlayer.attrs?.passing ?? 60 },
    { name: "Dribbling", value: selectedPlayer.attrs?.dribbling ?? 60 },
    { name: "Defending", value: selectedPlayer.attrs?.defending ?? 60 },
    { name: "Physical", value: selectedPlayer.attrs?.physical ?? 60 },
  ];

  const keyAttributes = allAttrs
    .sort(() => seededUnit(`${reportSeed}:attr:sort`) - 0.5)
    .slice(0, keyAttributeCount)
    .map((attr) => ({
      name: attr.name,
      value: attr.value,
      confidence: Math.min(
        100,
        tier.scoutingAccuracy + seededRandInt(`${reportSeed}:${attr.name}`, -10, 10, 4),
      ),
    }));

  // Generate recommendation
  const recommendations = [
    `Solid prospect with potential for development at ${selectedPlayer.pos} position.`,
    `Shows promising technical ability and maturity for ${selectedPlayer.age} years old.`,
    `Reliable player with consistent performances; suitable for squad depth.`,
    `Exceptional talent with rare technical profile and growth potential.`,
    `Young player showing early promise; worth monitoring for future recruitment.`,
  ];
  const recommendationIndex = Math.floor(seededUnit(`${reportSeed}:rec`) * recommendations.length);
  const recommendation =
    recommendations[Math.min(recommendationIndex, recommendations.length - 1)] ??
    "Promising prospect for future development.";

  const report: ScoutReport = {
    id: deterministicId(
      "report",
      `${state.gameSeed ?? "0"}:${state.time.date}:${scout.id}:${assignment.id}`,
      state.scoutingNetwork?.reports?.length ?? 0,
    ),
    completedDate: state.time.date,
    assignmentId: assignment.id,
    scoutId: scout.id,
    targetCountryId: assignment.targetCountryId,
    playerId: selectedPlayer.id,
    scoutTierId: scout.tierId,
    scoutingAccuracy: tier.scoutingAccuracy,
    discoveryQuality: tier.discoveryQuality,
    confidence,
    playerInfo: {
      name: selectedPlayer.name,
      age: selectedPlayer.age,
      position: selectedPlayer.pos,
      nationality: selectedPlayer.nationality,
      currentClubId: selectedPlayer.clubId ?? null,
      ...(selectedPlayer.personality && { personality: selectedPlayer.personality }),
    },
    abilityRange: [lowEstimate, highEstimate],
    ...(potentialRange && { potentialRange }),
    keyAttributes,
    recommendation,
    status: "new",
  };
  return report;
}

/** Process all completed scout assignments and generate reports. */
export function processCompletedScoutingAssignments(state: GameState): GameState {
  if (!state.scoutingNetwork) return state;

  let nextState = state;
  const { scouts, assignments, reports = [] } = state.scoutingNetwork;

  // Find completed assignments
  const completedAssignments = assignments.filter((a) => a.status === "completed");
  if (completedAssignments.length === 0) return state;

  const newReports: ScoutReport[] = [];
  for (const assignment of completedAssignments) {
    // Skip if already generated a report for this assignment
    if (reports.some((r) => r.assignmentId === assignment.id)) continue;

    const scout = scouts.find((s) => s.id === assignment.scoutId);
    if (!scout) continue;

    const report = generateScoutReport(nextState, assignment, scout);
    if (report) {
      newReports.push(report);

      // Create inbox message for the completed report
      const message = {
        id: `scout-report-${report.id}`,
        date: nextState.time.date,
        category: "scouting" as const,
        title: `Scout Report: ${report.playerInfo.name}`,
        body: `${scout.name} has completed scouting in ${assignment.assignmentLabel}. Report: ${report.playerInfo.name} (${report.playerInfo.position}, age ${report.playerInfo.age}). Estimated ability: ${report.abilityRange[0]}-${report.abilityRange[1]}. ${report.recommendation}`,
        priority: "normal" as const,
        isRead: false,
        relatedEntityId: report.id,
        action: "view_scout_report" as const,
      };
      nextState = {
        ...nextState,
        inbox: [...(nextState.inbox ?? []), message],
      };
    }
  }

  if (newReports.length === 0) return state;

  const scoutingNetworkNext: ScoutingNetwork = {
    scouts: nextState.scoutingNetwork?.scouts ?? [],
    assignments: nextState.scoutingNetwork?.assignments ?? [],
    reports: [...(nextState.scoutingNetwork?.reports ?? []), ...newReports],
    ...(nextState.scoutingNetwork?.shortlistedPlayerIds && {
      shortlistedPlayerIds: nextState.scoutingNetwork.shortlistedPlayerIds,
    }),
    ...(nextState.scoutingNetwork?.dismissedPlayerIds && {
      dismissedPlayerIds: nextState.scoutingNetwork.dismissedPlayerIds,
    }),
  };

  return {
    ...nextState,
    scoutingNetwork: scoutingNetworkNext,
  };
}

/** Add a scouted player to the manager's shortlist. */
export function addScoutedPlayerToShortlist(state: GameState, reportId: string): GameState {
  const report = state.scoutingNetwork?.reports?.find((r) => r.id === reportId);
  if (!report || !report.playerId) return state;

  if (!state.scoutingNetwork) return state;

  return {
    ...state,
    scoutingNetwork: {
      ...state.scoutingNetwork,
      reports:
        state.scoutingNetwork.reports?.map((r) =>
          r.id === reportId ? { ...r, status: "shortlisted" as const } : r,
        ) ?? [],
      shortlistedPlayerIds: [
        ...new Set([...(state.scoutingNetwork.shortlistedPlayerIds ?? []), report.playerId]),
      ],
    },
    shortlistPlayerIds: [...new Set([...(state.shortlistPlayerIds ?? []), report.playerId])],
  };
}

/** Dismiss a scouted player (don't show again). */
export function dismissScoutedPlayer(state: GameState, reportId: string): GameState {
  const report = state.scoutingNetwork?.reports?.find((r) => r.id === reportId);
  if (!report || !report.playerId) return state;

  if (!state.scoutingNetwork) return state;

  return {
    ...state,
    scoutingNetwork: {
      ...state.scoutingNetwork,
      reports:
        state.scoutingNetwork.reports?.map((r) =>
          r.id === reportId ? { ...r, status: "dismissed" as const } : r,
        ) ?? [],
      dismissedPlayerIds: [
        ...new Set([...(state.scoutingNetwork.dismissedPlayerIds ?? []), report.playerId]),
      ],
    },
  };
}

/** Check if a scouted player is eligible to join the academy. */
export function isEligibleForAcademy(player: Player | undefined): boolean {
  if (!player) return false;
  // Academy prospects are typically under 23 and not yet retired
  return player.age <= 23 && player.status !== "retired";
}

/** Add a scouted player to the academy. */
export function addScoutedPlayerToAcademy(state: GameState, reportId: string): GameState {
  const report = state.scoutingNetwork?.reports?.find((r) => r.id === reportId);
  if (!report || !report.playerId) return state;

  const player = state.players[report.playerId];
  if (!player || !isEligibleForAcademy(player)) return state;

  const club = state.currentClub;
  if (!club || club.academy.prospectIds.includes(report.playerId)) return state;

  // Update the club's academy
  const updatedClub = {
    ...club,
    academy: {
      ...club.academy,
      prospectIds: [...new Set([...club.academy.prospectIds, report.playerId])],
    },
  };

  const nextScoutingNetwork: ScoutingNetwork | undefined = state.scoutingNetwork
    ? {
        scouts: state.scoutingNetwork.scouts,
        assignments: state.scoutingNetwork.assignments,
        reports: (state.scoutingNetwork.reports ?? []).map((r) =>
          r.id === reportId ? { ...r, status: "academy_added" as const } : r,
        ),
        ...(state.scoutingNetwork.shortlistedPlayerIds && {
          shortlistedPlayerIds: state.scoutingNetwork.shortlistedPlayerIds,
        }),
        ...(state.scoutingNetwork.dismissedPlayerIds && {
          dismissedPlayerIds: state.scoutingNetwork.dismissedPlayerIds,
        }),
      }
    : undefined;

  const nextState: GameState = {
    ...state,
    clubs: {
      ...state.clubs,
      [club.id]: updatedClub,
    },
    currentClub: updatedClub,
    ...(nextScoutingNetwork && { scoutingNetwork: nextScoutingNetwork }),
  };
  return nextState;
}

/** Mark a player for continued scouting. */
export function continueScoutingPlayer(
  state: GameState,
  reportId: string,
  newDurationDays: number = 30,
): GameState {
  const report = state.scoutingNetwork?.reports?.find((r) => r.id === reportId);
  if (!report) return state;

  if (!state.scoutingNetwork) return state;

  // Create a new assignment for the same player
  const assignment = state.scoutingNetwork.assignments.find((a) => a.id === report.assignmentId);
  if (!assignment) return state;

  const scout = state.scoutingNetwork.scouts.find((s) => s.id === assignment.scoutId);
  if (!scout) return state;

  const tier = getScoutTierById(scout.tierId);
  if (!tier) return state;

  const cost = Math.round(tier.cost * (newDurationDays / 30));

  const newAssignment: typeof assignment = {
    id: deterministicId(
      "assignment",
      `${state.gameSeed ?? "0"}:${state.time.date}:${scout.id}:${report.playerId}`,
      state.scoutingNetwork.assignments.length,
    ),
    scoutId: scout.id,
    targetCountryId: assignment.targetCountryId,
    assignmentLabel: `Continue: ${report.playerInfo.name}`,
    durationDays: newDurationDays,
    startedOnDate: state.time.date,
    status: "active",
    progressDays: 0,
    reportSpeedDays: tier.reportSpeedDays,
    scoutingAccuracy: tier.scoutingAccuracy,
    discoveryQuality: tier.discoveryQuality,
    geographicReach: [...tier.geographicReach],
    assignedCost: cost,
  };

  return {
    ...state,
    scoutingNetwork: {
      ...state.scoutingNetwork,
      reports:
        state.scoutingNetwork.reports?.map((r) =>
          r.id === reportId ? { ...r, status: "continued_scouting" as const } : r,
        ) ?? [],
      assignments: [...state.scoutingNetwork.assignments, newAssignment],
    },
  };
}

/** Get all active scout reports for the manager. */
export function getManagerScoutReports(state: GameState): ScoutReport[] {
  return state.scoutingNetwork?.reports?.filter((r) => r.status === "new") ?? [];
}

/** Get all shortlisted players from scout reports. */
export function getShortlistedFromScouts(state: GameState): string[] {
  return state.scoutingNetwork?.shortlistedPlayerIds ?? [];
}

/** Get all dismissed players from scout reports. */
export function getDismissedFromScouts(state: GameState): string[] {
  return state.scoutingNetwork?.dismissedPlayerIds ?? [];
}

// Register daily hook to process completed scouting assignments
registerDailyHook("scouting", (state) => processCompletedScoutingAssignments(state));
