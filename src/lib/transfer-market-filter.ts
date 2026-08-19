/**
 * Transfer Market Filter and Search Logic
 * ====================================
 * Comprehensive filtering, searching, and sorting for transfer market discovery.
 * Designed for performance: all filters can work simultaneously without re-filtering
 * or re-sorting on every render when props don't change.
 */

import { parseMoney } from "@/state/finance";
import type { Club, GameState, Player, TransferListing } from "@/state/types";

export type SortBy = "rating" | "value" | "age" | "name" | "marketValue";

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface TransferMarketFilters {
  searchQuery: string;
  positions: string[];
  minOverall: number;
  maxOverall: number;
  minAge: number;
  maxAge: number;
  minValue: number; // in euros
  maxValue: number; // in euros
  statuses: TransferListing["status"][];
  clubIds: string[];
  personalities: string[];
  sortBy: SortBy;
}

export interface TransferMarketRow {
  id: string;
  playerId?: string;
  name: string;
  position: string;
  age: number;
  overall: number;
  marketValue: number;
  valueFormatted: string;
  personality?: string;
  club?: Club;
  clubName: string;
  listing: TransferListing;
  player?: Player;
  status: TransferListing["status"];
}

/**
 * Build rows from transfer listings with all available player data.
 * This is the raw data transformation layer.
 */
export function buildTransferMarketRows(state: GameState): TransferMarketRow[] {
  const listingByPlayerId = new Map<string, TransferListing>();
  for (const listing of state.transfers ?? []) {
    if (listing.playerId) {
      listingByPlayerId.set(listing.playerId, listing);
    }
  }

  const worldRows = Object.values(state.players ?? {})
    .filter((player) => player && player.name)
    .map((player) => {
      const listing =
        listingByPlayerId.get(player.id) ??
        ({
          id: `world-player-${player.id}`,
          playerId: player.id,
          ...(player.clubId ? { sellerClubId: player.clubId } : {}),
          name: player.name,
          position: player.pos,
          rating: player.overall,
          nationality: player.nationality,
          age: player.age,
          value: player.value ?? "€0",
          status: "new" as const,
        } as TransferListing);

      const club = player.clubId ? state.clubs[player.clubId] : undefined;
      const valueFormatted = player.value ?? listing.value ?? "€0";
      const marketValue = Math.max(parseMoney(valueFormatted), player.marketValue ?? 0);

      return {
        id: listing.id,
        playerId: player.id,
        name: player.name,
        position: player.pos,
        age: player.age,
        overall: player.overall,
        marketValue,
        valueFormatted,
        personality: player.personality,
        ...(club ? { club } : {}),
        clubName: club?.name ?? (listing.sellerClubId ? listing.sellerClubId : "Free Agent"),
        listing,
        player,
        status: listing.status,
      } satisfies TransferMarketRow;
    });

  const extraListingRows = (state.transfers ?? [])
    .filter((listing) => !listing.playerId || !state.players?.[listing.playerId])
    .map((listing) => {
      const club = listing.sellerClubId ? state.clubs[listing.sellerClubId] : undefined;
      const player = listing.playerId ? state.players[listing.playerId] : undefined;
      const valueFormatted = player?.value ?? listing.value ?? "€0";
      const marketValue = Math.max(parseMoney(valueFormatted), player?.marketValue ?? 0);

      return {
        id: listing.id,
        ...(listing.playerId !== undefined ? { playerId: listing.playerId } : {}),
        name: player?.name ?? listing.name ?? "Unknown",
        position: player?.pos ?? listing.position ?? "N/A",
        age: player?.age ?? listing.age ?? 0,
        overall: player?.overall ?? listing.rating ?? 0,
        marketValue,
        valueFormatted,
        ...(player?.personality !== undefined ? { personality: player.personality } : {}),
        ...(club !== undefined ? { club } : {}),
        clubName: club?.name ?? (listing.sellerClubId ? listing.sellerClubId : "Free Agent"),
        listing,
        ...(player !== undefined ? { player } : {}),
        status: listing.status,
      } as TransferMarketRow;
    });

  const merged = new Map<string, TransferMarketRow>();
  for (const row of [...worldRows, ...extraListingRows]) {
    const key = row.playerId ?? row.id;
    if (!row.name || row.name === "Unknown") continue;
    if (!merged.has(key)) merged.set(key, row);
  }

  return Array.from(merged.values());
}

/**
 * Apply all filters to a set of rows. All filters are ANDed together.
 */
export function applyFilters(
  rows: TransferMarketRow[],
  filters: TransferMarketFilters,
): TransferMarketRow[] {
  return rows.filter((row) => {
    // Search query (case-insensitive, diacritic-insensitive, partial match)
    if (filters.searchQuery.trim()) {
      const q = normalizeSearchText(filters.searchQuery);
      const searchableText = normalizeSearchText(`${row.name} ${row.position} ${row.clubName}`);
      if (!searchableText.includes(q)) return false;
    }

    // Position filter
    if (filters.positions.length > 0 && !filters.positions.includes(row.position)) {
      return false;
    }

    // Overall rating range
    if (row.overall < filters.minOverall || row.overall > filters.maxOverall) {
      return false;
    }

    // Age range
    if (row.age < filters.minAge || row.age > filters.maxAge) {
      return false;
    }

    // Market value range
    if (row.marketValue < filters.minValue || row.marketValue > filters.maxValue) {
      return false;
    }

    // Status filter
    if (filters.statuses.length > 0 && !filters.statuses.includes(row.status)) {
      return false;
    }

    // Club filter
    if (filters.clubIds.length > 0) {
      const rowClubId = row.club?.id;
      if (!rowClubId || !filters.clubIds.includes(rowClubId)) {
        return false;
      }
    }

    // Personality filter
    if (filters.personalities.length > 0) {
      if (!row.personality || !filters.personalities.includes(row.personality)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort rows by the specified criteria.
 */
export function sortRows(rows: TransferMarketRow[], sortBy: SortBy): TransferMarketRow[] {
  const sorted = [...rows];

  switch (sortBy) {
    case "rating":
      sorted.sort((a, b) => b.overall - a.overall);
      break;
    case "value":
      sorted.sort((a, b) => b.marketValue - a.marketValue);
      break;
    case "marketValue":
      sorted.sort((a, b) => b.marketValue - a.marketValue);
      break;
    case "age":
      sorted.sort((a, b) => a.age - b.age);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return sorted;
}

/**
 * Compose all steps: build rows → apply filters → sort.
 * This is the main entry point for getting filtered and sorted transfer data.
 */
export function getFilteredTransferMarketRows(
  state: GameState,
  filters: TransferMarketFilters,
): TransferMarketRow[] {
  const rows = buildTransferMarketRows(state);
  const filtered = applyFilters(rows, filters);
  return sortRows(filtered, filters.sortBy);
}

/**
 * Create default filters (no filters applied).
 */
export function createDefaultFilters(): TransferMarketFilters {
  return {
    searchQuery: "",
    positions: [],
    minOverall: 0,
    maxOverall: 100,
    minAge: 16,
    maxAge: 42,
    minValue: 0,
    maxValue: Number.MAX_SAFE_INTEGER,
    statuses: [],
    clubIds: [],
    personalities: [],
    sortBy: "rating",
  };
}

/**
 * Get all unique positions available in the market.
 */
export function getAvailablePositions(rows: TransferMarketRow[]): string[] {
  const positions = new Set(rows.map((r) => r.position));
  return Array.from(positions).sort();
}

/**
 * Get all unique clubs available in the market.
 */
export function getAvailableClubs(rows: TransferMarketRow[]): Club[] {
  const clubMap = new Map<string, Club>();
  rows.forEach((r) => {
    if (r.club?.id && !clubMap.has(r.club.id)) {
      clubMap.set(r.club.id, r.club);
    }
  });
  return Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all unique personalities available in the market.
 */
export function getAvailablePersonalities(rows: TransferMarketRow[]): string[] {
  const personalities = new Set(rows.map((r) => r.personality).filter((p): p is string => !!p));
  return Array.from(personalities).sort();
}

/**
 * Get all unique statuses available in the market.
 */
export function getAvailableStatuses(rows: TransferMarketRow[]): TransferListing["status"][] {
  const statuses = new Set(rows.map((r) => r.status));
  return Array.from(statuses) as TransferListing["status"][];
}

/**
 * Count how many filters are actively applied (non-default).
 */
export function countActiveFilters(filters: TransferMarketFilters): number {
  let count = 0;
  if (filters.searchQuery.trim()) count++;
  if (filters.positions.length > 0) count++;
  if (filters.minOverall > 0) count++;
  if (filters.maxOverall < 100) count++;
  if (filters.minAge > 16) count++;
  if (filters.maxAge < 42) count++;
  if (filters.minValue > 0) count++;
  if (filters.maxValue < Number.MAX_SAFE_INTEGER) count++;
  if (filters.statuses.length > 0) count++;
  if (filters.clubIds.length > 0) count++;
  if (filters.personalities.length > 0) count++;
  return count;
}
