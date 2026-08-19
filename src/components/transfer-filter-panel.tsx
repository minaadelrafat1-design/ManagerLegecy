/**
 * Advanced Transfer Market Filter Panel
 * =====================================
 * A polished, responsive filter UI for discovering players in the transfer market.
 * All filters can work simultaneously with instant visual feedback.
 */

import { useState, type ReactNode } from "react";
import { TMod } from "./ui-modern";
import type { Club } from "@/state/types";
import type {
  TransferMarketFilters,
  SortBy,
  TransferMarketRow,
} from "@/lib/transfer-market-filter";
import {
  getAvailablePositions,
  getAvailableClubs,
  getAvailablePersonalities,
  countActiveFilters,
} from "@/lib/transfer-market-filter";

interface TransferFilterPanelProps {
  filters: TransferMarketFilters;
  onFiltersChange: (filters: TransferMarketFilters) => void;
  onApplyFilters?: () => void;
  availableRows?: TransferMarketRow[];
  availablePositions?: string[];
  availableClubs?: Club[];
  availablePersonalities?: string[];
  resultCount: number;
  isOpen?: boolean;
}

export function TransferFilterPanel({
  filters,
  onFiltersChange,
  onApplyFilters,
  availableRows,
  availablePositions,
  availableClubs,
  availablePersonalities,
  resultCount,
  isOpen = true,
}: TransferFilterPanelProps) {
  const [expanded, setExpanded] = useState(isOpen);
  const activeFilterCount = countActiveFilters(filters);

  const positions = availablePositions ?? getAvailablePositions(availableRows ?? []);
  const clubs = availableClubs ?? getAvailableClubs(availableRows ?? []);
  const personalities = availablePersonalities ?? getAvailablePersonalities(availableRows ?? []);

  const handleClearFilters = () => {
    onFiltersChange({
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
    });
  };

  const togglePosition = (pos: string) => {
    const newPositions = filters.positions.includes(pos)
      ? filters.positions.filter((p) => p !== pos)
      : [...filters.positions, pos];
    onFiltersChange({ ...filters, positions: newPositions });
  };

  const toggleClub = (clubId: string) => {
    const newClubs = filters.clubIds.includes(clubId)
      ? filters.clubIds.filter((c) => c !== clubId)
      : [...filters.clubIds, clubId];
    onFiltersChange({ ...filters, clubIds: newClubs });
  };

  const togglePersonality = (pers: string) => {
    const newPers = filters.personalities.includes(pers)
      ? filters.personalities.filter((p) => p !== pers)
      : [...filters.personalities, pers];
    onFiltersChange({ ...filters, personalities: newPers });
  };

  const toggleStatus = (status: TransferMarketFilters["statuses"][number]) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  return (
    <div
      style={{
        background: TMod.bgPanel,
        border: `1px solid ${TMod.borderLight}`,
        borderRadius: 12,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px",
          borderBottom: `1px solid ${TMod.borderLight}`,
          cursor: "pointer",
          background: TMod.bgSecondary,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 16,
              color: TMod.accentGreen,
            }}
          >
            🔍
          </span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: TMod.textPrimary,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Advanced Search
            </div>
            {activeFilterCount > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: TMod.accentGreen,
                  marginTop: 2,
                }}
              >
                {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: TMod.accentGreen,
              color: TMod.bgPrimary,
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {resultCount}
          </span>
          <span style={{ color: TMod.textSecondary, fontSize: 20 }}>{expanded ? "▼" : "▶"}</span>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Search */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Search by Name, Position or Club
            </label>
            <input
              value={filters.searchQuery}
              onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
              placeholder="E.g., 'Striker' or 'United FC'"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${TMod.borderLight}`,
                borderRadius: 8,
                color: TMod.textPrimary,
                padding: "10px 12px",
                fontSize: 13,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Rating Range */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Overall Rating: {filters.minOverall} - {filters.maxOverall}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minOverall}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val <= filters.maxOverall) {
                    onFiltersChange({ ...filters, minOverall: val });
                  }
                }}
                style={{ flex: 1 }}
              />
              <input
                type="range"
                min="0"
                max="100"
                value={filters.maxOverall}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= filters.minOverall) {
                    onFiltersChange({ ...filters, maxOverall: val });
                  }
                }}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Age Range */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Age: {filters.minAge} - {filters.maxAge}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="range"
                min="16"
                max="42"
                value={filters.minAge}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val <= filters.maxAge) {
                    onFiltersChange({ ...filters, minAge: val });
                  }
                }}
                style={{ flex: 1 }}
              />
              <input
                type="range"
                min="16"
                max="42"
                value={filters.maxAge}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= filters.minAge) {
                    onFiltersChange({ ...filters, maxAge: val });
                  }
                }}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Market Value Range */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Market Value Range
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                type="number"
                value={filters.minValue}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  if (val <= filters.maxValue) {
                    onFiltersChange({ ...filters, minValue: val });
                  }
                }}
                placeholder="Min"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                  color: TMod.textPrimary,
                  padding: "8px 10px",
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
              <input
                type="number"
                value={filters.maxValue === Number.MAX_SAFE_INTEGER ? "" : filters.maxValue}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : Number.MAX_SAFE_INTEGER;
                  if (val >= filters.minValue) {
                    onFiltersChange({ ...filters, maxValue: val });
                  }
                }}
                placeholder="Max"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                  color: TMod.textPrimary,
                  padding: "8px 10px",
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Positions */}
          {positions.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Positions
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => togglePosition(pos)}
                    type="button"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${filters.positions.includes(pos) ? TMod.accentGreen : TMod.borderLight}`,
                      background: filters.positions.includes(pos)
                        ? `${TMod.accentGreen}20`
                        : "transparent",
                      color: filters.positions.includes(pos)
                        ? TMod.accentGreen
                        : TMod.textSecondary,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 700,
                color: TMod.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Status
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(["new", "interested", "bid", "agreed", "rejected"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  type="button"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${filters.statuses.includes(status) ? TMod.accentGold : TMod.borderLight}`,
                    background: filters.statuses.includes(status)
                      ? `${TMod.accentGold}20`
                      : "transparent",
                    color: filters.statuses.includes(status) ? TMod.accentGold : TMod.textSecondary,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Clubs */}
          {clubs.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Clubs ({clubs.length})
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 6,
                  maxHeight: 180,
                  overflowY: "auto",
                }}
              >
                {clubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => toggleClub(club.id)}
                    type="button"
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: `1px solid ${filters.clubIds.includes(club.id) ? TMod.accentGreen : TMod.borderLight}`,
                      background: filters.clubIds.includes(club.id)
                        ? `${TMod.accentGreen}20`
                        : "transparent",
                      color: filters.clubIds.includes(club.id)
                        ? TMod.accentGreen
                        : TMod.textSecondary,
                      fontSize: 10,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={club.name}
                  >
                    {club.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personality */}
          {personalities.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Personality Type
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {personalities.map((pers) => (
                  <button
                    key={pers}
                    onClick={() => togglePersonality(pers)}
                    type="button"
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${filters.personalities.includes(pers) ? TMod.accentBlue : TMod.borderLight}`,
                      background: filters.personalities.includes(pers)
                        ? `${TMod.accentBlue}20`
                        : "transparent",
                      color: filters.personalities.includes(pers)
                        ? TMod.accentBlue
                        : TMod.textSecondary,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textTransform: "capitalize",
                    }}
                  >
                    {pers}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort and Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 700,
                  color: TMod.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value as SortBy })}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${TMod.borderLight}`,
                  borderRadius: 6,
                  color: TMod.textPrimary,
                  padding: "8px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <option value="rating">Rating</option>
                <option value="value">Market Value</option>
                <option value="age">Age (Young First)</option>
                <option value="name">Name</option>
              </select>
            </div>

            {activeFilterCount > 0 && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: TMod.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Actions
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button
                    onClick={onApplyFilters}
                    type="button"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(73, 194, 116, 0.15)",
                      border: `1px solid rgba(73, 194, 116, 0.35)`,
                      color: TMod.accentGreen,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleClearFilters}
                    type="button"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(255,90,98,0.15)",
                      border: `1px solid rgba(255,90,98,0.3)`,
                      color: TMod.accentRed,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
