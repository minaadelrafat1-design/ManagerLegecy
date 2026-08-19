import type { GameState } from "./types";
import { computeLeagueTable, invalidateAllLeagueTables } from "./standings";
import { invalidateClubStrength } from "../lib/ai-fixture-sim";

function getWorldDivisionConfigs(state: GameState) {
  return state.meta?.worldConfig?.countries?.flatMap((country) => country.divisions) ?? [];
}

function getDivisionConfig(state: GameState, leagueId: string) {
  return getWorldDivisionConfigs(state).find((division) => division.id === leagueId) ?? null;
}

function resolveDivisionMovementCandidates(
  table: ReturnType<typeof computeLeagueTable>,
  division: {
    promotionTo?: string | null;
    relegationTo?: string | null;
    promotionSpots?: number;
    relegationSpots?: number;
  },
) {
  const promoteIds = division.promotionTo
    ? table.slice(0, Math.max(0, division.promotionSpots ?? 3)).map((row) => row.clubId)
    : [];
  const relegatedIds = division.relegationTo
    ? table.slice(-Math.max(0, division.relegationSpots ?? 3)).map((row) => row.clubId)
    : [];

  return { promoteIds, relegatedIds };
}

/**
 * Check if promotion/relegation has already been applied this season.
 * Uses event log to detect if PROMOTION/RELEGATION events exist for this season.
 */
function hasAlreadyAppliedPromotionRelegation(state: GameState, season: string): boolean {
  const promotionEvents = (state.events ?? []).filter(
    (e: any) => e.type === "PROMOTION" && (e.meta?.season ?? state.time.season) === season,
  );
  return promotionEvents.length > 0;
}

export function applyPromotionRelegation(state: GameState): GameState {
  const season = String(state.time.season);

  // Guard: prevent double-processing the same season
  if (hasAlreadyAppliedPromotionRelegation(state, season)) {
    return state;
  }

  const divisions = getWorldDivisionConfigs(state);
  const next = { ...state } as GameState;
  const events = [...(next.events ?? [])];
  const moves: Record<
    string,
    { toLeagueId: string; isPromotion: boolean; fromDivisionId: string }
  > = {};
  const promotionLines: string[] = [];
  const relegationLines: string[] = [];

  if (divisions.length > 0) {
    for (const division of divisions) {
      const table = computeLeagueTable(next, division.id);
      if (table.length === 0) continue;

      const isHighestTier = !division.promotionTo;
      const isLowestTier = !division.relegationTo;

      if (!isHighestTier && division.promotionTo) {
        const { promoteIds } = resolveDivisionMovementCandidates(table, division);
        for (const clubId of promoteIds) {
          if (!moves[clubId]) {
            moves[clubId] = {
              toLeagueId: division.promotionTo as string,
              isPromotion: true,
              fromDivisionId: division.id,
            };
          }
        }
        if (promoteIds.length > 0) {
          promotionLines.push(
            `Promoted from ${division.name} to ${division.promotionTo}: ${promoteIds.join(", ")}`,
          );
        }
      }

      if (!isLowestTier && division.relegationTo) {
        const { relegatedIds } = resolveDivisionMovementCandidates(table, division);
        for (const clubId of relegatedIds) {
          if (!moves[clubId]) {
            moves[clubId] = {
              toLeagueId: division.relegationTo as string,
              isPromotion: false,
              fromDivisionId: division.id,
            };
          }
        }
        if (relegatedIds.length > 0) {
          relegationLines.push(
            `Relegated from ${division.name} to ${division.relegationTo}: ${relegatedIds.join(", ")}`,
          );
        }
      }
    }
  }

  if (divisions.length === 0) {
    const mapping = (state.meta?.leagueHierarchy as Record<string, string> | undefined) ?? {};
    for (const [lower, higher] of Object.entries(mapping)) {
      const lowerTable = computeLeagueTable(next, lower);
      const higherTable = computeLeagueTable(next, higher);
      if (lowerTable.length === 0 || higherTable.length === 0) continue;

      const promoted = lowerTable.slice(0, 3).map((row) => row.clubId);
      const relegated = higherTable.slice(-3).map((row) => row.clubId);

      for (const clubId of promoted) {
        if (!moves[clubId])
          moves[clubId] = { toLeagueId: higher, isPromotion: true, fromDivisionId: lower };
      }
      for (const clubId of relegated) {
        if (!moves[clubId])
          moves[clubId] = { toLeagueId: lower, isPromotion: false, fromDivisionId: higher };
      }

      if (promoted.length) {
        promotionLines.push(`Promoted from ${lower} to ${higher}: ${promoted.join(", ")}`);
      }
      if (relegated.length) {
        relegationLines.push(`Relegated from ${higher} to ${lower}: ${relegated.join(", ")}`);
      }
    }
  }

  if (Object.keys(moves).length === 0) return next;

  const clubs = { ...next.clubs };
  let currentClub = next.currentClub;

  // Invariant checks before applying moves
  const movedClubIds = Object.keys(moves);
  const destinationDivisions = new Set<string>();
  for (const move of Object.values(moves)) {
    destinationDivisions.add(move.toLeagueId);
  }

  // Apply all moves
  for (const [clubId, { toLeagueId, isPromotion, fromDivisionId }] of Object.entries(moves)) {
    const club = clubs[clubId];
    if (!club) {
      console.warn(`[PROMOTION] Club not found: ${clubId}`);
      continue;
    }
    if (club.leagueId === toLeagueId) {
      console.warn(`[PROMOTION] Club ${clubId} already in target division ${toLeagueId}`);
      continue;
    }

    const fromDivision = club.leagueId;
    const fromDivisionName = getDivisionConfig(state, fromDivision)?.name ?? fromDivision;
    const toDivisionConfig = getDivisionConfig(state, toLeagueId);
    const toDivisionName = toDivisionConfig?.name ?? toLeagueId;

    clubs[clubId] = { ...club, leagueId: toLeagueId };
    if (currentClub?.id === clubId) {
      currentClub = { ...currentClub, leagueId: toLeagueId };
    }

    // Emit explicit PROMOTION or RELEGATION event with authoritative proof
    const eventType = isPromotion ? "PROMOTION" : "RELEGATION";
    events.push({
      id: `event-${eventType.toLowerCase()}-${season}-${clubId}`,
      date: state.time.date,
      type: eventType as any,
      description: `${club.name} moved from ${fromDivisionName} to ${toDivisionName}`,
      meta: {
        clubId,
        season,
        fromDivision,
        fromDivisionName,
        toDivision: toLeagueId,
        toDivisionName,
      },
    });
  }

  // Also keep the summary milestone event for UI/history
  const summaryLines = [...promotionLines, ...relegationLines];
  if (summaryLines.length > 0) {
    events.push({
      id: `event-promo-summary-${season}-${events.length}`,
      date: state.time.date,
      type: "milestone",
      description: summaryLines.join(" | "),
      meta: { season },
    } as any);
  }

  // PERFORMANCE: Invalidate all caches since promotion/relegation changes
  // league membership for many clubs and league standings for affected divisions.
  invalidateAllLeagueTables();
  for (const clubId of Object.keys(moves)) {
    invalidateClubStrength(clubId);
  }

  return { ...next, clubs, currentClub, events };
}

export {};
